"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import {
  useResendWorkspaceInviteMutation,
  useRevokeWorkspaceInviteMutation,
  useSendWorkspaceInvitesMutation,
  useWorkspaceInvitesQuery,
  useWorkspaceInvitesRealtime,
} from "@/hooks/use-workspace-invites"
import type { TeamMember, WorkspaceEntity } from "@/lib/boards/types"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import {
  buildInviteAcceptUrl,
  isInviteExpired,
  type WorkspaceInviteRole,
  type WorkspaceInviteRow,
} from "@/lib/syncdesk/workspace-invites-remote"
import { getFullNameFromMetadata } from "@/lib/user-profile"
import { cn } from "@/lib/utils"
import { getWorkspaceMembers, useBoardsStore } from "@/stores/boards-store"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ROLE_OPTIONS: { value: WorkspaceInviteRole; label: string; description: string }[] = [
  {
    value: "member",
    label: "Member",
    description: "Can view and contribute to all boards in this workspace.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Can manage boards, members, and workspace settings.",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access — sees boards but can’t edit tasks.",
  },
]

interface InviteChip {
  id: string
  email: string
  status: "valid" | "duplicate" | "existing-member" | "already-invited" | "invalid"
  matchedMember?: TeamMember
}

function chipMessage(chip: InviteChip): string {
  switch (chip.status) {
    case "valid":
      return "Will receive an email invitation"
    case "duplicate":
      return "Already in this list"
    case "existing-member":
      return `${chip.matchedMember?.name ?? "Member"} is already in the workspace`
    case "already-invited":
      return "An invitation is already pending"
    case "invalid":
    default:
      return "Not a valid email address"
  }
}

function chipToneClass(chip: InviteChip): string {
  switch (chip.status) {
    case "valid":
      return "border-primary/30 bg-primary/8 text-foreground"
    case "duplicate":
    case "already-invited":
    case "existing-member":
      return "border-amber-500/30 bg-amber-500/8 text-amber-900 dark:text-amber-200"
    case "invalid":
    default:
      return "border-rose-500/30 bg-rose-500/8 text-rose-700 dark:text-rose-300"
  }
}

function formatExpiry(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (Number.isNaN(ms)) return "expires soon"
  const days = Math.round(ms / (24 * 60 * 60 * 1000))
  if (days <= 0) return "expires today"
  if (days === 1) return "expires in 1 day"
  return `expires in ${days} days`
}

