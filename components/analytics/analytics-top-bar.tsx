"use client"

import Link from "next/link"
import { useMemo } from "react"
import {
  Bell,
  ChevronDown,
  Filter,
  Settings,
  Sparkles,
} from "lucide-react"

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
import { RANGE_LABEL, type Range } from "@/lib/analytics/metrics"
import { useBoardsStore } from "@/stores/boards-store"
import { cn } from "@/lib/utils"

const RANGES: Range[] = ["7d", "14d", "30d", "semester"]

export function AnalyticsTopBar({
  userId,
  displayName,
  email,
  onLogout,
  loggingOut,
  workspaceId,
  onWorkspaceChange,
  range,
  onRangeChange,
}: {
  userId: string | null
  displayName: string
  email: string
  onLogout: () => void
  loggingOut: boolean
  workspaceId: string | "all"
  onWorkspaceChange: (id: string | "all") => void
  range: Range
  onRangeChange: (r: Range) => void
}) {
  const workspaces = useBoardsStore((s) => s.workspaces)

  const activeWorkspaceName = useMemo(() => {
    if (workspaceId === "all") return "All workspaces"
    return workspaces.find((w) => w.id === workspaceId)?.name ?? "All workspaces"
  }, [workspaceId, workspaces])

  const { data: notifications = [] } = useNotificationsQuery(userId ?? undefined)
  const markRead = useMarkNotificationRead(userId ?? undefined)
  const markAllRead = useMarkAllNotificationsRead(userId ?? undefined)
  const unread = notifications.filter((n) => !n.read_at).length

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Workspace intelligence
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Analytics
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 border-border/80 bg-background/80 shadow-sm transition-colors duration-200 ease-out hover:bg-muted/60"
              aria-label="Filter workspace"
            >
              <Filter className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="max-w-[12rem] truncate text-xs font-medium sm:text-sm">
                {activeWorkspaceName}
              </span>
              <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Workspace</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onWorkspaceChange("all")}>
              All workspaces
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onClick={() => onWorkspaceChange(w.id)}>
                <span aria-hidden className="mr-2">
                  {w.icon}
                </span>
                {w.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 border-border/80 bg-background/80 shadow-sm transition-colors duration-200 ease-out hover:bg-muted/60"
              aria-label="Date range"
            >
              <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="text-xs font-medium sm:text-sm">{RANGE_LABEL[range]}</span>
              <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Range</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {RANGES.map((r) => (
              <DropdownMenuItem key={r} onClick={() => onRangeChange(r)}>
                {RANGE_LABEL[r]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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
            <Link href="/dashboard/settings/workspace">
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
