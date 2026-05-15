"use client"

import { DashboardChrome } from "@/components/dashboard-chrome"
import { DashboardContributionIntelligence } from "@/components/dashboard/dashboard-contribution-intelligence"
import { DashboardOnboarding } from "@/components/dashboard/dashboard-onboarding"
import { DashboardProjectRiskMonitor } from "@/components/dashboard/dashboard-project-risk-monitor"
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar"
import { DashboardWelcome } from "@/components/dashboard/dashboard-welcome"
import { useDashboardAuth } from "@/hooks/use-dashboard-auth"
import { useBoardsStore } from "@/stores/boards-store"

function getGreeting(date: Date = new Date()) {
  const h = date.getHours()
  if (h < 5) return "Working late"
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  if (h < 21) return "Good evening"
  return "Good night"
}

export default function DashboardPage() {
  const { user, userId, loading, loggingOut, welcomeName, fullName, onLogout } = useDashboardAuth()
  const workspaceCount = useBoardsStore((s) => s.workspaces.length)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
          Loading your workspace…
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
      {workspaceCount === 0 ? (
        <DashboardOnboarding displayName={display} />
      ) : (
        <>
          <DashboardWelcome name={display} greeting={getGreeting()} />

          <section
            aria-labelledby="dashboard-analytics-heading"
            className="mt-10 space-y-4 sm:mt-12"
          >
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2
                  id="dashboard-analytics-heading"
                  className="text-base font-semibold tracking-tight text-foreground sm:text-lg"
                >
                  Analytics
                </h2>
                <p className="text-sm text-muted-foreground">
                  Two signals to act on first — who&apos;s driving momentum, and where the risk is.
                </p>
              </div>
            </div>

            <div className="grid auto-rows-fr gap-4 xl:grid-cols-2 xl:gap-5">
              <DashboardContributionIntelligence />
              <DashboardProjectRiskMonitor />
            </div>
          </section>
        </>
      )}
    </DashboardChrome>
  )
}
