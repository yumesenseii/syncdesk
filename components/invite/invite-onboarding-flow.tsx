"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, type ReactNode } from "react"
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldAlert,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useInvitePreviewQuery } from "@/hooks/use-invite-preview"
import { useAcceptInviteMutation } from "@/hooks/use-workspace-invites"
import {
  buildInvitePath,
  clearPersistedInviteToken,
  getInviteTerminalState,
  parseAcceptInviteError,
  persistInviteToken,
  workspaceDashboardPath,
  type InvitePreview,
  type InviteTerminalState,
} from "@/lib/invite"
import { emailsMatch } from "@/lib/invite/invite-email"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { useBoardsStore } from "@/stores/boards-store"

type InviteOnboardingFlowProps = {
  token: string
}

export function InviteOnboardingFlow({ token }: InviteOnboardingFlowProps) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const previewQuery = useInvitePreviewQuery(token)
  const acceptMutation = useAcceptInviteMutation()
  const acceptTriggeredRef = useRef(false)
  const redirectTriggeredRef = useRef(false)
  const supabaseConfigured = Boolean(getOptionalSupabaseClient())

  useEffect(() => {
    if (token) persistInviteToken(token)
  }, [token])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      acceptTriggeredRef.current = false
      acceptMutation.reset()
    }
  }, [authLoading, user, acceptMutation])

  const preview = previewQuery.data ?? null
  const terminal = getInviteTerminalState(preview)
  const invitePath = buildInvitePath(token)
  const loginHref = `/login?next=${encodeURIComponent(invitePath)}`
  const registerHref = preview
    ? `/register?next=${encodeURIComponent(invitePath)}&email=${encodeURIComponent(preview.invitedEmail)}`
    : `/register?next=${encodeURIComponent(invitePath)}`

  const finishJoin = useCallback(
    (result: { workspace_name: string; workspace_slug?: string; workspace_id: string }) => {
      if (redirectTriggeredRef.current) return
      redirectTriggeredRef.current = true
      clearPersistedInviteToken()
      useBoardsStore.getState().setActiveWorkspaceId(result.workspace_id)
      toast.success(`You joined ${result.workspace_name}`)
      const slug = result.workspace_slug ?? result.workspace_id
      router.replace(`/dashboard/workspaces/${slug}`)
      router.refresh()
    },
    [router]
  )

  const tryAccept = useCallback(() => {
    if (!token || !user || acceptTriggeredRef.current) return
    acceptTriggeredRef.current = true
    acceptMutation.mutate(token, {
      onSuccess: (data) => finishJoin(data),
      onError: () => {
        acceptTriggeredRef.current = false
      },
    })
  }, [acceptMutation, finishJoin, token, user])

  useEffect(() => {
    if (authLoading || previewQuery.isLoading) return
    if (!user || !preview || terminal) return
    if (!emailsMatch(user.email, preview.invitedEmail)) return
    if (acceptMutation.isPending || acceptMutation.isSuccess) return
    tryAccept()
  }, [
    authLoading,
    previewQuery.isLoading,
    user,
    preview,
    terminal,
    acceptMutation.isPending,
    acceptMutation.isSuccess,
    tryAccept,
  ])

  useEffect(() => {
    if (!user || !preview || terminal !== "already_accepted") return
    if (redirectTriggeredRef.current) return
    redirectTriggeredRef.current = true
    clearPersistedInviteToken()
    useBoardsStore.getState().setActiveWorkspaceId(preview.workspaceId)
    router.replace(workspaceDashboardPath(preview))
    router.refresh()
  }, [user, preview, terminal, router])

  const switchAccount = useCallback(async () => {
    const client = getOptionalSupabaseClient()
    if (client) await client.auth.signOut()
    acceptMutation.reset()
    acceptTriggeredRef.current = false
    router.push(loginHref)
  }, [acceptMutation, loginHref, router])

  if (!supabaseConfigured) {
    return (
      <InviteShell>
        <InviteCard>
          <InviteNeutralNotice
            title="Setup required"
            body="Add Supabase environment variables to accept workspace invitations."
          />
        </InviteCard>
      </InviteShell>
    )
  }

  if (!token) {
    return (
      <InviteShell>
        <InviteCard>
          <InviteErrorCard title="Invalid link" body="This invitation link is missing a token." />
        </InviteCard>
      </InviteShell>
    )
  }

  const isBootstrapping = previewQuery.isLoading || authLoading

  if (isBootstrapping) {
    return (
      <InviteShell>
        <InviteLoading label="Loading invitation…" />
      </InviteShell>
    )
  }

  // Unauthenticated: never show accept failures or preview fetch errors as red errors.
  if (!user) {
    if (preview && terminal) {
      return (
        <InviteShell>
          <InviteTerminalCard kind={terminal} preview={preview} loginHref={loginHref} />
        </InviteShell>
      )
    }

    if (preview && !terminal) {
      return (
        <InviteShell>
          <InvitePreviewCard preview={preview} loginHref={loginHref} registerHref={registerHref} />
        </InviteShell>
      )
    }

    if (!previewQuery.isError && !preview) {
      return (
        <InviteShell>
          <InviteTerminalCard kind="invalid" loginHref={loginHref} />
        </InviteShell>
      )
    }

    return (
      <InviteShell>
        <InvitePreviewFallbackCard
          loginHref={loginHref}
          registerHref={registerHref}
          onRetry={() => previewQuery.refetch()}
          isRetrying={previewQuery.isFetching}
        />
      </InviteShell>
    )
  }

  // Authenticated
  if (previewQuery.isError) {
    return (
      <InviteShell>
        <InviteCard>
          <InviteBrandHeader />
          <InviteErrorCard
            title="Couldn’t load invitation"
            body={previewQuery.error?.message ?? "Please try again in a moment."}
            actions={
              <Button type="button" variant="outline" size="sm" onClick={() => previewQuery.refetch()}>
                <RefreshCw className="mr-2 size-4" aria-hidden />
                Retry
              </Button>
            }
          />
        </InviteCard>
      </InviteShell>
    )
  }

  if (!preview) {
    return (
      <InviteShell>
        <InviteTerminalCard kind="invalid" loginHref={loginHref} />
      </InviteShell>
    )
  }

  if (terminal) {
    return (
      <InviteShell>
        <InviteTerminalCard kind={terminal} preview={preview} loginHref={loginHref} />
      </InviteShell>
    )
  }

  if (!emailsMatch(user.email, preview.invitedEmail)) {
    return (
      <InviteShell>
        <WrongAccountCard
          invitedEmail={preview.invitedEmail}
          currentEmail={user.email ?? ""}
          loginHref={loginHref}
          onSwitchAccount={switchAccount}
        />
      </InviteShell>
    )
  }

  if (acceptMutation.isError) {
    const parsed = parseAcceptInviteError(acceptMutation.error.message)
    if (parsed.kind === "wrong_email") {
      return (
        <InviteShell>
          <WrongAccountCard
            invitedEmail={parsed.invitedEmail}
            currentEmail={user.email ?? ""}
            loginHref={loginHref}
            onSwitchAccount={switchAccount}
          />
        </InviteShell>
      )
    }
    if (
      parsed.kind === "expired" ||
      parsed.kind === "revoked" ||
      parsed.kind === "already_accepted" ||
      parsed.kind === "invalid"
    ) {
      return (
        <InviteShell>
          <InviteTerminalCard kind={parsed.kind} preview={preview} loginHref={loginHref} />
        </InviteShell>
      )
    }
    return (
      <InviteShell>
        <InviteCard>
          <InviteBrandHeader />
          <InviteErrorCard
            title="Couldn’t join workspace"
            body={parsed.kind === "generic" ? parsed.message : acceptMutation.error.message}
            actions={
              <Button type="button" size="sm" onClick={() => tryAccept()}>
                Try again
              </Button>
            }
          />
        </InviteCard>
      </InviteShell>
    )
  }

  return (
    <InviteShell>
      <InviteLoading label="Joining workspace…" />
    </InviteShell>
  )
}

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/[0.07] via-background to-primary/[0.03] px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}

function InviteCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/95 p-8 shadow-xl shadow-primary/[0.06] backdrop-blur-sm transition-shadow duration-300">
      {children}
    </div>
  )
}

function InviteBrandHeader({ title = "Workspace invitation" }: { title?: string }) {
  return (
    <div className="mb-6 text-center sm:text-left">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">SyncDesk</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{title}</h1>
    </div>
  )
}

function InvitePreviewCard({
  preview,
  loginHref,
  registerHref,
}: {
  preview: InvitePreview
  loginHref: string
  registerHref: string
}) {
  const showInviter = preview.inviterName && preview.inviterName !== "A teammate"

  return (
    <InviteCard>
      <InviteBrandHeader title="Workspace invitation" />

      <div className="space-y-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
          <span
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-3xl ring-1 ring-primary/20 shadow-inner shadow-primary/5"
            aria-hidden
          >
            {preview.workspaceIcon}
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-muted-foreground">You&apos;re invited to join</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{preview.workspaceName}</h2>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/30 p-4 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">Invited email</span>
            <span className="font-medium text-foreground">{preview.invitedEmail}</span>
          </div>
          {showInviter ? (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Invited by</span>
              <span className="font-medium text-foreground">{preview.inviterName}</span>
            </div>
          ) : null}
        </div>

        <p className="text-center text-sm leading-relaxed text-muted-foreground">
          Please log in or create an account to continue.
        </p>

        <div className="flex flex-col gap-2.5">
          <Button asChild className="h-11 w-full gap-2 shadow-md shadow-primary/25">
            <Link href={loginHref}>
              <LogIn className="size-4" aria-hidden />
              Log in
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 w-full gap-2 border-border/70 bg-background/50">
            <Link href={registerHref}>
              <UserPlus className="size-4" aria-hidden />
              Create account
            </Link>
          </Button>
        </div>
      </div>
    </InviteCard>
  )
}

