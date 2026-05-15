"use client"

import { useParams } from "next/navigation"
import { useMemo } from "react"

import { DashboardChrome } from "@/components/dashboard-chrome"
import { WorkspaceOverview } from "@/components/workspaces/workspace-overview"
import { WorkspaceTopBar } from "@/components/workspaces/workspace-top-bar"
import { useDashboardAuth } from "@/hooks/use-dashboard-auth"
import { getWorkspaceByIdOrSlug, useBoardsStore } from "@/stores/boards-store"

export default function WorkspaceOverviewPage() {
  const params = useParams<{ workspaceSlug: string }>()
  const workspaceSlug = params?.workspaceSlug ?? ""
  const { user, userId, loading, loggingOut, welcomeName, fullName, onLogout } = useDashboardAuth()
  const workspaces = useBoardsStore((s) => s.workspaces)
  const workspace = useMemo(
    () => getWorkspaceByIdOrSlug(workspaces, workspaceSlug),
    [workspaces, workspaceSlug]
  )

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
        <WorkspaceTopBar
          workspace={workspace}
          userId={userId}
          displayName={display}
          email={user.email ?? ""}
          onLogout={onLogout}
          loggingOut={loggingOut}
        />
      }
    >
      <WorkspaceOverview workspaceId={workspace?.id ?? workspaceSlug} />
    </DashboardChrome>
  )
}
