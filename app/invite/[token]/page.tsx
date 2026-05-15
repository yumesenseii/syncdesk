"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { AlertCircle, CheckCircle2, Loader2, LogIn, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useAcceptInviteMutation } from "@/hooks/use-workspace-invites"
import { getOptionalSupabaseClient } from "@/lib/supabase"

export default function AcceptInvitePage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ""
  const { user, loading } = useAuth()
  const acceptMutation = useAcceptInviteMutation()
  const supabaseConfigured = Boolean(getOptionalSupabaseClient())
  const triggeredRef = useRef(false)

  useEffect(() => {
    if (loading) return
    if (!user) return
    if (!token) return
    if (triggeredRef.current) return
    if (!supabaseConfigured) return
    triggeredRef.current = true
    acceptMutation.mutate(token)
    // The mutation is stable; we only want to fire it once when prerequisites are met.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, token, supabaseConfigured])

  const result = acceptMutation.data
  const errorMessage = acceptMutation.error?.message ?? null

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-card px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 shadow-lg shadow-foreground/[0.04]">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <UserPlus className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              SyncDesk
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Workspace invitation
            </h1>
          </div>
        </div>

        {!supabaseConfigured ? (
          <ErrorBlock
            title="Supabase isn’t configured"
            body="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment to accept invitations."
          />
        ) : loading ? (
          <LoadingBlock label="Checking your session…" />
        ) : !user ? (
          <SignInBlock
            onContinue={() => {
              router.push(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)
            }}
          />
        ) : acceptMutation.isError ? (
          <ErrorBlock
            title="We couldn’t accept this invitation"
            body={errorMessage ?? "Please double-check the link or ask the workspace owner to resend it."}
            actions={
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            }
          />
        ) : acceptMutation.isSuccess && result ? (
          <SuccessBlock
            workspaceName={result.workspace_name}
            onContinue={() =>
              router.push(
                `/dashboard/workspaces/${result.workspace_slug ?? result.workspace_id}`
              )
            }
          />
        ) : (
          <LoadingBlock label="Joining workspace…" />
        )}
      </div>
    </div>
  )
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      {label}
    </div>
  )
}

function SignInBlock({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <p className="text-sm font-medium text-foreground">Sign in to continue</p>
        <p className="mt-1 text-xs text-muted-foreground">
          You need a SyncDesk account that matches the email this invitation was sent to.
        </p>
      </div>
      <Button type="button" onClick={onContinue} className="w-full gap-2">
        <LogIn className="size-4" aria-hidden /> Continue to sign in
      </Button>
    </div>
  )
}

function ErrorBlock({
  title,
  body,
  actions,
}: {
  title: string
  body: string
  actions?: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/8 p-4 text-rose-700 dark:text-rose-300">
        <AlertCircle className="mt-0.5 size-4" aria-hidden />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs">{body}</p>
        </div>
      </div>
      {actions}
    </div>
  )
}

function SuccessBlock({
  workspaceName,
  onContinue,
}: {
  workspaceName: string
  onContinue: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4 text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="mt-0.5 size-4" aria-hidden />
        <div>
          <p className="text-sm font-medium">You’re in!</p>
          <p className="mt-1 text-xs">
            You’ve joined <span className="font-semibold">{workspaceName}</span>. Welcome aboard.
          </p>
        </div>
      </div>
      <Button type="button" onClick={onContinue} className="w-full">
        Open workspace
      </Button>
    </div>
  )
}
