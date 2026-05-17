import type { SupabaseClient } from "@supabase/supabase-js"

import type { BoardMeta, BoardTask, TeamMember } from "@/lib/boards/types"
import { columnLabel } from "@/lib/activity/column-labels"
import type { CreateNotificationInput } from "@/lib/notifications/types"
import { createNotifications } from "@/lib/syncdesk/notifications-remote"
import { fetchWorkspaceMembersDetail } from "@/lib/syncdesk/workspace-members-remote"

const MENTION_RE = /@([a-zA-Z0-9._-]+)/g

function excludeActor(recipients: Set<string>, actorId: string) {
  recipients.delete(actorId)
}

function assigneeUserIds(task: BoardTask): string[] {
  return task.assignees.map((a) => a.id).filter(Boolean)
}

function parseMentionedUserIds(text: string, members: TeamMember[]): string[] {
  const handles = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = MENTION_RE.exec(text)) !== null) {
    const token = match[1].toLowerCase()
    if (token) handles.add(token)
  }
  if (handles.size === 0) return []

  const ids: string[] = []
  for (const m of members) {
    const nameKey = m.name.toLowerCase().replace(/\s+/g, "")
    const emailLocal = m.email?.split("@")[0]?.toLowerCase()
    if (handles.has(nameKey) || (emailLocal && handles.has(emailLocal))) {
      ids.push(m.id)
    }
  }
  return ids
}

async function loadWorkspaceMembers(
  client: SupabaseClient,
  workspaceId: string
): Promise<TeamMember[]> {
  try {
    return await fetchWorkspaceMembersDetail(client, workspaceId)
  } catch {
    return []
  }
}

function pushRow(
  rows: CreateNotificationInput[],
  row: CreateNotificationInput
) {
  rows.push(row)
}

export async function dispatchTaskChangeNotifications(options: {
  client: SupabaseClient
  actorId: string
  actorName: string
  workspaceId: string
  workspaceName?: string
  board: BoardMeta
  prev: BoardTask
  next: BoardTask
  teamById: Map<string, TeamMember>
}) {
  const { client, actorId, actorName, workspaceId, workspaceName, board, prev, next, teamById } =
    options
  const members = await loadWorkspaceMembers(client, workspaceId)
  const memberMap = new Map(members.map((m) => [m.id, m]))
  for (const [id, m] of teamById) memberMap.set(id, m)

  const rows: CreateNotificationInput[] = []
  const base = {
    actorId,
    workspaceId,
    boardId: board.id,
    taskId: next.id,
  }

  const prevComments = prev.taskComments?.length ?? prev.comments ?? 0
  const nextComments = next.taskComments?.length ?? next.comments ?? 0
  if (nextComments > prevComments) {
    const last = next.taskComments?.[next.taskComments.length - 1]
    const preview = last?.text ?? "New comment"
    const recipients = new Set(assigneeUserIds(next))
    for (const id of parseMentionedUserIds(preview, members)) {
      recipients.add(id)
    }
    excludeActor(recipients, actorId)

    for (const userId of recipients) {
      pushRow(rows, {
        ...base,
        userId,
        type: "task_comment",
        title: "New comment",
        message: `${actorName} commented on ${next.title}`,
      })
    }

    const mentionOnly = new Set(parseMentionedUserIds(preview, members))
    excludeActor(mentionOnly, actorId)
    for (const userId of mentionOnly) {
      if (recipients.has(userId)) continue
      pushRow(rows, {
        ...base,
        userId,
        type: "mention",
        title: "You were mentioned",
        message: `${actorName} mentioned you on ${next.title}`,
      })
    }
  }

  const prevAssigneeIds = new Set(prev.assignees.map((a) => a.id))
  for (const a of next.assignees) {
    if (!prevAssigneeIds.has(a.id) && a.id !== actorId) {
      pushRow(rows, {
        ...base,
        userId: a.id,
        type: "task_assigned",
        title: "Task assigned to you",
        message: `${actorName} assigned ${next.title} to you`,
      })
    }
  }

  if (prev.columnId !== "completed" && next.columnId === "completed") {
    const recipients = new Set(assigneeUserIds(next))
    excludeActor(recipients, actorId)
    for (const userId of recipients) {
      pushRow(rows, {
        ...base,
        userId,
        type: "task_completed",
        title: "Task completed",
        message: `${actorName} completed ${next.title}`,
      })
    }
    await createNotifications(client, rows)
    return
  }

  if (prev.columnId !== next.columnId && next.columnId !== "completed") {
    const recipients = new Set(assigneeUserIds(next))
    excludeActor(recipients, actorId)
    const toLabel = columnLabel(next.columnId)
    for (const userId of recipients) {
      pushRow(rows, {
        ...base,
        userId,
        type: "task_status_changed",
        title: "Task updated",
        message: `${actorName} moved ${next.title} to ${toLabel}`,
      })
    }
    await createNotifications(client, rows)
    return
  }

  if (rows.length > 0) {
    await createNotifications(client, rows)
  }
}

export async function dispatchBoardCreatedNotifications(options: {
  client: SupabaseClient
  actorId: string
  actorName: string
  workspaceId: string
  workspaceName?: string
  board: BoardMeta
  /** When false, only owners/admins are notified. Default true = all members. */
  notifyAllMembers?: boolean
}) {
  const {
    client,
    actorId,
    actorName,
    workspaceId,
    workspaceName,
    board,
    notifyAllMembers = true,
  } = options

  const members = await loadWorkspaceMembers(client, workspaceId)
  const recipients = new Set<string>()

  if (notifyAllMembers) {
    for (const m of members) recipients.add(m.id)
  } else {
    for (const m of members) {
      if (m.role === "owner" || m.role === "admin") recipients.add(m.id)
    }
  }
  excludeActor(recipients, actorId)

  const rows: CreateNotificationInput[] = [...recipients].map((userId) => ({
    userId,
    actorId,
    workspaceId,
    boardId: board.id,
    type: "board_created",
    title: "New board",
    message: `${actorName} created ${board.name} in ${workspaceName ?? "your workspace"}`,
  }))

  await createNotifications(client, rows)
}

export async function dispatchDueReminderNotifications(options: {
  client: SupabaseClient
  actorId: string
  workspaceId: string
  boardId: string
  taskId: string
  taskTitle: string
  recipientIds: string[]
  dueLabel: string
}) {
  const { client, actorId, workspaceId, boardId, taskId, taskTitle, recipientIds, dueLabel } =
    options
  const rows: CreateNotificationInput[] = recipientIds
    .filter((id) => id !== actorId)
    .map((userId) => ({
      userId,
      actorId,
      workspaceId,
      boardId,
      taskId,
      type: "due_reminder",
      title: "Due date reminder",
      message: `${taskTitle} is due ${dueLabel}`,
    }))
  await createNotifications(client, rows)
}
