"use client"

import { useState } from "react"

import { ActivityTopBar } from "@/components/activity/activity-top-bar"
import { ActivityView } from "@/components/activity/activity-view"
import { DashboardChrome } from "@/components/dashboard-chrome"
import { useDashboardAuth } from "@/hooks/use-dashboard-auth"
import type { ActivityDateRange, ActivityType } from "@/lib/activity/events"

export default function ActivityPage() {
  const { user, userId, loading, loggingOut, welcomeName, fullName, onLogout } = useDashboardAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [range, setRange] = useState<ActivityDateRange>("7d")
  const [type, setType] = useState<ActivityType>("all")
  const [workspaceId, setWorkspaceId] = useState<string | "all">("all")

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
          Loading activity…
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
        <ActivityTopBar
          userId={userId}
          displayName={display}
          email={user.email ?? ""}
          onLogout={onLogout}
          loggingOut={loggingOut}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          range={range}
          onRangeChange={setRange}
          type={type}
          onTypeChange={setType}
          workspaceId={workspaceId}
          onWorkspaceChange={setWorkspaceId}
        />
      }
    >
      <ActivityView
        userId={userId}
        searchQuery={searchQuery}
        type={type}
        range={range}
        workspaceId={workspaceId}
      />
    </DashboardChrome>
  )
}
