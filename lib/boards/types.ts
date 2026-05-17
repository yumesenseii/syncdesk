export type KanbanColumnId = "todo" | "in_progress" | "review" | "completed"

export type TaskPriority = "Low" | "Medium" | "High" | "Urgent"

export type BoardVisibility = "private" | "team" | "public"

export type WorkspaceMemberRole = "owner" | "admin" | "member" | "viewer"

export interface TeamMember {
  /** Auth user id — used for assignees and workspace membership. */
  id: string
  userId: string
  name: string
  initials: string
  color: string
  email?: string
  role?: WorkspaceMemberRole
  avatarUrl?: string
  /** ISO timestamp from `workspace_members.joined_at` when loaded from Supabase. */
  joinedAt?: string
}

export interface BoardLabel {
  id: string
  name: string
  color: string
}

export interface BoardAutomation {
  autoMoveOverdue: boolean
  autoArchiveCompleted: boolean
  notifyOnAssign: boolean
  notifyOnDue: boolean
}

export interface BoardNotifications {
  email: boolean
  inApp: boolean
  weeklyDigest: boolean
}

export interface BoardSettings {
  visibility: BoardVisibility
  defaultPriority: TaskPriority
  defaultColumn: KanbanColumnId
  notifications: BoardNotifications
  labels: BoardLabel[]
  automation: BoardAutomation
}

export interface TaskChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface TaskComment {
  id: string
  authorId: string
  authorName: string
  initials: string
  color: string
  avatarUrl?: string
  text: string
  createdAt: number
}

export interface BoardTask {
  id: string
  title: string
  description: string
  columnId: KanbanColumnId
  tags: string[]
  priority: TaskPriority
  due: string
  overdue: boolean
  comments: number
  attachments: number
  assignees: Pick<TeamMember, "id" | "name" | "initials" | "color" | "avatarUrl">[]
  progress: number
  sortOrder?: number
  checklist?: TaskChecklistItem[]
  taskComments?: TaskComment[]
  updatedAt?: number
  /**
   * Millisecond UTC from `board_tasks.created_at` when present. Legacy rows
   * may omit this until the task is edited again; the activity feed only
   * emits a "created" event when this field is set.
   */
  createdAt?: number
  /**
   * Millisecond UTC from `board_tasks.completed_at` when the task is in the
   * `completed` column. Cleared when moved back to another column.
   */
  completedAt?: number
}

export interface BoardMeta {
  id: string
  workspaceId: string
  name: string
  description?: string
  settings?: BoardSettings
}

export interface WorkspaceEntity {
  /** Stable primary identifier (UUID for new workspaces). Used as the foreign key everywhere in Supabase. */
  id: string
  /** Human-readable URL slug. Unique per user. Used in route segments like `/dashboard/workspaces/<slug>`. */
  slug: string
  name: string
  icon: string
  expanded: boolean
  boardIds: string[]
  /** User ids of workspace_members with access to all boards in this workspace. */
  memberIds: string[]
}
