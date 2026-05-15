"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { LogOut, Settings, User, UserCog } from "lucide-react"

import { LogoutConfirmationModal } from "@/components/profile/logout-confirmation-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/ui/user-avatar"
import { useProfile } from "@/hooks/use-profile"
import { cn } from "@/lib/utils"

export function ProfileDropdown({
  userId,
  displayName,
  email,
  onLogout,
  loggingOut,
  triggerVariant = "gradient",
  align = "end",
}: {
  userId: string | null
  displayName: string
  email: string
  onLogout: () => void | Promise<void>
  loggingOut: boolean
  triggerVariant?: "gradient" | "solid"
  align?: "start" | "end" | "center"
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { data: profile } = useProfile(userId)

  const initials = useMemo(() => {
    const source = profile?.display_name?.trim() || displayName?.trim() || email
    const parts = source.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    return source.slice(0, 2).toUpperCase()
  }, [displayName, email, profile?.display_name])

  const visibleName = profile?.display_name?.trim() || displayName || email

  const handleConfirm = async () => {
    try {
      await onLogout()
    } finally {
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <LogoutConfirmationModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirm}
        loading={loggingOut}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 text-xs font-semibold text-primary-foreground shadow-sm",
              "transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.04] hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              triggerVariant === "gradient"
                ? "bg-gradient-to-br from-primary to-sky-500"
                : "bg-primary"
            )}
            aria-label="Account menu"
          >
            <UserAvatar
              name={visibleName}
              initials={initials}
              avatarUrl={profile?.avatar_url}
              size="md"
              color={
                triggerVariant === "gradient"
                  ? "bg-gradient-to-br from-primary to-sky-500 text-primary-foreground"
                  : "bg-primary text-primary-foreground"
              }
              ringClassName=""
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} sideOffset={8} className="w-64">
          <DropdownMenuLabel className="font-normal">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-primary-foreground",
                  triggerVariant === "gradient"
                    ? "bg-gradient-to-br from-primary to-sky-500"
                    : "bg-primary"
                )}
                aria-hidden
              >
                <UserAvatar
                  name={visibleName}
                  initials={initials}
                  avatarUrl={profile?.avatar_url}
                  size="lg"
                  color={
                    triggerVariant === "gradient"
                      ? "bg-gradient-to-br from-primary to-sky-500 text-primary-foreground"
                      : "bg-primary text-primary-foreground"
                  }
                  ringClassName=""
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {visibleName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{email}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="gap-2">
            <Link href="/dashboard/profile">
              <User className="size-4" aria-hidden />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="gap-2">
            <Link href="/dashboard/settings/workspace">
              <Settings className="size-4" aria-hidden />
              Workspace settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="gap-2">
            <Link href="/dashboard/profile#preferences">
              <UserCog className="size-4" aria-hidden />
              Account preferences
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault()
              setConfirmOpen(true)
            }}
            disabled={loggingOut}
          >
            <LogOut className="size-4" aria-hidden />
            {loggingOut ? "Signing out…" : "Log out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
