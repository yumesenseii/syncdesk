"use client"

import Link from "next/link"
import { Bell, ChevronRight, Settings } from "lucide-react"

import { ProfileDropdown } from "@/components/profile/profile-dropdown"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsQuery,
} from "@/hooks/use-notifications-query"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import type { WorkspaceEntity } from "@/lib/boards/types"
import { cn } from "@/lib/utils"

export function WorkspaceTopBar({
  workspace,
  userId,
  displayName,
  email,
  onLogout,
  loggingOut,
}: {
  workspace: WorkspaceEntity | null
  userId: string | null
  displayName: string
  email: string
  onLogout: () => void
  loggingOut: boolean
}) {
  const { data: notifications = [] } = useNotificationsQuery(userId ?? undefined)
  const markRead = useMarkNotificationRead(userId ?? undefined)
  const markAllRead = useMarkAllNotificationsRead(userId ?? undefined)
  const unread = notifications.filter((n) => !n.read_at).length

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
      <div className="min-w-0 space-y-1">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
        >
          <Link
            href="/dashboard"
            className="rounded px-1 transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            Dashboard
          </Link>
          <ChevronRight className="size-3 opacity-60" aria-hidden />
          <Link
            href="/dashboard/boards"
            className="rounded px-1 transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            Boards
          </Link>
          <ChevronRight className="size-3 opacity-60" aria-hidden />
          <span className="rounded px-1 text-foreground">
            {workspace?.name ?? "Workspace"}
          </span>
        </nav>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {workspace ? (
            <span aria-hidden className="text-2xl">
              {workspace.icon}
            </span>
          ) : null}
          <span className="truncate">{workspace?.name ?? "Workspace overview"}</span>
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="relative size-9 text-muted-foreground transition-colors duration-200 ease-out hover:bg-muted/70 hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="size-4" aria-hidden />
                {unread > 0 ? (
                  <span
                    className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 ring-2 ring-background"
                    aria-hidden
                  />
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              {notifications.length > 0 ? (
                <DropdownMenuItem
                  disabled={unread === 0 || markAllRead.isPending}
                  onSelect={(e) => {
                    e.preventDefault()
                    markAllRead.mutate()
                  }}
                >
                  Mark all read
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {getOptionalSupabaseClient()
                    ? "You’re all caught up."
                    : "Enable Supabase for synced notifications."}
                </div>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className={cn(
                      "flex flex-col items-start gap-0.5 py-2",
                      !n.read_at && "bg-primary/5"
                    )}
                    onClick={() => {
                      if (!n.read_at) markRead.mutate(n.id)
                    }}
                  >
                    <span className="text-sm font-medium text-foreground">{n.title}</span>
                    {n.body ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                    ) : null}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button type="button" variant="ghost" size="icon" asChild aria-label="Workspace settings">
            <Link
              href={
                workspace
                  ? `/dashboard/settings/workspace/${workspace.slug}`
                  : "/dashboard/settings/workspace"
              }
            >
              <Settings className="size-4" aria-hidden />
            </Link>
          </Button>

          <ProfileDropdown
            userId={userId}
            displayName={displayName}
            email={email}
            onLogout={onLogout}
            loggingOut={loggingOut}
            triggerVariant="solid"
          />
        </div>
      </div>
    </div>
  )
}
