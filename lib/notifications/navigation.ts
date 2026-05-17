import type { AppNotification } from "@/lib/notifications/types"

/**
 * Deep link for a notification row. Task links use `?task=` on the board page.
 */
export function notificationHref(n: AppNotification): string | null {
  const slug = n.workspaceSlug
  if (n.boardId && slug) {
    const base = `/dashboard/boards/${slug}/${n.boardId}`
    if (n.taskId) return `${base}?task=${encodeURIComponent(n.taskId)}`
    return base
  }
  if (slug) return `/dashboard/workspaces/${slug}`
  if (n.workspaceId) return "/dashboard"
  return null
}
