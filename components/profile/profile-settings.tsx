"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Mail,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from "lucide-react"
import { toast } from "sonner"
import type { User } from "@supabase/supabase-js"

import { ProfileAvatarUpload } from "@/components/profile/profile-avatar-upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  useProfile,
  useUpdateEmail,
  useUpdatePassword,
  useUpdateProfile,
} from "@/hooks/use-profile"
import { removeAvatarFiles, uploadAvatar, validateAvatarFile } from "@/lib/profile/avatar-upload"
import { pullRemoteBoardsState } from "@/lib/syncdesk/boards-remote-sync"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { useBoardsStore } from "@/stores/boards-store"
import { cn } from "@/lib/utils"

interface Props {
  user: User
  fullName: string | null
}

function emailLooksValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

const PREFERENCES_KEY = "syncdesk:account-preferences"

interface AccountPreferences {
  emailNotifications: boolean
  desktopMentions: boolean
  weeklyDigest: boolean
  compactDensity: boolean
}

const DEFAULT_PREFERENCES: AccountPreferences = {
  emailNotifications: true,
  desktopMentions: true,
  weeklyDigest: false,
  compactDensity: false,
}

function loadPreferences(): AccountPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<AccountPreferences>
    return { ...DEFAULT_PREFERENCES, ...parsed }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function ProfileSettings({ user, fullName }: Props) {
  const userId = user.id
  const { data: profile, isLoading: profileLoading } = useProfile(userId)
  const updateProfile = useUpdateProfile(userId)
  const updateEmail = useUpdateEmail()
  const updatePassword = useUpdatePassword()
  const supabaseReady = Boolean(getOptionalSupabaseClient())

  const workspaces = useBoardsStore((s) => s.workspaces)
  const boardsById = useBoardsStore((s) => s.boardsById)
  const tasksByBoardId = useBoardsStore((s) => s.tasksByBoardId)

  const initialName = profile?.display_name?.trim() || fullName || ""
  const savedAvatarUrl = profile?.avatar_url ?? null

  const [displayName, setDisplayName] = useState(initialName)
  const [email, setEmail] = useState(user.email ?? "")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [preferences, setPreferences] = useState<AccountPreferences>(DEFAULT_PREFERENCES)
  const [hydratedPrefs, setHydratedPrefs] = useState(false)
  const [lastName, setLastName] = useState(initialName)
  const [lastEmail, setLastEmail] = useState(user.email ?? "")

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [markRemoveAvatar, setMarkRemoveAvatar] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const previewRef = useRef<string | null>(null)

  if (initialName !== lastName) {
    setLastName(initialName)
    setDisplayName(initialName)
  }
  if ((user.email ?? "") !== lastEmail) {
    setLastEmail(user.email ?? "")
    setEmail(user.email ?? "")
  }

  useEffect(() => {
    queueMicrotask(() => {
      setPreferences(loadPreferences())
      setHydratedPrefs(true)
    })
  }, [])

  useEffect(() => {
    if (!hydratedPrefs) return
    try {
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
    } catch {
      /* ignore */
    }
  }, [hydratedPrefs, preferences])

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current)
        previewRef.current = null
      }
    }
  }, [])

  const memberships = useMemo(() => {
    return workspaces.map((w) => {
      const boards = w.boardIds
        .map((id) => boardsById[id])
        .filter((b): b is NonNullable<typeof b> => Boolean(b))
      const taskCount = w.boardIds.reduce(
        (acc, id) => acc + (tasksByBoardId[id]?.length ?? 0),
        0
      )
      return {
        workspace: w,
        boardCount: boards.length,
        taskCount,
        firstBoardId: boards[0]?.id ?? null,
      }
    })
  }, [boardsById, tasksByBoardId, workspaces])

  const nameDirty = displayName.trim() !== initialName.trim()
  const avatarDirty = Boolean(pendingFile) || markRemoveAvatar
  const profileDirty = nameDirty || avatarDirty

  const initials = useMemo(() => {
    const source = displayName.trim() || user.email || ""
    const parts = source.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    return source.slice(0, 2).toUpperCase()
  }, [displayName, user.email])

  const onPickFile = (file: File) => {
    const err = validateAvatarFile(file)
    if (err) {
      toast.error(err)
      return
    }
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
    }
    const url = URL.createObjectURL(file)
    previewRef.current = url
    setPreviewUrl(url)
    setPendingFile(file)
    setMarkRemoveAvatar(false)
  }

  const onRemoveAvatar = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    }
    setPreviewUrl(null)
    setPendingFile(null)
    setMarkRemoveAvatar(true)
  }

  const onSaveProfile = async () => {
    if (!supabaseReady) {
      toast.error("Connect Supabase in .env.local to sync your profile.")
      return
    }
    const name = displayName.trim()
    if (!name) {
      toast.error("Display name is required.")
      return
    }

    const client = getOptionalSupabaseClient()
    if (!client) return

    let nextAvatarUrl: string | null | undefined = undefined

    try {
      if (markRemoveAvatar) {
        setUploadingAvatar(true)
        await removeAvatarFiles(client, userId)
        nextAvatarUrl = null
      } else if (pendingFile) {
        setUploadingAvatar(true)
        nextAvatarUrl = await uploadAvatar(client, userId, pendingFile)
      }

      updateProfile.mutate(
        {
          displayName: name,
          ...(nextAvatarUrl !== undefined ? { avatarUrl: nextAvatarUrl } : {}),
        },
        {
          onSuccess: async () => {
            if (previewRef.current) {
              URL.revokeObjectURL(previewRef.current)
              previewRef.current = null
            }
            setPreviewUrl(null)
            setPendingFile(null)
            setMarkRemoveAvatar(false)

            const bundle = await pullRemoteBoardsState(client, userId)
            if (bundle) {
              useBoardsStore.setState({
                workspaces: bundle.workspaces,
                boardsById: bundle.boardsById,
                tasksByBoardId: bundle.tasksByBoardId,
                teamMembers: bundle.teamMembers,
              })
            }
            toast.success("Profile updated.")
          },
        }
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update avatar.")
    } finally {
      setUploadingAvatar(false)
    }
  }

  const onSaveEmail = () => {
    if (!supabaseReady) {
      toast.error("Connect Supabase in .env.local to update email.")
      return
    }
    const next = email.trim()
    if (!emailLooksValid(next)) {
      toast.error("Enter a valid email address.")
      return
    }
    if (next === user.email) {
      toast.info("That's already your email.")
      return
    }
    updateEmail.mutate(
      { email: next },
      {
        onSuccess: () =>
          toast.success("Check your inbox to confirm the new email.", {
            description: "Supabase requires confirmation before the change takes effect.",
          }),
      }
    )
  }

  const onSavePassword = () => {
    if (!supabaseReady) {
      toast.error("Connect Supabase in .env.local to change your password.")
      return
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }
    updatePassword.mutate(
      { password },
      {
        onSuccess: () => {
          toast.success("Password updated.")
          setPassword("")
          setConfirmPassword("")
        },
      }
    )
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Account
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Profile
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Manage how you appear across SyncDesk, update your sign-in credentials and tune your
          collaboration preferences.
        </p>
      </header>

      {!supabaseReady ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          Supabase is not connected — set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable saving changes.
        </div>
      ) : null}

      <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
        <CardHeader className="px-5 pb-2 pt-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserIcon className="size-4" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Personal details
              </CardTitle>
              <CardDescription>Your name and avatar appear everywhere you collaborate.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-5 pb-5 pt-2">
          <ProfileAvatarUpload
            name={displayName.trim() || "You"}
            initials={initials}
            avatarUrl={savedAvatarUrl}
            previewUrl={markRemoveAvatar ? null : previewUrl}
            uploading={uploadingAvatar}
            onPickFile={onPickFile}
            onRemove={onRemoveAvatar}
            disabled={updateProfile.isPending || !supabaseReady}
          />

          <div className="grid gap-2">
            <Label htmlFor="display-name">Full name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              disabled={updateProfile.isPending || uploadingAvatar}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {profileLoading
                ? "Loading profile…"
                : profileDirty
                  ? "Unsaved changes"
                  : "Up to date"}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!profileDirty || updateProfile.isPending || uploadingAvatar}
                onClick={() => {
                  setDisplayName(initialName)
                  if (previewRef.current) {
                    URL.revokeObjectURL(previewRef.current)
                    previewRef.current = null
                  }
                  setPreviewUrl(null)
                  setPendingFile(null)
                  setMarkRemoveAvatar(false)
                }}
              >
                Reset
              </Button>
              <Button
                type="button"
                onClick={() => void onSaveProfile()}
                disabled={!profileDirty || updateProfile.isPending || uploadingAvatar}
              >
                {updateProfile.isPending || uploadingAvatar ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div
        className="grid gap-6 lg:grid-cols-2"
      >
        <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
          <CardHeader className="px-5 pb-2 pt-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                <Mail className="size-4" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">Email</CardTitle>
                <CardDescription>
                  Used for sign-in, invitations and notifications.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-2">
            <div className="grid gap-2">
              <Label htmlFor="email-input">Email address</Label>
              <Input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={updateEmail.isPending}
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                Supabase will send a confirmation link before activating the change.
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={onSaveEmail}
                disabled={
                  updateEmail.isPending ||
                  email.trim() === user.email ||
                  !emailLooksValid(email)
                }
              >
                {updateEmail.isPending ? "Sending…" : "Update email"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
          <CardHeader className="px-5 pb-2 pt-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <KeyRound className="size-4" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">Password</CardTitle>
                <CardDescription>Choose a strong password — 8 characters minimum.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-2">
            <div className="grid gap-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={updatePassword.isPending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={updatePassword.isPending}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={updatePassword.isPending}
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={onSavePassword}
                disabled={
                  updatePassword.isPending || password.length === 0 || confirmPassword.length === 0
                }
              >
                {updatePassword.isPending ? "Updating…" : "Update password"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
        <CardHeader className="px-5 pb-2 pt-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500/10 text-fuchsia-600">
              <Layers className="size-4" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Workspace memberships
              </CardTitle>
              <CardDescription>Workspaces you can access from your account.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {memberships.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              You haven&apos;t created a workspace yet —{" "}
              <Link href="/dashboard/boards" className="font-medium text-primary hover:underline">
                start one from Boards
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-border/60" role="list">
              {memberships.map(({ workspace, boardCount, taskCount, firstBoardId }) => {
                const href = firstBoardId
                  ? `/dashboard/boards/${workspace.slug}/${firstBoardId}`
                  : "/dashboard/boards"
                return (
                  <li
                    key={workspace.id}
                    className="flex items-center gap-2 px-5 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <Link
                      href={href}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-base"
                        aria-hidden
                      >
                        {workspace.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {workspace.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {boardCount} board{boardCount === 1 ? "" : "s"} · {taskCount} task
                          {taskCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                    <Button asChild variant="ghost" size="sm" className="shrink-0">
                      <Link href={`/dashboard/settings/workspace/${workspace.slug}`}>Manage</Link>
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card
        id="preferences"
        className="scroll-mt-24 border-border/70 bg-card shadow-sm shadow-black/[0.04]"
      >
        <CardHeader className="px-5 pb-2 pt-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Account preferences
              </CardTitle>
              <CardDescription>
                Personal nudges and density — saved to this device.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-5 pt-2">
          <PreferenceRow
            title="Email notifications"
            description="Inbox digest for mentions and assignments."
            checked={preferences.emailNotifications}
            onCheckedChange={(v) =>
              setPreferences((p) => ({ ...p, emailNotifications: v }))
            }
          />
          <PreferenceRow
            title="Desktop mentions"
            description="Pop a desktop notification when someone @-mentions you."
            checked={preferences.desktopMentions}
            onCheckedChange={(v) =>
              setPreferences((p) => ({ ...p, desktopMentions: v }))
            }
          />
          <PreferenceRow
            title="Weekly digest"
            description="Sunday-evening recap of your boards and progress."
            checked={preferences.weeklyDigest}
            onCheckedChange={(v) =>
              setPreferences((p) => ({ ...p, weeklyDigest: v }))
            }
          />
          <PreferenceRow
            title="Compact density"
            description="Tighter spacing in boards and lists."
            checked={preferences.compactDensity}
            onCheckedChange={(v) =>
              setPreferences((p) => ({ ...p, compactDensity: v }))
            }
          />
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-600" aria-hidden />
          <span>
            All changes go through Supabase Auth with row-level security. Your password is never
            stored on this device.
          </span>
        </div>
      </div>
    </div>
  )
}

function PreferenceRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3.5 py-3"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} label={title} />
    </div>
  )
}