function InvitePreviewFallbackCard({
  loginHref,
  registerHref,
  onRetry,
  isRetrying,
}: {
  loginHref: string
  registerHref: string
  onRetry: () => void
  isRetrying: boolean
}) {
  return (
    <InviteCard>
      <InviteBrandHeader title="Workspace invitation" />
      <div className="space-y-6">
        <InviteNeutralNotice
          title="Continue to accept your invite"
          body="Sign in or create an account with the email this invitation was sent to. We’ll verify the invite after you authenticate."
        />
        <div className="flex flex-col gap-2.5">
          <Button asChild className="h-11 w-full gap-2 shadow-md shadow-primary/25">
            <Link href={loginHref}>
              <LogIn className="size-4" aria-hidden />
              Log in
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 w-full gap-2 border-border/70 bg-background/50">
            <Link href={registerHref}>
              <UserPlus className="size-4" aria-hidden />
              Create account
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full gap-2 text-muted-foreground"
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Reload invitation
          </Button>
        </div>
      </div>
    </InviteCard>
  )
}

function WrongAccountCard({
  invitedEmail,
  currentEmail,
  loginHref,
  onSwitchAccount,
}: {
  invitedEmail: string
  currentEmail: string
  loginHref: string
  onSwitchAccount: () => void | Promise<void>
}) {
  return (
    <InviteCard>
      <InviteBrandHeader title="Wrong account" />
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 text-amber-900 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="font-medium">This invitation was sent to {invitedEmail}</p>
            <p className="text-xs leading-relaxed opacity-90">
              You&apos;re signed in as {currentEmail || "another account"}. Please log in with the correct account.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" className="w-full gap-2" onClick={() => void onSwitchAccount()}>
            <LogOut className="size-4" aria-hidden />
            Switch account
          </Button>
          <Button asChild variant="outline" className="w-full gap-2">
            <Link href={loginHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Back to login
            </Link>
          </Button>
        </div>
      </div>
    </InviteCard>
  )
}

function InviteTerminalCard({
  kind,
  preview,
  loginHref,
}: {
  kind: InviteTerminalState
  preview?: InvitePreview
  loginHref?: string
}) {
  const copy: Record<InviteTerminalState, { title: string; body: string }> = {
    invalid: {
      title: "Invitation not found",
      body: "This link may be incorrect or the invitation was removed. Ask the workspace owner to send a new invite.",
    },
    expired: {
      title: "Invitation expired",
      body: "This invitation is no longer valid. Ask the workspace owner to send a new invite.",
    },
    revoked: {
      title: "Invitation revoked",
      body: "The workspace owner cancelled this invitation. Request a new invite if you still need access.",
    },
    already_accepted: {
      title: "Already accepted",
      body: preview
        ? `This invitation to ${preview.workspaceName} was already used.`
        : "This invitation was already accepted.",
    },
  }
  const { title, body } = copy[kind]
  return (
    <InviteCard>
      <InviteBrandHeader />
      <InviteErrorCard
        title={title}
        body={body}
        actions={
          preview && kind === "already_accepted" ? (
            <Button asChild size="sm">
              <Link href={workspaceDashboardPath(preview)}>Open workspace</Link>
            </Button>
          ) : loginHref && kind === "already_accepted" ? (
            <Button asChild size="sm">
              <Link href={loginHref}>Log in</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/">Back to home</Link>
            </Button>
          )
        }
      />
    </InviteCard>
  )
}

function InviteNeutralNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

function InviteErrorCard({
  title,
  body,
  actions,
}: {
  title: string
  body: string
  actions?: ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/8 p-4 text-rose-700 dark:text-rose-300">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs leading-relaxed">{body}</p>
        </div>
      </div>
      {actions}
    </div>
  )
}

function InviteLoading({ label }: { label: string }) {
  return (
    <InviteCard>
      <InviteBrandHeader />
      <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
        <p>{label}</p>
      </div>
    </InviteCard>
  )
}
