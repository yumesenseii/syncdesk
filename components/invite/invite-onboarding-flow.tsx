"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, type ReactNode } from "react"
import {
  AlertCircle,
  ArrowLeft,
  Clock,
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
  formatInviteExpiry,
  getInviteTerminalState,
  parseAcceptInviteError,
  persistInviteToken,
  workspaceDashboardPath,
  type InvitePreview,
  type InviteTerminalState,
} from "@/lib/invite"
import { emailsMatch, formatInviteRole } from "@/lib/invite/invite-email"
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
    if (!token || acceptTriggeredRef.current) return
    acceptTriggeredRef.current = true
    acceptMutation.mutate(token, {
      onSuccess: (data) => finishJoin(data),
      onError: () => {
        acceptTriggeredRef.current = false
      },
    })
  }, [acceptMutation, finishJoin, token])

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
    router.push(loginHref)
  }, [loginHref, router])

  if (!supabaseConfigured) {
    return (
      <InviteShell>
        <InviteCard>
          <InviteBrandHeader />
          <InviteErrorCard
            title="Supabase isn’t configured"
            body="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to accept invitations."
          />
        </InviteCard>
      </InviteShell>
    )
  }

  if (!token) {
    return (
      <InviteShell>
        <InviteCard>
          <InviteBrandHeader />
          <InviteErrorCard title="Invalid link" body="This invitation link is missing a token." />
        </InviteCard>
      </InviteShell>
    )
  }

  if (previewQuery.isLoading || authLoading) {
    return (
      <InviteShell>
        <InviteLoading label="Loading invitation…" />
      </InviteShell>
    )
  }

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
        <InviteTerminalCard kind="invalid" />
      </InviteShell>
    )
  }

  if (terminal) {
    return (
      <InviteShell>
        <InviteTerminalCard kind={terminal} preview={preview} />
      </InviteShell>
    )
  }

  if (!user) {
    return (
      <InviteShell>
        <InvitePreviewCard preview={preview} loginHref={loginHref} registerHref={registerHref} />
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
          <InviteTerminalCard kind={parsed.kind} preview={preview} />
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-card px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}

function InviteCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-lg shadow-foreground/[0.04] transition-shadow duration-300">
      {children}
    </div>
  )
}

function InviteBrandHeader() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
        <UserPlus className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">SyncDesk</p>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Workspace invitation</h1>
      </div>
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
  return (
    <InviteCard>
      <InviteBrandHeader />
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl ring-1 ring-primary/15"
            aria-hidden
          >
            {preview.workspaceIcon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              You&apos;re invited to join
            </p>
            <h2 className="truncate text-xl font-semibold tracking-tight text-foreground">
              {preview.workspaceName}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{preview.inviterName}</span> invited you as{" "}
              <span className="font-medium text-primary">{formatInviteRole(preview.role)}</span>
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Invited as</span>
            <span className="truncate font-medium text-foreground">{preview.invitedEmail}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Access</span>
            <span className="font-medium text-foreground">{formatInviteRole(preview.role)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Expires</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Clock className="size-3.5 text-primary" aria-hidden />
              {formatInviteExpiry(preview.expiresAt)}
            </span>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Sign in or create an account with{" "}
          <span className="font-medium text-foreground">{preview.invitedEmail}</span> to join.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="w-full gap-2 shadow-md shadow-primary/20">
            <Link href={loginHref}>
              <LogIn className="size-4" aria-hidden />
              Log in
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full gap-2">
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
      <InviteBrandHeader />
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 text-amber-900 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Wrong account</p>
            <p className="text-xs leading-relaxed opacity-90">
              This invitation was sent to{" "}
              <span className="font-semibold">{invitedEmail}</span>. You&apos;re signed in as{" "}
              <span className="font-semibold">{currentEmail || "another account"}</span>. Please log in with the
              correct account.
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
}: {
  kind: InviteTerminalState
  preview?: InvitePreview
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
        ? `This invitation to ${preview.workspaceName} was already used. Sign in to open the workspace.`
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
