"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ProfileDropdown } from "@/components/profile/profile-dropdown"
import { ProfileSettings } from "@/components/profile/profile-settings"
import { Button } from "@/components/ui/button"
import { DashboardChrome } from "@/components/dashboard-chrome"
import { useDashboardAuth } from "@/hooks/use-dashboard-auth"

export default function ProfilePage() {
  const { user, userId, loading, loggingOut, welcomeName, fullName, onLogout } = useDashboardAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
          Loading profile…
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
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href="/dashboard">
                <ArrowLeft className="size-4" aria-hidden />
                Back to dashboard
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <ProfileDropdown
              userId={userId}
              displayName={display}
              email={user.email ?? ""}
              onLogout={onLogout}
              loggingOut={loggingOut}
            />
          </div>
        </div>
      }
    >
      <ProfileSettings user={user} fullName={fullName} />
    </DashboardChrome>
  )
}
