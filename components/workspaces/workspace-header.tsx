"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Mail,
  Settings,
  UserPlus,
  Users,
} from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/ui/user-avatar"
import { Card } from "@/components/ui/card"
import {
  useWorkspaceInvitesQuery,
  useWorkspaceInvitesRealtime,
} from "@/hooks/use-workspace-invites"
import { cn } from "@/lib/utils"
import {
  healthAccent,
  type WorkspaceMetrics,
} from "@/lib/workspaces/workspace-metrics"

export function WorkspaceHeader({
  metrics,
  onInvite,
}: {
  metrics: WorkspaceMetrics
  onInvite: () => void
}) {
  const { workspace, members, totalTasks, completedTasks, overdueTasks, completionPct, health, boards } = metrics

  useWorkspaceInvitesRealtime(workspace.id)
  const invitesQuery = useWorkspaceInvitesQuery(workspace.id)
  const pendingInvites = useMemo(
    () => (invitesQuery.data ?? []).filter((i) => i.status === "pending").length,
    [invitesQuery.data]
  )

  return (
    <Card className="relative overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.04] p-5 shadow-sm shadow-black/[0.04] sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl ring-1 ring-primary/15"
              aria-hidden
            >
              {workspace.icon}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {workspace.name}
                </h1>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    healthAccent(health)
                  )}
                >
                  {health}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                A collaborative workspace with {boards.length} {boards.length === 1 ? "board" : "boards"} ·{" "}
                {members.length} {members.length === 1 ? "member" : "members"}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={onInvite}
              size="sm"
              className="h-9 gap-2"
              aria-label="Invite members"
            >
              <UserPlus className="size-4" aria-hidden />
              Invite members
              {pendingInvites > 0 ? (
                <span
                  className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold"
                  aria-label={`${pendingInvites} pending invitations`}
                >
                  <Mail className="size-3" aria-hidden />
                  {pendingInvites}
                </span>
              ) : null}
            </Button>
            <Button
              asChild
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2"
            >
              <Link href={`/dashboard/settings/workspace/${workspace.slug}`}>
                <Settings className="size-4" aria-hidden />
                Workspace settings
              </Link>
            </Button>
            <Button asChild type="button" variant="ghost" size="sm" className="h-9 gap-2">
              <Link href="/dashboard/boards">
                <Layers className="size-4" aria-hidden />
                All workspaces
              </Link>
            </Button>

            <div className="ml-1 flex items-center gap-2">
              <div className="flex -space-x-2">
                {members.slice(0, 6).map((m) => (
                  <UserAvatar
                    key={m.id}
                    name={m.name}
                    initials={m.initials}
                    avatarUrl={m.avatarUrl}
                    color={m.color}
                    size="sm"
                    className="ring-2 ring-card"
                    ringClassName=""
                  />
                ))}
                {members.length > 6 ? (
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-2 ring-card">
                    +{members.length - 6}
                  </div>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">
                {members.length > 0 ? `${members.length} collaborators` : "Add teammates"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[22rem]">
          <ProgressTile completionPct={completionPct} completed={completedTasks} total={totalTasks} />

          <div className="grid grid-cols-2 gap-3">
            <SummaryTile
              icon={<Layers className="size-4 text-sky-600" aria-hidden />}
              label="Boards"
              value={boards.length.toString()}
              tone="sky"
            />
            <SummaryTile
              icon={<CheckCircle2 className="size-4 text-emerald-600" aria-hidden />}
              label="Done"
              value={`${completedTasks}/${totalTasks}`}
              tone="emerald"
            />
            <SummaryTile
              icon={<AlertTriangle className="size-4 text-rose-600" aria-hidden />}
              label="Overdue"
              value={overdueTasks.toString()}
              tone={overdueTasks === 0 ? "muted" : "rose"}
            />
            <SummaryTile
              icon={<Users className="size-4 text-primary" aria-hidden />}
              label="Team"
              value={members.length.toString()}
              tone="primary"
            />
          </div>
        </div>
      </motion.div>
    </Card>
  )
}

function ProgressTile({
  completionPct,
  completed,
  total,
}: {
  completionPct: number
  completed: number
  total: number
}) {
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (completionPct / 100) * circumference

  return (
    <div className="row-span-2 flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm shadow-black/[0.03]">
      <div className="relative flex items-center justify-center">
        <svg viewBox="0 0 80 80" className="size-24 -rotate-90" aria-hidden>
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="var(--muted)"
            strokeWidth={8}
            fill="none"
          />
          <motion.circle
            cx="40"
            cy="40"
            r={radius}
            stroke="var(--primary)"
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            strokeDasharray={circumference}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-foreground">{completionPct}%</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Done</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-foreground">Completion</p>
        <p className="text-[11px] text-muted-foreground">
          {completed} of {total} tasks
        </p>
      </div>
    </div>
  )
}

function SummaryTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: "sky" | "emerald" | "rose" | "primary" | "muted"
}) {
  const toneClass: Record<typeof tone, string> = {
    sky: "bg-sky-500/8 ring-sky-500/15",
    emerald: "bg-emerald-500/8 ring-emerald-500/15",
    rose: "bg-rose-500/10 ring-rose-500/15",
    primary: "bg-primary/8 ring-primary/15",
    muted: "bg-muted/40 ring-border/60",
  }
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl p-3 ring-1",
        toneClass[tone]
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}
