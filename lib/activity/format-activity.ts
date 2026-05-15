import type { ActivityEventRow } from "@/lib/activity/activity-event-types"
import type { TeamMember } from "@/lib/boards/types"
import { colorForUserId, initialsFromName } from "@/lib/syncdesk/workspace-members-remote"

import type { ActivityEvent, ActivityType } from "./events"

function eventTypeToKind(eventType: string): ActivityType {
  switch (eventType) {
    case "workspace_created":
    case "board_created":
    case "task_created":
    case "meeting_created":
      return "created"
    case "workspace_deleted":
    case "board_deleted":
    case "task_deleted":
    case "meeting_deleted":
      return "updated"
    case "task_completed":
      return "completed"
    case "task_assigned":
    case "member_invited":
    case "member_joined":
    case "member_removed":
      return "assigned"
    case "comment_added":
      return "comment"
    case "due_date_changed":
      return "deadline"
  }
  return "updated"
}

function actorFromRow(
  row: ActivityEventRow,
  teamByUserId: Map<string, TeamMember>
): { actor: TeamMember | null; actorLabel: string } {
  const m = row.metadata ?? {}

  if (row.event_type === "member_joined" && m.member_email) {
    return { actor: null, actorLabel: String(m.member_email) }
  }

  const fromTeam = teamByUserId.get(row.actor_user_id)
  if (fromTeam) {
    return { actor: fromTeam, actorLabel: fromTeam.name }
  }

  const snapshotName = row.actor_name?.trim()
  if (snapshotName) {
    const actor: TeamMember = {
      id: row.actor_user_id,
      userId: row.actor_user_id,
      name: snapshotName,
      initials: initialsFromName(snapshotName),
      color: colorForUserId(row.actor_user_id),
      avatarUrl: row.actor_avatar_url ?? undefined,
    }
    return { actor, actorLabel: snapshotName }
  }

  return {
    actor: null,
    actorLabel: "Unknown member",
  }
}

function targetTitle(row: ActivityEventRow): string {
  const m = row.metadata ?? {}
  if (row.event_type === "workspace_deleted") {
    return m.deleted_workspace_name ?? m.workspace_name ?? row.summary
  }
  if (row.event_type === "member_joined" && m.workspace_name) {
    return m.workspace_name
  }
  if (row.event_type === "member_invited" && m.invited_email) {
    return m.invited_email
  }
  if (
    (row.event_type === "meeting_created" ||
      row.event_type === "meeting_updated" ||
      row.event_type === "meeting_deleted") &&
    m.meeting_title
  ) {
    return m.meeting_title
  }
  if (row.event_type === "task_moved" && m.task_title) {
    const to = m.to_column_label ?? m.to_column ?? ""
    return to ? `'${m.task_title}' to ${to}` : m.task_title
  }
  if (m.task_title) return m.task_title
  if (m.board_name) return m.board_name
  if (m.invited_email) return m.invited_email
  if (m.workspace_name) return m.workspace_name
  return row.summary
}

function buildSummary(row: ActivityEventRow): string {
  const m = row.metadata ?? {}
  switch (row.event_type) {
    case "workspace_created":
      return "created workspace"
    case "workspace_updated":
      return "updated workspace"
    case "workspace_deleted":
      return "deleted workspace"
    case "member_invited":
      return "invited"
    case "member_joined":
      return "joined"
    case "member_removed":
      return "removed a member from"
    case "board_created":
      return "created board"
    case "board_updated":
      return "updated board"
    case "board_archived":
      return "archived board"
    case "board_deleted":
      return "deleted board"
    case "task_created":
      return "created task"
    case "task_updated":
      return "updated task"
    case "task_completed":
      return "completed task"
    case "task_moved":
      return "moved task"
    case "task_deleted":
      return "deleted task"
    case "task_assigned": {
      const who = m.assignee_name ?? "a teammate"
      return `assigned task to ${who}`
    }
    case "due_date_changed":
      return m.due_date ? `set due date to ${m.due_date}` : "changed due date on task"
    case "checklist_completed":
      return "completed checklist on task"
    case "comment_added":
      return "commented on task"
    case "meeting_created":
      return "scheduled meeting"
    case "meeting_updated":
      return "updated meeting"
    case "meeting_deleted":
      return "cancelled meeting"
    default:
      return row.summary
  }
}

function buildMeta(row: ActivityEventRow): string | undefined {
  const m = row.metadata ?? {}
  if (row.event_type === "comment_added" && m.comment_preview) {
    return m.comment_preview
  }
  if (row.event_type === "task_moved" && m.from_column_label && m.to_column_label) {
    return `${m.from_column_label} → ${m.to_column_label}`
  }
  if (row.event_type === "due_date_changed" && m.previous_due) {
    return `was ${m.previous_due}`
  }
  if (
    (row.event_type === "meeting_created" || row.event_type === "meeting_updated") &&
    m.meeting_start_at
  ) {
    return m.meeting_start_at
  }
  return undefined
}

export function mapActivityRowToEvent(
  row: ActivityEventRow,
  teamByUserId: Map<string, TeamMember>
): ActivityEvent {
  const { actor, actorLabel } = actorFromRow(row, teamByUserId)
  const m = row.metadata ?? {}
  const ts = Date.parse(row.created_at)

  return {
    id: row.id,
    kind: eventTypeToKind(row.event_type),
    eventType: row.event_type,
    actor,
    actorLabel,
    summary: buildSummary(row),
    targetTitle: targetTitle(row),
    boardId: row.board_id ?? undefined,
    boardName: m.board_name,
    workspaceId: row.workspace_id ?? m.deleted_workspace_id ?? undefined,
    workspaceSlug: m.workspace_slug,
    workspaceName:
      row.event_type === "workspace_deleted"
        ? m.deleted_workspace_name ?? m.workspace_name
        : m.workspace_name,
    meetingId: row.meeting_id ?? undefined,
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
    priority: m.priority as ActivityEvent["priority"] | undefined,
    meta: buildMeta(row),
  }
}

export function mapActivityRowsToEvents(
  rows: ActivityEventRow[],
  teamMembers: TeamMember[]
): ActivityEvent[] {
  const teamByUserId = new Map<string, TeamMember>()
  for (const member of teamMembers) {
    if (member.userId) teamByUserId.set(member.userId, member)
    teamByUserId.set(member.id, member)
  }
  return rows.map((row) => mapActivityRowToEvent(row, teamByUserId))
}
