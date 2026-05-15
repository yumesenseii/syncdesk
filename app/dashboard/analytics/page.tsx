"use client"

import { useState } from "react"

import { AnalyticsTopBar } from "@/components/analytics/analytics-top-bar"
import { AnalyticsView } from "@/components/analytics/analytics-view"
import { DashboardChrome } from "@/components/dashboard-chrome"
import { useDashboardAuth } from "@/hooks/use-dashboard-auth"
import type { Range } from "@/lib/analytics/metrics"

export default function AnalyticsPage() {
  const { user, userId, loading, loggingOut, welcomeName, fullName, onLogout } = useDashboardAuth()
  const [workspaceId, setWorkspaceId] = useState<string | "all">("all")
  const [range, setRange] = useState<Range>("7d")

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
          Loading analytics…
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
        <AnalyticsTopBar
          userId={userId}
          displayName={display}
          email={user.email ?? ""}
          onLogout={onLogout}
          loggingOut={loggingOut}
          workspaceId={workspaceId}
          onWorkspaceChange={setWorkspaceId}
          range={range}
          onRangeChange={setRange}
        />
      }
    >
      <AnalyticsView workspaceId={workspaceId} range={range} />
    </DashboardChrome>
  )
}
