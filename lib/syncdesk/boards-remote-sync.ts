"use client"

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import type {
  BoardMeta,
  BoardTask,
  KanbanColumnId,
  TaskChecklistItem,
  TaskComment,
  TeamMember,
  WorkspaceEntity,
} from "@/lib/boards/types"
import { isKanbanColumnId } from "@/lib/boards/task-utils"
import { subscribeToPostgresChanges } from "@/lib/supabase/realtime/create-channel"
import {
  fetchWorkspaceMembersForWorkspaces,
  remoteInsertWorkspaceOwner,
} from "@/lib/syncdesk/workspace-members-remote"

export type BoardsBundle = {
  workspaces: WorkspaceEntity[]
  boardsById: Record<string, BoardMeta>
  tasksByBoardId: Record<string, BoardTask[]>
  teamMembers: TeamMember[]
}

/**
 * PostgrestError instances have non-enumerable fields, so logging them with
 * `console.error(error)` shows `{}` in the Next.js error overlay. Extract the
 * useful fields manually so we can actually see what's wrong.
 */
function describeSupabaseError(error: PostgrestError | Error | null | undefined): {
  message: string
  code?: string
  details?: string
  hint?: string
  raw: unknown
} {
  if (!error) {
    return { message: "Unknown error", raw: error }
  }
  if (error instanceof Error) {
    return { message: error.message, raw: error }
  }
  const e = error as PostgrestError
  return {
    message: e.message ?? "Unknown error",
    code: e.code,
    details: e.details ?? undefined,
    hint: e.hint ?? undefined,
    raw: error,
  }
}

/**
 * Common boot-time failures: tables missing or RLS denying the request.
 * If we see them once, suppress further noise to avoid spamming the overlay.
 */
let bootFailureWarned = false

function isMissingSchema(error: PostgrestError | Error | null | undefined): boolean {
  if (!error) return false
  const desc = describeSupabaseError(error)
  if (desc.code === "42P01") return true
  if (desc.code === "42501") return true
  if (desc.code === "PGRST301") return true
  const msg = desc.message.toLowerCase()
  return (
    msg.includes("does not exist") ||
    msg.includes("schema") ||
    msg.includes("permission denied")
  )
}

function logBootFailure(context: string, error: PostgrestError | Error | null | undefined) {
  const desc = describeSupabaseError(error)
  if (isMissingSchema(error)) {
    if (bootFailureWarned) return
    bootFailureWarned = true
    console.warn(
      `[syncdesk] ${context}: ${desc.message}` +
        (desc.code ? ` (code ${desc.code})` : "") +
        ".\n" +
        "Falling back to local-only data. Apply supabase/migrations/0001_syncdesk_core.sql " +
        "in your Supabase SQL editor (or via the CLI) and refresh. " +
        "If you don't need cloud sync, leave NEXT_PUBLIC_SUPABASE_URL/ANON_KEY unset."
    )
    return
  }
  console.warn(`[syncdesk] ${context}:`, desc)
}

type DbWorkspace = {
  id: string
  slug: string | null
  name: string
  icon: string
  expanded: boolean
  member_ids: string[] | null
  sort_order: number
  owner_id?: string
}

type DbBoard = {
  id: string
  workspace_id: string
  created_by: string
  name: string
  description: string | null
  settings: unknown
  sort_order: number
}

type DbTask = {
  id: string
  board_id: string
  title: string
  description: string
  column_id: string
  tags: string[] | null
  priority: string
  due: string
  overdue: boolean
  comments_count: number
  attachments_count: number
  assignees: unknown
  progress: number
  /** Added by migration 0004. Older databases may not return this. */
  created_at?: string | null
  /** Added by migration 0004. Cleared automatically when leaving the
   * completed column via a server trigger. */
  completed_at?: string | null
  sort_order?: number | null
  checklist?: unknown
  task_comments?: unknown
  updated_at?: string | null
}

function parseTimestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : undefined
}

function mapTask(r: DbTask): BoardTask {
  const columnId = isKanbanColumnId(r.column_id) ? r.column_id : "todo"
  const checklist = Array.isArray(r.checklist) ? (r.checklist as TaskChecklistItem[]) : []
  const taskComments = Array.isArray(r.task_comments)
    ? (r.task_comments as TaskComment[])
    : []
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    columnId,
    tags: r.tags ?? [],
    priority: r.priority as BoardTask["priority"],
    due: r.due,
    overdue: r.overdue,
    comments: taskComments.length > 0 ? taskComments.length : r.comments_count,
    attachments: r.attachments_count,
    assignees: Array.isArray(r.assignees) ? (r.assignees as BoardTask["assignees"]) : [],
    progress: r.progress,
    createdAt: parseTimestamp(r.created_at),
    completedAt: parseTimestamp(r.completed_at),
    sortOrder: typeof r.sort_order === "number" ? r.sort_order : 0,
    checklist,
    taskComments,
    updatedAt: parseTimestamp(r.updated_at),
  }
}

