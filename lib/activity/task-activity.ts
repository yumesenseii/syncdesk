import type { BoardMeta, BoardTask, TeamMember } from "@/lib/boards/types"

import type { ActivityEventMetadata } from "./activity-event-types"
import { columnLabel } from "./column-labels"
import { logActivity } from "./log-activity"

function workspaceContext(
  workspaceId: string,
  workspace?: { name: string; slug: string } | null,
  board?: BoardMeta | null
): ActivityEventMetadata {
  return {
    workspace_name: workspace?.name,
    workspace_slug: workspace?.slug,
    board_name: board?.name,
    task_title: undefined,
  }
}

function taskMeta(
  task: BoardTask,
  board: BoardMeta | undefined,
  workspace?: { name: string; slug: string } | null,
  extra?: ActivityEventMetadata
): ActivityEventMetadata {
  return {
    ...workspaceContext(board?.workspaceId ?? "", workspace, board),
    task_title: task.title,
    priority: task.priority,
    ...extra,
  }
}

export function logWorkspaceCreated(
  workspaceId: string,
  name: string,
  slug: string
) {
  logActivity({
    workspaceId,
    eventType: "workspace_created",
    summary: `created workspace ${name}`,
    metadata: { workspace_name: name, workspace_slug: slug },
  })
}

export function logWorkspaceUpdated(workspaceId: string, name: string, slug: string) {
  logActivity({
    workspaceId,
    eventType: "workspace_updated",
    summary: `updated workspace ${name}`,
    metadata: { workspace_name: name, workspace_slug: slug },
  })
}

/**
 * Log workspace deletion on `anchorWorkspaceId` so the event survives DB cascade.
 * When deleting the last workspace, pass the deleted id as anchor (row becomes orphan via SET NULL).
 */
export function logWorkspaceDeleted(
  anchorWorkspaceId: string,
  deleted: { id: string; name: string; slug: string },
  anchor?: { name: string; slug: string } | null
) {
  logActivity({
    workspaceId: anchorWorkspaceId,
    eventType: "workspace_deleted",
    summary: `deleted workspace ${deleted.name}`,
    metadata: {
      workspace_name: anchor?.name ?? deleted.name,
      workspace_slug: anchor?.slug ?? deleted.slug,
      deleted_workspace_id: deleted.id,
      deleted_workspace_name: deleted.name,
      deleted_workspace_slug: deleted.slug,
    },
  })
}

export function logMemberInvited(
  workspaceId: string,
  email: string,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    eventType: "member_invited",
    summary: `invited ${email}`,
    metadata: {
      invited_email: email,
      workspace_name: workspace?.name,
      workspace_slug: workspace?.slug,
    },
  })
}

export function logMemberJoined(
  workspaceId: string,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    eventType: "member_joined",
    summary: `joined ${workspace?.name ?? "workspace"}`,
    metadata: {
      workspace_name: workspace?.name,
      workspace_slug: workspace?.slug,
    },
  })
}

export function logBoardCreated(
  workspaceId: string,
  board: BoardMeta,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    boardId: board.id,
    eventType: "board_created",
    summary: `created board ${board.name}`,
    metadata: {
      ...workspaceContext(workspaceId, workspace, board),
      board_name: board.name,
    },
  })
}

export function logBoardUpdated(
  workspaceId: string,
  board: BoardMeta,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    boardId: board.id,
    eventType: "board_updated",
    summary: `updated board ${board.name}`,
    metadata: workspaceContext(workspaceId, workspace, board),
  })
}

export function logBoardDeleted(
  workspaceId: string,
  boardName: string,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    eventType: "board_deleted",
    summary: `deleted board ${boardName}`,
    metadata: {
      board_name: boardName,
      workspace_name: workspace?.name,
      workspace_slug: workspace?.slug,
    },
  })
}

export function logTaskCreated(
  workspaceId: string,
  board: BoardMeta,
  task: BoardTask,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    boardId: board.id,
    taskId: task.id,
    eventType: "task_created",
    summary: `created task ${task.title}`,
    metadata: taskMeta(task, board, workspace),
  })
}

export function logTaskMoved(
  workspaceId: string,
  board: BoardMeta,
  task: BoardTask,
  fromColumn: string,
  toColumn: string,
  workspace?: { name: string; slug: string }
) {
  const fromLabel = columnLabel(fromColumn)
  const toLabel = columnLabel(toColumn)
  logActivity({
    workspaceId,
    boardId: board.id,
    taskId: task.id,
    eventType: "task_moved",
    summary: `moved task ${task.title} to ${toLabel}`,
    metadata: taskMeta(task, board, workspace, {
      from_column: fromColumn,
      to_column: toColumn,
      from_column_label: fromLabel,
      to_column_label: toLabel,
    }),
  })
}

export function logTaskCompleted(
  workspaceId: string,
  board: BoardMeta,
  task: BoardTask,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    boardId: board.id,
    taskId: task.id,
    eventType: "task_completed",
    summary: `completed task ${task.title}`,
    metadata: taskMeta(task, board, workspace),
  })
}

