"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { ProfileDropdown } from "@/components/profile/profile-dropdown"
import { WorkspaceSettingsDetail } from "@/components/profile/workspace-settings-detail"
import { Button } from "@/components/ui/button"
import { DashboardChrome } from "@/components/dashboard-chrome"
import { useDashboardAuth } from "@/hooks/use-dashboard-auth"
import { getWorkspaceByIdOrSlug, useBoardsStore } from "@/stores/boards-store"
import { useMemo } from "react"

export default function WorkspaceSettingsDetailPage() {
  const params = useParams<{ workspaceSlug: string }>()
  const workspaceSlug = params?.workspaceSlug ?? ""
  const workspaces = useBoardsStore((s) => s.workspaces)
  const workspace = useMemo(
    () => getWorkspaceByIdOrSlug(workspaces, workspaceSlug),
    [workspaces, workspaceSlug]
  )
  const { user, userId, loading, loggingOut, welcomeName, fullName, onLogout } = useDashboardAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
          Loading workspace…
        </div>
      </div>
    )
  }

  if (!user) return null

  const display = welcomeName ?? (user.email ? user.email.split("@")[0] : "Account")

  return (
    <DashboardChrome
      userName={fullName}
      userEmail={user.email ?? ""}
      onLogout={onLogout}
      header={
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/dashboard/settings/workspace">
              <ArrowLeft className="size-4" aria-hidden />
              All workspaces
            </Link>
          </Button>
          <ProfileDropdown
            userId={userId}
            displayName={display}
            email={user.email ?? ""}
            onLogout={onLogout}
            loggingOut={loggingOut}
          />
        </div>
      }
    >
      <WorkspaceSettingsDetail workspaceId={workspace?.id ?? workspaceSlug} />
    </DashboardChrome>
  )
}
