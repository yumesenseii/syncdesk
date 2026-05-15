"use client"

import { motion } from "framer-motion"
import { Crown, MoonStar, Sparkles, TrendingUp, Users } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserAvatar } from "@/components/ui/user-avatar"
import { cn } from "@/lib/utils"
import type { WorkspaceMetrics } from "@/lib/workspaces/workspace-metrics"

export function WorkspaceContribution({ metrics }: { metrics: WorkspaceMetrics }) {
  const {
    topContributor,
    leastActiveMember,
    contributors,
    participationScore,
    workloadBalanceScore,
    velocityScore,
  } = metrics

  return (
    <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Sparkles className="size-4 text-primary" aria-hidden />
              Workspace intelligence
            </CardTitle>
            <CardDescription>
              Live contribution analysis from this workspace’s real task assignments.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ScorePill icon={<TrendingUp className="size-3.5" aria-hidden />} label="Velocity" value={velocityScore} tone="emerald" />
            <ScorePill icon={<Users className="size-3.5" aria-hidden />} label="Participation" value={participationScore} tone="sky" />
            <ScorePill icon={<Sparkles className="size-3.5" aria-hidden />} label="Balance" value={workloadBalanceScore} tone="violet" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-5 pb-5">
        <div className="grid gap-3 lg:grid-cols-2">
          <ContributorSpotlight
            tone="emerald"
            title="Top contributor"
            icon={<Crown className="size-4 text-amber-500" aria-hidden />}
            stat={topContributor}
            fallback="No assignments yet — invite members and create tasks to see your top contributor."
            metricLabel="completed"
            metricValueFn={(c) => c.completed}
            secondaryLabel="assigned"
            secondaryValueFn={(c) => c.assigned}
          />
          <ContributorSpotlight
            tone="amber"
            title="Least active"
            icon={<MoonStar className="size-4 text-amber-600" aria-hidden />}
            stat={leastActiveMember}
            fallback="Everyone is contributing — no inactivity detected."
            metricLabel="completed"
            metricValueFn={(c) => c.completed}
            secondaryLabel="overdue"
            secondaryValueFn={(c) => c.overdue}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Contribution distribution</h3>
            <span className="text-[11px] text-muted-foreground">
              Share of total task assignments
            </span>
          </div>
          {contributors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contributions to display yet.</p>
          ) : (
            <ul className="space-y-2">
              {contributors.slice(0, 8).map((c, i) => {
                const widthPct = Math.max(c.share, c.assigned > 0 ? 4 : 0)
                return (
                  <li key={c.member.id} className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={c.member.name}
                        initials={c.member.initials}
                        avatarUrl={c.member.avatarUrl}
                        color={c.member.color}
                        size="sm"
                        className="ring-2 ring-card"
                        ringClassName=""
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {c.member.name}
                          </span>
                          <span className="text-xs font-semibold tabular-nums text-foreground">
                            {c.share}%
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>
                            <span className="font-medium text-foreground">{c.assigned}</span> assigned
                          </span>
                          <span>
                            <span className="font-medium text-emerald-700">{c.completed}</span> completed
                          </span>
                          {c.overdue > 0 ? (
                            <span className="font-medium text-rose-600">{c.overdue} overdue</span>
                          ) : null}
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${widthPct}%` }}
                            transition={{ duration: 0.5, delay: i * 0.04, ease: [0.4, 0, 0.2, 1] }}
                            className="h-full rounded-full bg-gradient-to-r from-primary via-sky-500 to-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ScorePill({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: "emerald" | "sky" | "violet"
}) {
  const toneClass = {
    emerald: "border-emerald-500/20 bg-emerald-500/8 text-emerald-700",
    sky: "border-sky-500/20 bg-sky-500/8 text-sky-700",
    violet: "border-fuchsia-500/20 bg-fuchsia-500/8 text-fuchsia-700",
  }[tone]
  return (
    <span
      className={cn(
        "hidden items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium sm:inline-flex",
        toneClass
      )}
    >
      {icon}
      {label}
      <span className="tabular-nums">{value}</span>
    </span>
  )
}

function ContributorSpotlight<C extends { member: { id: string; name: string; initials: string; color: string } }>({
  tone,
  title,
  icon,
  stat,
  fallback,
  metricLabel,
  metricValueFn,
  secondaryLabel,
  secondaryValueFn,
}: {
  tone: "emerald" | "amber"
  title: string
  icon: React.ReactNode
  stat: C | null
  fallback: string
  metricLabel: string
  metricValueFn: (c: C) => number
  secondaryLabel: string
  secondaryValueFn: (c: C) => number
}) {
  const toneClass =
    tone === "emerald"
      ? "from-emerald-500/8 to-card border-emerald-500/15"
      : "from-amber-500/8 to-card border-amber-500/15"

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4", toneClass)}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      {stat ? (
        <div className="mt-3 flex items-center gap-3">
          <span
            className={cn(
              "flex size-12 items-center justify-center rounded-full text-sm font-semibold ring-2 ring-card",
              stat.member.color
            )}
          >
            {stat.member.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{stat.member.name}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{metricValueFn(stat)}</span> {metricLabel}
              <span aria-hidden> · </span>
              <span className="font-semibold text-foreground">{secondaryValueFn(stat)}</span> {secondaryLabel}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{fallback}</p>
      )}
    </div>
  )
}