export function logTaskAssigned(
  workspaceId: string,
  board: BoardMeta,
  task: BoardTask,
  assignee: TeamMember,
  workspace?: { name: string; slug: string }
) {
  const assigneeUserId = assignee.userId ?? assignee.id
  logActivity({
    workspaceId,
    boardId: board.id,
    taskId: task.id,
    eventType: "task_assigned",
    summary: `assigned task ${task.title} to ${assignee.name}`,
    metadata: taskMeta(task, board, workspace, {
      assignee_user_id: assigneeUserId,
      assignee_name: assignee.name,
      inbox_for_user_id: assigneeUserId,
    }),
  })
}

export function logDueDateChanged(
  workspaceId: string,
  board: BoardMeta,
  task: BoardTask,
  due: string,
  previousDue: string | undefined,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    boardId: board.id,
    taskId: task.id,
    eventType: "due_date_changed",
    summary: `set due date on ${task.title}`,
    metadata: taskMeta(task, board, workspace, {
      due_date: due,
      previous_due: previousDue,
    }),
  })
}

export function logChecklistCompleted(
  workspaceId: string,
  board: BoardMeta,
  task: BoardTask,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    boardId: board.id,
    taskId: task.id,
    eventType: "checklist_completed",
    summary: `completed checklist on ${task.title}`,
    metadata: taskMeta(task, board, workspace),
  })
}

export function logCommentAdded(
  workspaceId: string,
  board: BoardMeta,
  task: BoardTask,
  preview: string,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    boardId: board.id,
    taskId: task.id,
    eventType: "comment_added",
    summary: `commented on ${task.title}`,
    metadata: taskMeta(task, board, workspace, {
      comment_preview: preview.slice(0, 120),
    }),
  })
}

export function logTaskUpdated(
  workspaceId: string,
  board: BoardMeta,
  task: BoardTask,
  fields: string[],
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    boardId: board.id,
    taskId: task.id,
    eventType: "task_updated",
    summary: `updated task ${task.title}`,
    metadata: taskMeta(task, board, workspace, { fields }),
  })
}

export function logTaskDeleted(
  workspaceId: string,
  board: BoardMeta,
  task: BoardTask,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    boardId: board.id,
    eventType: "task_deleted",
    summary: `deleted task ${task.title}`,
    metadata: taskMeta(task, board, workspace),
  })
}

export function logMeetingCreated(
  workspaceId: string,
  meetingId: string,
  title: string,
  startAtIso: string,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    meetingId,
    eventType: "meeting_created",
    summary: `scheduled meeting ${title}`,
    metadata: {
      workspace_name: workspace?.name,
      workspace_slug: workspace?.slug,
      meeting_title: title,
      meeting_start_at: startAtIso,
    },
  })
}

export function logMeetingUpdated(
  workspaceId: string,
  meetingId: string,
  title: string,
  startAtIso: string,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    meetingId,
    eventType: "meeting_updated",
    summary: `updated meeting ${title}`,
    metadata: {
      workspace_name: workspace?.name,
      workspace_slug: workspace?.slug,
      meeting_title: title,
      meeting_start_at: startAtIso,
    },
  })
}

export function logMeetingDeleted(
  workspaceId: string,
  meetingId: string,
  title: string,
  workspace?: { name: string; slug: string }
) {
  logActivity({
    workspaceId,
    meetingId,
    eventType: "meeting_deleted",
    summary: `cancelled meeting ${title}`,
    metadata: {
      workspace_name: workspace?.name,
      workspace_slug: workspace?.slug,
      meeting_title: title,
    },
  })
}

/** Compare previous and next task; emit focused events (no generic spam). */
export function logTaskChanges(
  workspaceId: string,
  board: BoardMeta,
  prev: BoardTask,
  next: BoardTask,
  teamById: Map<string, TeamMember>,
  workspace?: { name: string; slug: string }
) {
  if (prev.columnId !== "completed" && next.columnId === "completed") {
    logTaskCompleted(workspaceId, board, next, workspace)
    return
  }

  if (prev.columnId !== next.columnId && next.columnId !== "completed") {
    logTaskMoved(workspaceId, board, next, prev.columnId, next.columnId, workspace)
    return
  }

  const prevAssignee = prev.assignees[0]?.id
  const nextAssignee = next.assignees[0]?.id
  if (prevAssignee !== nextAssignee && nextAssignee) {
    const assignee = teamById.get(nextAssignee)
    if (assignee) {
      logTaskAssigned(workspaceId, board, next, assignee, workspace)
      return
    }
  }

  if (prev.due !== next.due && next.due) {
    logDueDateChanged(workspaceId, board, next, next.due, prev.due || undefined, workspace)
    return
  }

  const prevDone = prev.checklist?.filter((c) => c.done).length ?? 0
  const nextDone = next.checklist?.filter((c) => c.done).length ?? 0
  const prevTotal = prev.checklist?.length ?? 0
  const nextTotal = next.checklist?.length ?? 0
  if (
    nextTotal > 0 &&
    nextDone === nextTotal &&
    prevDone < nextTotal
  ) {
    logChecklistCompleted(workspaceId, board, next, workspace)
    return
  }

  const changed: string[] = []
  if (prev.title !== next.title) changed.push("title")
  if (prev.description !== next.description) changed.push("description")
  if (prev.priority !== next.priority) changed.push("priority")
  if (prev.tags?.join() !== next.tags?.join()) changed.push("tags")

  if (changed.length > 0) {
    logTaskUpdated(workspaceId, board, next, changed, workspace)
  }
}