function serializeTaskInsertRow(task: Omit<BoardTask, "id">, userId: string, boardId: string) {
  const comments = task.taskComments ?? []
  return {
    user_id: userId,
    board_id: boardId,
    title: task.title,
    description: task.description,
    column_id: task.columnId,
    tags: task.tags,
    priority: task.priority,
    due: task.due,
    overdue: task.overdue,
    comments_count: comments.length || task.comments,
    attachments_count: task.attachments,
    assignees: task.assignees,
    progress: task.progress,
    sort_order: task.sortOrder ?? 0,
    checklist: task.checklist ?? [],
    task_comments: comments,
    updated_at: new Date().toISOString(),
    ...serializeTaskTimestamps(task),
  }
}

function serializeTaskUpdateRow(task: BoardTask, userId: string, boardId: string) {
  return {
    id: task.id,
    ...serializeTaskInsertRow(task, userId, boardId),
  }
}

function mapBoard(r: DbBoard): BoardMeta {
  const settings =
    r.settings && typeof r.settings === "object" ? (r.settings as BoardMeta["settings"]) : undefined
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    name: r.name,
    description: r.description ?? undefined,
    settings,
  }
}

export async function pullRemoteBoardsState(
  client: SupabaseClient,
  userId: string
): Promise<BoardsBundle | null> {
  const [ownedRes, membershipRes] = await Promise.all([
    client.from("workspaces").select("*").eq("owner_id", userId).order("sort_order", { ascending: true }),
    client.from("workspace_members").select("workspace_id").eq("user_id", userId),
  ])

  if (ownedRes.error || !ownedRes.data) {
    logBootFailure("pull workspaces", ownedRes.error)
    return null
  }

  const ownedRaw = ownedRes.data as DbWorkspace[]
  const memberWorkspaceIds = new Set(
    ((membershipRes.data as { workspace_id: string }[] | null) ?? []).map((r) => r.workspace_id)
  )
  for (const ws of ownedRaw) memberWorkspaceIds.delete(ws.id)

  let sharedRaw: DbWorkspace[] = []
  if (memberWorkspaceIds.size > 0) {
    const sharedRes = await client
      .from("workspaces")
      .select("*")
      .in("id", Array.from(memberWorkspaceIds))
      .order("sort_order", { ascending: true })
    if (sharedRes.error || !sharedRes.data) {
      logBootFailure("pull shared workspaces", sharedRes.error)
      return null
    }
    sharedRaw = sharedRes.data as DbWorkspace[]
  }

  const workspacesRaw = [...ownedRaw, ...sharedRaw].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )
  const workspaceIds = workspacesRaw.map((w) => w.id)

  if (workspaceIds.length === 0) {
    return { workspaces: [], boardsById: {}, tasksByBoardId: {}, teamMembers: [] }
  }

  const [boardsRes, membersByWorkspace] = await Promise.all([
    client.from("boards").select("*").in("workspace_id", workspaceIds).order("sort_order", { ascending: true }),
    fetchWorkspaceMembersForWorkspaces(client, workspaceIds),
  ])

  if (boardsRes.error || !boardsRes.data) {
    logBootFailure("pull boards", boardsRes.error)
    return null
  }

  const boardsRaw = boardsRes.data as DbBoard[]
  const boardIds = boardsRaw.map((b) => b.id)

  let tasksRaw: DbTask[] = []
  if (boardIds.length > 0) {
    const tasksRes = await client
      .from("board_tasks")
      .select("*")
      .in("board_id", boardIds)
      .order("sort_order", { ascending: true })
    if (tasksRes.error || !tasksRes.data) {
      logBootFailure("pull tasks", tasksRes.error)
      return null
    }
    tasksRaw = tasksRes.data as DbTask[]
  }

  const boardsById: Record<string, BoardMeta> = {}
  for (const b of boardsRaw) {
    boardsById[b.id] = mapBoard(b as DbBoard)
  }

  const tasksByBoardId: Record<string, BoardTask[]> = {}
  for (const t of tasksRaw) {
    const arr = tasksByBoardId[t.board_id] ?? []
    arr.push(mapTask(t as DbTask))
    tasksByBoardId[t.board_id] = arr
  }

  const workspaces: WorkspaceEntity[] = workspacesRaw.map((ws) => {
    const boardIdsForWs = boardsRaw
      .filter((b) => b.workspace_id === ws.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((b) => b.id)
    const roster = membersByWorkspace[ws.id] ?? []
    const memberIds =
      roster.length > 0
        ? roster.map((m) => m.id)
        : (ws.member_ids ?? []).length > 0
          ? (ws.member_ids ?? [])
          : [ws.owner_id ?? userId].filter(Boolean)
    return {
      id: ws.id,
      slug: ws.slug ?? ws.id,
      name: ws.name,
      icon: ws.icon,
      expanded: ws.expanded,
      boardIds: boardIdsForWs,
      memberIds,
    }
  })

  const teamMemberMap = new Map<string, TeamMember>()
  for (const roster of Object.values(membersByWorkspace)) {
    for (const m of roster) teamMemberMap.set(m.id, m)
  }
  const teamMembers = Array.from(teamMemberMap.values())

  return { workspaces, boardsById, tasksByBoardId, teamMembers }
}

