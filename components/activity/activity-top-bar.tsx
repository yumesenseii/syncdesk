"use client"

import Link from "next/link"
import { useMemo } from "react"
import {
  Bell,
  CalendarRange,
  ChevronDown,
  Filter,
  Layers,
  Search,
  Settings,
} from "lucide-react"

import { NotificationBell } from "@/components/notifications/notification-bell"
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
import { Input } from "@/components/ui/input"
import {
  ACTIVITY_DATE_LABEL,
  ACTIVITY_DATE_RANGES,
  ACTIVITY_TYPE_LABEL,
  ACTIVITY_TYPES,
  type ActivityDateRange,
  type ActivityType,
} from "@/lib/activity/events"
import { useBoardsStore } from "@/stores/boards-store"
import { cn } from "@/lib/utils"

export function ActivityTopBar({
  userId,
  displayName,
  email,
  onLogout,
  loggingOut,
  searchQuery,
  onSearchChange,
  range,
  onRangeChange,
  type,
  onTypeChange,
  workspaceId,
  onWorkspaceChange,
}: {
  userId: string | null
  displayName: string
  email: string
  onLogout: () => void
  loggingOut: boolean
  searchQuery: string
  onSearchChange: (q: string) => void
  range: ActivityDateRange
  onRangeChange: (r: ActivityDateRange) => void
  type: ActivityType
  onTypeChange: (t: ActivityType) => void
  workspaceId: string | "all"
  onWorkspaceChange: (id: string | "all") => void
}) {
  const workspaces = useBoardsStore((s) => s.workspaces)
  const activeWorkspaceName = useMemo(() => {
    if (workspaceId === "all") return "All workspaces"
    return workspaces.find((w) => w.id === workspaceId)?.name ?? "All workspaces"
  }, [workspaceId, workspaces])

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
      <div className="relative min-w-0 flex-1 lg:max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search activity, tasks, people…"
          className="h-10 border-border/80 bg-background/80 pl-9 shadow-sm transition-shadow duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Search activity"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 border-border/80 bg-background/80 shadow-sm transition-colors duration-200 ease-out hover:bg-muted/60"
              aria-label="Workspace filter"
            >
              <Layers className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="max-w-[10rem] truncate text-xs font-medium sm:text-sm">
                {activeWorkspaceName}
              </span>
              <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Workspace</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onWorkspaceChange("all")}>All workspaces</DropdownMenuItem>
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
              aria-label="Activity type"
            >
              <Filter className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="max-w-[9rem] truncate text-xs font-medium sm:text-sm">
                {ACTIVITY_TYPE_LABEL[type]}
              </span>
              <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Activity type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ACTIVITY_TYPES.map((t) => (
              <DropdownMenuItem key={t} onClick={() => onTypeChange(t)}>
                {ACTIVITY_TYPE_LABEL[t]}
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
              <CalendarRange className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="max-w-[9rem] truncate text-xs font-medium sm:text-sm">
                {ACTIVITY_DATE_LABEL[range]}
              </span>
              <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel>Date range</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ACTIVITY_DATE_RANGES.map((r) => (
              <DropdownMenuItem key={r} onClick={() => onRangeChange(r)}>
                {ACTIVITY_DATE_LABEL[r]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <NotificationBell userId={userId} />

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
