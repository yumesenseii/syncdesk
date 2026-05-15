/** Persisted `activity_events.event_type` values. */
export const ACTIVITY_EVENT_TYPES = [
  "workspace_created",
  "workspace_updated",
  "workspace_deleted",
  "member_invited",
  "member_joined",
  "member_removed",
  "board_created",
  "board_updated",
  "board_archived",
  "board_deleted",
  "task_created",
  "task_updated",
  "task_completed",
  "task_moved",
  "task_deleted",
  "task_assigned",
  "due_date_changed",
  "checklist_completed",
  "comment_added",
  "meeting_created",
  "meeting_updated",
  "meeting_deleted",
] as const

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number]

export type ActivityEventMetadata = {
  workspace_name?: string
  workspace_slug?: string
  board_name?: string
  task_title?: string
  invited_email?: string
  member_email?: string
  assignee_user_id?: string
  assignee_name?: string
  from_column?: string
  to_column?: string
  from_column_label?: string
  to_column_label?: string
  due_date?: string
  previous_due?: string
  priority?: string
  comment_preview?: string
  fields?: string[]
  meeting_title?: string
  meeting_start_at?: string
  /** Workspace that was removed (event may live on another workspace_id) */
  deleted_workspace_id?: string
  deleted_workspace_name?: string
  deleted_workspace_slug?: string
  /** Inbox: current user was assigned */
  inbox_for_user_id?: string
}

export type ActivityEventRow = {
  id: string
  workspace_id: string | null
  board_id: string | null
  task_id: string | null
  meeting_id: string | null
  actor_user_id: string
  actor_name: string | null
  actor_avatar_url: string | null
  event_type: ActivityEventType
  summary: string
  metadata: ActivityEventMetadata
  created_at: string
}
