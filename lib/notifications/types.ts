export type NotificationType =
  | "task_comment"
  | "task_assigned"
  | "task_status_changed"
  | "task_completed"
  | "mention"
  | "member_joined"
  | "invite_accepted"
  | "board_created"
  | "due_reminder"
  | "workspace_invitation"
  | "system"

export type AppNotification = {
  id: string
  userId: string
  actorId: string | null
  workspaceId: string | null
  boardId: string | null
  taskId: string | null
  type: NotificationType | string
  title: string
  message: string | null
  isRead: boolean
  createdAt: string
  actorName: string | null
  actorAvatarUrl: string | null
  workspaceSlug: string | null
}

export type CreateNotificationInput = {
  userId: string
  actorId?: string | null
  workspaceId?: string | null
  boardId?: string | null
  taskId?: string | null
  type: NotificationType | string
  title: string
  message?: string | null
}
