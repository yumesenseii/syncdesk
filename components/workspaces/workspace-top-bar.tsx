"use client"

import Link from "next/link"
import { Bell, ChevronRight, Settings } from "lucide-react"

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
          <NotificationBell userId={userId} />

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
