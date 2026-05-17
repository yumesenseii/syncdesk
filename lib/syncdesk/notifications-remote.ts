import type { SupabaseClient } from "@supabase/supabase-js"

import type { AppNotification, CreateNotificationInput } from "@/lib/notifications/types"

const NOTIFICATION_SELECT =
  "id, user_id, actor_id, workspace_id, board_id, task_id, type, title, message, is_read, created_at"

type DbNotificationRow = {
  id: string
  user_id: string
  actor_id: string | null
  workspace_id: string | null
  board_id: string | null
  task_id: string | null
  type: string
  title: string
  message: string | null
  is_read: boolean
  created_at: string
}

type DbProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

type DbWorkspaceRow = {
  id: string
  slug: string
}

function mapRow(
  row: DbNotificationRow,
  actors: Map<string, DbProfileRow>,
  slugs: Map<string, string>
): AppNotification {
  const actor = row.actor_id ? actors.get(row.actor_id) : undefined
  return {
    id: row.id,
    userId: row.user_id,
    actorId: row.actor_id,
    workspaceId: row.workspace_id,
    boardId: row.board_id,
    taskId: row.task_id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at,
    actorName: actor?.display_name?.trim() || null,
    actorAvatarUrl: actor?.avatar_url ?? null,
    workspaceSlug: row.workspace_id ? slugs.get(row.workspace_id) ?? null : null,
  }
}

export async function fetchNotificationsPage(
  client: SupabaseClient,
  userId: string,
  options?: { limit?: number; before?: string }
) {
  const limit = options?.limit ?? 20
  let query = client
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (options?.before) {
    query = query.lt("created_at", options.before)
  }

  const { data, error } = await query
  if (error) return { data: [] as AppNotification[], error }

  const rows = (data ?? []) as DbNotificationRow[]
  if (rows.length === 0) return { data: [], error: null }

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[]
  const workspaceIds = [...new Set(rows.map((r) => r.workspace_id).filter(Boolean))] as string[]

  const [actorsRes, workspacesRes] = await Promise.all([
    actorIds.length > 0
      ? client.from("profiles").select("id, display_name, avatar_url").in("id", actorIds)
      : Promise.resolve({ data: [] as DbProfileRow[], error: null }),
    workspaceIds.length > 0
      ? client.from("workspaces").select("id, slug").in("id", workspaceIds)
      : Promise.resolve({ data: [] as DbWorkspaceRow[], error: null }),
  ])

  const actors = new Map(
    ((actorsRes.data ?? []) as DbProfileRow[]).map((p) => [p.id, p])
  )
  const slugs = new Map(
    ((workspacesRes.data ?? []) as DbWorkspaceRow[]).map((w) => [w.id, w.slug])
  )

  return {
    data: rows.map((r) => mapRow(r, actors, slugs)),
    error: null,
  }
}

export async function fetchUnreadNotificationCount(client: SupabaseClient, userId: string) {
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)
  return { count: count ?? 0, error }
}

export async function createNotifications(
  client: SupabaseClient,
  rows: CreateNotificationInput[]
) {
  if (rows.length === 0) return { error: null }
  const payload = rows.map((r) => ({
    user_id: r.userId,
    actor_id: r.actorId ?? undefined,
    workspace_id: r.workspaceId ?? undefined,
    board_id: r.boardId ?? undefined,
    task_id: r.taskId ?? undefined,
    type: r.type,
    title: r.title,
    message: r.message ?? undefined,
  }))
  return client.rpc("create_notifications", { p_rows: payload })
}

export async function markNotificationRead(client: SupabaseClient, id: string) {
  return client.from("notifications").update({ is_read: true }).eq("id", id)
}

export async function markAllNotificationsRead(client: SupabaseClient, userId: string) {
  return client
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false)
}

/** @deprecated Use AppNotification */
export type AppNotificationRow = AppNotification
