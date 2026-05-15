"use client"

import { DashboardChrome } from "@/components/dashboard-chrome"
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar"
import { WorkspacesIndex } from "@/components/boards/workspaces-index"
import { useDashboardAuth } from "@/hooks/use-dashboard-auth"

export default function BoardsPage() {
  const { user, userId, loading, loggingOut, welcomeName, fullName, onLogout } = useDashboardAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
          Loading boards…
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
        <DashboardTopBar
          userId={userId}
          displayName={display}
          email={user.email ?? ""}
          onLogout={onLogout}
          loggingOut={loggingOut}
        />
      }
    >
      <WorkspacesIndex />
    </DashboardChrome>
  )
}