/**
 * Returns true once the Supabase boards schema is reachable for this user.
 * Production accounts start with zero workspaces / boards / tasks — they
 * appear only when the user explicitly creates them. This function used to
 * push demo seed rows on first sign-in; that behaviour has been removed so
 * analytics and dashboards always reflect real activity.
 */
export async function ensureBoardsSchemaReady(
  client: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { error } = await client
    .from("workspaces")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
  if (error) {
    logBootFailure("ensure boards schema", error)
    return false
  }
  return true
}

export function subscribeBoardsRealtime(
  client: SupabaseClient,
  userId: string,
  onChange: () => void
): () => void {
  let t: ReturnType<typeof setTimeout> | undefined
  const debounced = () => {
    if (t) clearTimeout(t)
    t = setTimeout(() => {
      onChange()
    }, 450)
  }

  const unsubscribe = subscribeToPostgresChanges(client, {
    topic: `syncdesk-boards-${userId}`,
    bindings: [
      { event: "*", schema: "public", table: "workspaces", filter: `owner_id=eq.${userId}` },
      // No user_id filter: RLS limits events to rows in workspaces the user can see.
      { event: "*", schema: "public", table: "workspace_members" },
      { event: "*", schema: "public", table: "boards" },
      { event: "*", schema: "public", table: "board_tasks" },
    ],
    onChange: debounced,
  })

  return () => {
    if (t) clearTimeout(t)
    unsubscribe()
  }
}

export async function remoteInsertWorkspace(
  client: SupabaseClient,
  userId: string,
  row: {
    id: string
    slug: string
    name: string
    icon: string
    expanded: boolean
    memberIds: string[]
    sortOrder: number
  }
) {
  const insert = await client.from("workspaces").insert({
    id: row.id,
    owner_id: userId,
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    expanded: row.expanded,
    member_ids: [userId],
    sort_order: row.sortOrder,
  })
  if (!insert.error) {
    await remoteInsertWorkspaceOwner(client, row.id, userId)
  }
  return insert
}

export async function remoteUpdateWorkspace(
  client: SupabaseClient,
  workspaceId: string,
  patch: { name?: string; icon?: string; expanded?: boolean; memberIds?: string[] }
) {
  const payload: Record<string, unknown> = {}
  if (typeof patch.name === "string") payload.name = patch.name
  if (typeof patch.icon === "string") payload.icon = patch.icon
  if (typeof patch.expanded === "boolean") payload.expanded = patch.expanded
  if (patch.memberIds) payload.member_ids = patch.memberIds
  return client.from("workspaces").update(payload).eq("id", workspaceId)
}

export async function remoteDeleteWorkspace(client: SupabaseClient, workspaceId: string) {
  return client.from("workspaces").delete().eq("id", workspaceId)
}

export async function remoteNextBoardSortOrder(
  client: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { data, error } = await client
    .from("boards")
    .select("sort_order")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: false })
    .limit(1)
  if (error || !data?.length) return 0
  const v = (data[0] as { sort_order: number }).sort_order
  return typeof v === "number" ? v + 1 : 0
}

export async function remoteInsertBoard(
  client: SupabaseClient,
  row: {
    workspaceId: string
    name: string
    description?: string
    settings?: BoardMeta["settings"]
    sortOrder: number
  }
) {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser()
  if (authError || !user?.id) {
    const message = authError?.message ?? "You must be signed in to create a board."
    return {
      data: null,
      error: { message, details: "", hint: "", code: "401" } as PostgrestError,
    }
  }

  const { data, error } = await client
    .from("boards")
    .insert({
      created_by: user.id,
      workspace_id: row.workspaceId,
      name: row.name,
      description: row.description ?? "",
      settings: row.settings ?? null,
      sort_order: row.sortOrder,
    })
    .select("*")
    .single()

  if (error) {
    return { data: null, error }
  }
  if (!data) {
    return {
      data: null,
      error: { message: "No board row returned.", details: "", hint: "", code: "PGRST116" } as PostgrestError,
    }
  }
  return { data: mapBoard(data as DbBoard), error: null }
}