export function WorkspaceInviteDialog({
  workspace,
  teamMembers,
  open,
  onOpenChange,
}: {
  workspace: WorkspaceEntity
  teamMembers: TeamMember[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const supabaseConfigured = Boolean(getOptionalSupabaseClient())
  const teamMembersFromStore = useBoardsStore((s) => s.teamMembers)
  const invitesQuery = useWorkspaceInvitesQuery(open ? workspace.id : undefined)
  const sendMutation = useSendWorkspaceInvitesMutation(workspace.id)
  const revokeMutation = useRevokeWorkspaceInviteMutation(workspace.id)
  const resendMutation = useResendWorkspaceInviteMutation(workspace.id)

  useWorkspaceInvitesRealtime(open ? workspace.id : undefined)

  const [chips, setChips] = useState<InviteChip[]>([])
  const [draft, setDraft] = useState("")
  const [role, setRole] = useState<WorkspaceInviteRole>("member")
  const [message, setMessage] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  const memberSet = useMemo(() => new Set(workspace.memberIds), [workspace.memberIds])
  const memberByEmail = useMemo(() => {
    const map = new Map<string, TeamMember>()
    for (const m of teamMembers) {
      const email = (m as TeamMember & { email?: string | null }).email
      if (typeof email === "string" && email.trim()) {
        map.set(email.trim().toLowerCase(), m)
      }
    }
    return map
  }, [teamMembers])

  const pendingInviteEmails = useMemo(() => {
    const set = new Set<string>()
    for (const inv of invitesQuery.data ?? []) {
      if (inv.status === "pending") set.add(inv.invited_email.trim().toLowerCase())
    }
    return set
  }, [invitesQuery.data])

  const pendingInvites = useMemo(
    () => (invitesQuery.data ?? []).filter((i) => i.status === "pending"),
    [invitesQuery.data]
  )
  const recentlyAccepted = useMemo(
    () => (invitesQuery.data ?? []).filter((i) => i.status === "accepted").slice(0, 6),
    [invitesQuery.data]
  )

  const workspaceMembers = useMemo(
    () => getWorkspaceMembers(workspace, teamMembersFromStore),
    [workspace, teamMembersFromStore]
  )

  function classifyEmail(value: string, current: InviteChip[]): InviteChip {
    const id = `chip-${value}-${Math.random().toString(36).slice(2, 8)}`
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return { id, email: value, status: "invalid" }
    }
    if (!EMAIL_RE.test(normalized)) {
      return { id, email: value, status: "invalid" }
    }
    if (current.some((c) => c.email.toLowerCase() === normalized)) {
      return { id, email: value, status: "duplicate" }
    }
    const member = memberByEmail.get(normalized)
    if (member && memberSet.has(member.id)) {
      return { id, email: value, status: "existing-member", matchedMember: member }
    }
    if (pendingInviteEmails.has(normalized)) {
      return { id, email: value, status: "already-invited" }
    }
    return { id, email: value, status: "valid" }
  }

  function pushEmails(raw: string) {
    if (!raw.trim()) return
    const parts = raw
      .split(/[\s,;]+/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    setChips((curr) => {
      const next = [...curr]
      for (const part of parts) {
        next.push(classifyEmail(part, next))
      }
      return next
    })
  }

  function removeChip(id: string) {
    setChips((curr) => curr.filter((c) => c.id !== id))
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === ";" || event.key === "Tab") {
      if (draft.trim()) {
        event.preventDefault()
        pushEmails(draft)
        setDraft("")
      }
    } else if (event.key === "Backspace" && draft.length === 0 && chips.length > 0) {
      setChips((curr) => curr.slice(0, -1))
    }
  }

  function handleBlur() {
    if (draft.trim()) {
      pushEmails(draft)
      setDraft("")
    }
  }

  function reset() {
    setChips([])
    setDraft("")
    setMessage("")
    setRole("member")
  }

  const validEmails = useMemo(
    () => Array.from(new Set(chips.filter((c) => c.status === "valid").map((c) => c.email))),
    [chips]
  )
  const invalidCount = chips.filter((c) => c.status === "invalid").length
  const blockingCount = chips.filter(
    (c) => c.status === "invalid" || c.status === "duplicate"
  ).length

  async function copyInviteLink(invite: WorkspaceInviteRow) {
    const url = buildInviteAcceptUrl(invite.token)
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Invite link copied")
    } catch {
      toast.error("Couldn’t copy — your browser blocked clipboard access.")
    }
  }

  async function handleSubmit() {
    if (validEmails.length === 0) {
      if (chips.length === 0) {
        toast("Add an email address to send an invitation.")
      } else {
        toast.error("Resolve the highlighted invitations before sending.")
      }
      return
    }

    if (!supabaseConfigured || !user) {
      toast.error("Connect Supabase to send real email invitations.")
      return
    }

    const inviterName =
      getFullNameFromMetadata(user.user_metadata) ?? user.email?.split("@")[0] ?? "A teammate"

    const result = await sendMutation.mutateAsync({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      invitedBy: user.id,
      inviterName,
      inviterEmail: user.email ?? "",
      role,
      message: message.trim() || null,
      emails: validEmails,
    })

    const sentCount = result.created.length
    if (sentCount === 0 && result.failed.length > 0) {
      const duplicate = result.failed.some((f) =>
        f.reason.toLowerCase().includes("pending invitation already exists")
      )
      if (duplicate) {
        void invitesQuery.refetch()
        toast.error(
          "Couldn't send — a hidden pending invite may still exist for this email. Refresh the dialog; if it still fails, run the latest database migration (0017).",
          { id: "invite-duplicate" }
        )
      } else {
        toast.error(result.failed[0]?.reason ?? "Couldn't send invitations.")
      }
      return
    }

    if (result.emailDelivered > 0) {
      toast.success(
        sentCount === 1
          ? "Invitation sent — email delivered."
          : `${sentCount} invitations sent — ${result.emailDelivered} email${result.emailDelivered === 1 ? "" : "s"} delivered.`
      )
    }

    if (result.emailFailures.length > 0) {
      const f = result.emailFailures[0]
      toast.error(
        result.emailFailures.length === 1 && f
          ? `Email not sent for ${f.email}: ${f.reason}`
          : `${result.emailFailures.length} invitation(s) saved, but email delivery failed. Open the first pending invite to copy the link.`
      )
    }

    if (result.failed.length > 0) {
      toast.error(
        result.failed.length === 1
          ? `1 invitation failed: ${result.failed[0]?.reason ?? "unknown error"}`
          : `${result.failed.length} invitations failed.`
      )
    }

    reset()
  }

  // Reclassify chips when invites refresh / workspace members change.
  const dependencyKey = useMemo(
    () => `${pendingInviteEmails.size}|${memberSet.size}|${memberByEmail.size}`,
    [pendingInviteEmails, memberSet, memberByEmail]
  )
  const lastKeyRef = useRef(dependencyKey)
  useEffect(() => {
    if (lastKeyRef.current === dependencyKey) return
    lastKeyRef.current = dependencyKey
    setChips((curr) => {
      const next: InviteChip[] = []
      for (const c of curr) next.push(classifyEmail(c.email, next))
      return next
    })
    // We intentionally exclude classifyEmail; it depends on the same deps as dependencyKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey])

  const submitDisabled =
    sendMutation.isPending || validEmails.length === 0 || (blockingCount > 0 && validEmails.length === 0)

  const submitLabel = sendMutation.isPending
    ? "Sending…"
    : validEmails.length === 1
      ? "Send invitation"
      : validEmails.length > 1
        ? `Send ${validEmails.length} invitations`
        : "Send invitation"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[85vh] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-2xl lg:max-w-4xl xl:max-w-[60rem]"
        )}
      >
        <DialogHeader className="relative flex flex-row items-start justify-between gap-4 border-b border-border/60 bg-gradient-to-br from-primary/[0.06] via-card to-card px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <UserPlus className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate text-base">
                Invite to {workspace.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Invite people by email. Once they accept, they can access every board in this
                workspace.
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            onClick={() => onOpenChange(false)}
            aria-label="Close invite dialog"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* LEFT — primary invite workflow */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 lg:border-r lg:border-border/60">
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="invite-email-input"
                  className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Invite by email
                </Label>
                <RolePicker value={role} onChange={setRole} />
              </div>

              <div
                className="group/email flex min-h-[64px] w-full cursor-text flex-wrap items-start content-start gap-1.5 rounded-xl border border-input bg-background px-2.5 py-2 text-sm shadow-sm transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20"
                onClick={() => inputRef.current?.focus()}
                role="presentation"
              >
                <AnimatePresence initial={false}>
                  {chips.map((chip) => (
                    <motion.span
                      key={chip.id}
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.14 }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                        chipToneClass(chip)
                      )}
                      title={chipMessage(chip)}
                    >
                      <Mail className="size-3 opacity-70" aria-hidden />
                      <span className="max-w-[22ch] truncate">{chip.email}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeChip(chip.id)
                        }}
                        className="rounded-full p-0.5 transition-colors hover:bg-foreground/10"
                        aria-label={`Remove ${chip.email}`}
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>

                <input
                  ref={inputRef}
                  id="invite-email-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  onBlur={handleBlur}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text")
                    if (/[,;\s]/.test(text)) {
                      e.preventDefault()
                      pushEmails(text)
                    }
                  }}
                  placeholder={
                    chips.length === 0
                      ? "Enter email addresses to invite teammates"
                      : "Add another email…"
                  }
                  aria-label="Email addresses"
                  className="min-w-[10rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  Press{" "}
                  <kbd className="rounded border border-border/60 bg-muted px-1 py-0.5 text-[10px] font-medium">
                    Enter
                  </kbd>
                  ,{" "}
                  <kbd className="rounded border border-border/60 bg-muted px-1 py-0.5 text-[10px] font-medium">
                    ,
                  </kbd>{" "}
                  or paste a list to add multiple emails.
                </span>
                {invalidCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-rose-600">
                    <AlertCircle className="size-3" aria-hidden />
                    {invalidCount} need fixing
                  </span>
                ) : validEmails.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <Check className="size-3" aria-hidden />
                    {validEmails.length} ready
                  </span>
                ) : null}
              </div>
            </section>

            <section className="space-y-1.5">
              <Label htmlFor="invite-message" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Personal note <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
              </Label>
              <Input
                id="invite-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                placeholder={`e.g. Welcome to ${workspace.name} — excited to have you!`}
              />
              <p className="text-right text-[10px] text-muted-foreground">
                {message.length}/200
              </p>
            </section>

          </div>

          {/* RIGHT — workspace collaboration info */}
          <aside className="flex min-h-0 max-h-[40vh] flex-col gap-4 overflow-y-auto border-t border-border/60 bg-muted/[0.18] px-5 py-4 lg:max-h-none lg:border-t-0">
            <PermissionsSummary
              role={role}
              memberCount={workspaceMembers.length}
              pendingCount={pendingInvites.length}
            />

            <PendingInvitesSection
              invites={pendingInvites}
              isLoading={invitesQuery.isPending}
              loadError={invitesQuery.isError ? invitesQuery.error?.message : null}
              supabaseConfigured={supabaseConfigured}
              onCopy={copyInviteLink}
              onRevoke={(id) => revokeMutation.mutate(id)}
              onResend={(inv) =>
                resendMutation.mutate({
                  inviteId: inv.id,
                  workspaceName: workspace.name,
                  inviterName:
                    getFullNameFromMetadata(user?.user_metadata) ??
                    user?.email?.split("@")[0] ??
                    "A teammate",
                  inviterEmail: user?.email ?? "",
                })
              }
              revoking={revokeMutation.isPending ? revokeMutation.variables : null}
              resending={
                resendMutation.isPending ? resendMutation.variables?.inviteId ?? null : null
              }
            />

            <MembersSection members={workspaceMembers} recentlyAccepted={recentlyAccepted} />
          </aside>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-card px-5 py-3">
          <div className="hidden text-[11px] text-muted-foreground sm:flex sm:items-center sm:gap-1">
            <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden />
            Invites expire after 14 days.
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
              disabled={sendMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={submitDisabled}
              className="gap-2"
            >
              {sendMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PermissionsSummary({
  role,
  memberCount,
  pendingCount,
}: {
  role: WorkspaceInviteRole
  memberCount: number
  pendingCount: number
}) {
  const desc = ROLE_OPTIONS.find((r) => r.value === role)?.description ?? ""
  return (
    <section className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm shadow-black/[0.02]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <ShieldCheck className="size-3.5 text-primary" aria-hidden />
        Invite summary
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg border border-border/60 bg-background/70 px-2 py-1.5">
          <p className="text-base font-semibold tabular-nums text-foreground">{memberCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Members</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/70 px-2 py-1.5">
          <p className="text-base font-semibold tabular-nums text-foreground">{pendingCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        New invites join as{" "}
        <span className="font-medium capitalize text-foreground">{role}</span>. {desc}
      </p>
    </section>
  )
}

function RolePicker({
  value,
  onChange,
}: {
  value: WorkspaceInviteRole
  onChange: (next: WorkspaceInviteRole) => void
}) {
  const active = ROLE_OPTIONS.find((r) => r.value === value) ?? ROLE_OPTIONS[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          aria-label="Invite role"
        >
          <ShieldCheck className="size-3.5 text-primary" aria-hidden />
          {active.label}
          <ChevronDown className="size-3 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Invite as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ROLE_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex flex-col items-start gap-0.5"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {opt.label}
              {opt.value === value ? <Check className="size-3.5 text-primary" aria-hidden /> : null}
            </span>
            <span className="text-[11px] text-muted-foreground">{opt.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PendingInvitesSection({
  invites,
  isLoading,
  loadError,
  supabaseConfigured,
  onCopy,
  onRevoke,
  onResend,
  revoking,
  resending,
}: {
  invites: WorkspaceInviteRow[]
  isLoading: boolean
  loadError?: string | null
  supabaseConfigured: boolean
  onCopy: (invite: WorkspaceInviteRow) => void
  onRevoke: (id: string) => void
  onResend: (invite: WorkspaceInviteRow) => void
  revoking: string | null
  resending: string | null
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="size-3.5 text-muted-foreground" aria-hidden />
          <p className="text-xs font-semibold text-foreground">Pending invitations</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {invites.length}
        </span>
      </div>

      {!supabaseConfigured ? (
        <EmptyHint
          icon={<Mail className="size-3.5 text-muted-foreground" aria-hidden />}
          body="Configure Supabase + apply the 0002_workspace_invites migration to enable email invites."
        />
      ) : loadError ? (
        <EmptyHint
          icon={<Mail className="size-3.5 text-rose-500" aria-hidden />}
          body={loadError}
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/60 px-2 py-3 text-[11px] text-muted-foreground">
          <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden /> Loading…
        </div>
      ) : invites.length === 0 ? (
        <EmptyHint
          icon={<Clock className="size-3.5 text-muted-foreground" aria-hidden />}
          body="No pending invitations — people you invite show up here until they accept."
        />
      ) : (
        <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-background/70">
          {invites.map((inv) => {
            const expired = isInviteExpired(inv)
            return (
            <li key={inv.id} className="group/inv flex items-center gap-2 px-2.5 py-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full ring-1",
                  expired
                    ? "bg-rose-500/10 text-rose-700 ring-rose-500/20"
                    : "bg-amber-500/10 text-amber-700 ring-amber-500/20"
                )}
              >
                <Mail className="size-3" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-xs font-medium text-foreground">
                    {inv.invited_email}
                  </span>
                  <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    {inv.role}
                  </span>
                  {expired ? (
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-700">
                      Expired
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="size-2.5" aria-hidden />
                  {expired ? "Expired — revoke to invite again" : formatExpiry(inv.expires_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover/inv:opacity-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground"
                  aria-label="Copy invite link"
                  onClick={() => onCopy(inv)}
                >
                  <Copy className="size-3" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground"
                  aria-label="Resend invite"
                  disabled={resending === inv.id}
                  onClick={() => onResend(inv)}
                >
                  {resending === inv.id ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="size-3" aria-hidden />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-rose-600"
                  aria-label="Revoke invite"
                  disabled={revoking === inv.id}
                  onClick={() => onRevoke(inv.id)}
                >
                  {revoking === inv.id ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                  ) : (
                    <X className="size-3" aria-hidden />
                  )}
                </Button>
              </div>
            </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function MembersSection({
  members,
  recentlyAccepted,
}: {
  members: TeamMember[]
  recentlyAccepted: WorkspaceInviteRow[]
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-3.5 text-muted-foreground" aria-hidden />
          <p className="text-xs font-semibold text-foreground">Workspace members</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {members.length}
        </span>
      </div>
      {members.length === 0 ? (
        <EmptyHint
          icon={<Users className="size-3.5 text-muted-foreground" aria-hidden />}
          body="You’re the only one here — invite teammates to start collaborating."
        />
      ) : (
        <ul className="flex flex-wrap gap-1">
          {members.slice(0, 18).map((m) => (
            <li
              key={m.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-1.5 py-0.5 text-[11px]"
              title={m.name}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[9px] font-semibold ring-2 ring-card",
                  m.color
                )}
              >
                {m.initials}
              </span>
              <span className="max-w-[10ch] truncate text-foreground">{m.name}</span>
            </li>
          ))}
          {members.length > 18 ? (
            <li className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              +{members.length - 18}
            </li>
          ) : null}
        </ul>
      )}
      {recentlyAccepted.length > 0 ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-2 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Recently joined
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
            {recentlyAccepted.map((r) => r.invited_email).join(", ")}
          </p>
        </div>
      ) : null}
    </section>
  )
}

function EmptyHint({ icon, body }: { icon: React.ReactNode; body: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-border/60 bg-background/40 px-2.5 py-2">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/50">
        {icon}
      </span>
      <p className="text-[11px] leading-snug text-muted-foreground">{body}</p>
    </div>
  )
}
