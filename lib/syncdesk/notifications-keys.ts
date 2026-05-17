export const notificationsKey = (userId: string) => ["notifications", userId] as const

export const notificationsUnreadKey = (userId: string) =>
  ["notifications", userId, "unread-count"] as const