export async function remoteUpdateBoardMeta(
  client: SupabaseClient,
  boardId: string,
  patch: { name?: string; description?: string | null }
) {
  const payload: Record<string, unknown> = {}
  if (typeof patch.name === "string") payload.name = patch.name
  if (patch.description !== undefined) payload.description = patch.description
  return client.from("boards").update(payload).eq("id", boardId)
}

export async function remoteUpdateBoardSettings(
  client: SupabaseClient,
  boardId: string,
  settings: BoardMeta["settings"]
) {
  return client.from("boards").update({ settings }).eq("id", boardId)
}

export async function remoteRenameBoard(client: SupabaseClient, boardId: string, name: string) {
  return client.from("boards").update({ name }).eq("id", boardId)
}

export async function remoteDeleteBoard(client: SupabaseClient, boardId: string) {
  return client.from("boards").delete().eq("id", boardId)
}

function serializeTaskTimestamps(
  task: Pick<BoardTask, "columnId" | "createdAt" | "completedAt">
) {
  // `created_at` is omitted on inserts so Supabase applies the column default
  // (`now()`); only set it if the client already knows the value (e.g.
  // duplicate-board flow re-inserting an existing task). `completed_at` is
  // null unless the task is in the completed column — the server trigger will
  // also enforce this, but writing it explicitly keeps optimistic UIs in sync.
  const payload: Record<string, unknown> = {}
  if (typeof task.createdAt === "number" && Number.isFinite(task.createdAt)) {
    payload.created_at = new Date(task.createdAt).toISOString()
  }
  if (task.columnId === "completed") {
    payload.completed_at =
      typeof task.completedAt === "number" && Number.isFinite(task.completedAt)
        ? new Date(task.completedAt).toISOString()
        : new Date().toISOString()
  } else {
    payload.completed_at = null
  }
  return payload
}

export async function remoteInsertTasks(
  client: SupabaseClient,
  userId: string,
  boardId: string,
  tasks: Omit<BoardTask, "id">[]
) {
  if (tasks.length === 0) {
    return { data: [] as BoardTask[], error: null }
  }
  const rows = tasks.map((t) => serializeTaskInsertRow(t, userId, boardId))
  const { data, error } = await client.from("board_tasks").insert(rows).select("*")
  if (error || !data) {
    return { data: null, error: error ?? null }
  }
  return { data: (data as DbTask[]).map(mapTask), error: null }
}

export async function remoteMoveTask(
  client: SupabaseClient,
  taskId: string,
  columnId: KanbanColumnId,
  sortOrder?: number
) {
  const payload: Record<string, unknown> = {
    column_id: columnId,
    updated_at: new Date().toISOString(),
  }
  if (typeof sortOrder === "number") payload.sort_order = sortOrder
  if (columnId === "completed") {
    payload.completed_at = new Date().toISOString()
  } else {
    payload.completed_at = null
  }
  return client.from("board_tasks").update(payload).eq("id", taskId)
}

export async function remoteSyncTaskOrders(
  client: SupabaseClient,
  updates: { id: string; columnId: KanbanColumnId; sortOrder: number }[]
) {
  const results = await Promise.all(
    updates.map((u) =>
      client
        .from("board_tasks")
        .update({
          column_id: u.columnId,
          sort_order: u.sortOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", u.id)
    )
  )
  const error = results.find((r) => r.error)?.error ?? null
  return { error }
}

export async function remoteUpdateTaskRow(
  client: SupabaseClient,
  userId: string,
  boardId: string,
  task: BoardTask
) {
  return client
    .from("board_tasks")
    .update(serializeTaskUpdateRow(task, userId, boardId))
    .eq("id", task.id)
}

export async function remoteInsertTask(
  client: SupabaseClient,
  userId: string,
  boardId: string,
  task: Omit<BoardTask, "id">
) {
  const { data, error } = await client
    .from("board_tasks")
    .insert(serializeTaskInsertRow(task, userId, boardId))
    .select("*")
    .single()

  if (error) {
    return { data: null, error }
  }
  if (!data) {
    return {
      data: null,
      error: { message: "No task row returned.", details: "", hint: "", code: "PGRST116" } as PostgrestError,
    }
  }
  return { data: mapTask(data as DbTask), error: null }
}

export async function remoteDeleteTask(client: SupabaseClient, taskId: string) {
  return client.from("board_tasks").delete().eq("id", taskId)
}
