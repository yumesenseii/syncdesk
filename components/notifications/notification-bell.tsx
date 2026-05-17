"use client"

import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Bell, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/ui/user-avatar"
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsQuery,
  useUnreadNotificationCount,
} from "@/hooks/use-notifications-query"
import { useNotificationsRealtime } from "@/hooks/use-notifications-realtime"
import { formatRelativeTime } from "@/lib/notifications/format-relative-time"
import { notificationHref } from "@/lib/notifications/navigation"
import type { AppNotification } from "@/lib/notifications/types"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"

function NotificationSkeleton() {
  return (
    <motion.div
      className="flex animate-pulse gap-2.5 rounded-lg px-2 py-2.5"
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      aria-hidden
    >
      <div className="size-8 shrink-0 rounded-full bg-muted" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <motion.div className="h-3 w-3/4 rounded bg-muted" />
        <motion.div className="h-2.5 w-full rounded bg-muted/80" />
      </div>
    </motion.div>
  )
}

function NotificationRow({
  notification: n,
  onNavigate,
}: {
  notification: AppNotification
  onNavigate: (n: AppNotification) => void
}) {
  const actorLabel = n.actorName ?? "Someone"
  const initials = actorLabel.slice(0, 2).toUpperCase()

  return (
    <DropdownMenuItem
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2.5 focus:bg-muted/50",
        !n.isRead && "bg-primary/[0.06]"
      )}
      onSelect={(e) => {
        e.preventDefault()
        onNavigate(n)
      }}
    >
      <UserAvatar
        name={actorLabel}
        initials={initials}
        avatarUrl={n.actorAvatarUrl ?? undefined}
        color="bg-primary/15 text-primary"
        size="sm"
        ringClassName=""
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug text-foreground">{n.title}</p>
          {!n.isRead ? (
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          ) : null}
        </div>
        {n.message ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {n.message}
          </p>
        ) : null}
        <p className="mt-1 text-[10px] text-muted-foreground">
          {actorLabel} · {formatRelativeTime(n.createdAt)}
        </p>
      </div>
    </DropdownMenuItem>
  )
}

export function NotificationBell({ userId }: { userId: string | null | undefined }) {
  const router = useRouter()
  const supabaseReady = Boolean(getOptionalSupabaseClient())
  const uid = userId ?? undefined

  useNotificationsRealtime(uid)

  const { notifications, isPending, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotificationsQuery(uid)
  const { data: unreadCount = 0 } = useUnreadNotificationCount(uid)
  const markRead = useMarkNotificationRead(uid)
  const markAllRead = useMarkAllNotificationsRead(uid)

  const showSkeleton = isPending && notifications.length === 0

  const handleNavigate = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id)
    const href = notificationHref(n)
    if (href) router.push(href)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-9 shrink-0 rounded-full text-muted-foreground transition-colors duration-200 ease-out hover:bg-muted/70 hover:text-foreground"
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
        >
          <Bell className="size-4" aria-hidden />
          <AnimatePresence>
            {unreadCount > 0 ? (
              <motion.span
                key="badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-background"
                aria-hidden
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {notifications.length > 0 && unreadCount > 0 ? (
            <button
              type="button"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
              className="text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
            >
              Mark all read
            </button>
          ) : null}
        </div>

        <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-1">
          {!supabaseReady ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Enable Supabase to sync notifications from the cloud.
            </div>
          ) : showSkeleton ? (
            <div className="space-y-1 p-1">
              <NotificationSkeleton />
              <NotificationSkeleton />
              <NotificationSkeleton />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted/60">
                <Check className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">
                Workspace activity will appear here in real time.
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {notifications.map((n) => (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <NotificationRow notification={n} onNavigate={handleNavigate} />
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {hasNextPage && !showSkeleton ? (
            <motion.div className="border-t border-border/50 p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </motion.div>
          ) : null}

          {isFetching && !showSkeleton && notifications.length > 0 ? (
            <p className="py-1 text-center text-[10px] text-muted-foreground">Updating…</p>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
