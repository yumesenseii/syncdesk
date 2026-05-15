"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import {
  ArrowUpRight,
  Crown,
  Snowflake,
  TrendingUp,
  Users,
} from "lucide-react"

import { useAnimatedNumber } from "@/hooks/use-animated-number"
import { computeAnalyticsSummary } from "@/lib/analytics/metrics"
import { cn } from "@/lib/utils"
import { useBoardsStore } from "@/stores/boards-store"

function AnimatedNumber({
  value,
  decimals = 0,
  delay = 0,
}: {
  value: number
  decimals?: number
  delay?: number
}) {
  const animated = useAnimatedNumber(value, { delay })
  return <>{animated.toFixed(decimals)}</>
}

export function DashboardContributionIntelligence() {
  const workspaces = useBoardsStore((s) => s.workspaces)
  const boardsById = useBoardsStore((s) => s.boardsById)
  const tasksByBoardId = useBoardsStore((s) => s.tasksByBoardId)
  const teamMembers = useBoardsStore((s) => s.teamMembers)

  const summary = useMemo(
    () =>
      computeAnalyticsSummary(
        { workspaces, boardsById, tasksByBoardId, teamMembers, workspaceId: "all" },
        "7d"
      ),
    [workspaces, boardsById, tasksByBoardId, teamMembers]
  )

  const contributors = summary.workloadByMember.filter((m) => m.assigned > 0).slice(0, 5)
  const totalShipped = contributors.reduce((s, c) => s + c.completed, 0)
  const max = contributors[0]?.assigned ?? 0
  const engagementScore = summary.teamEfficiency

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      aria-labelledby="contrib-intel-heading"
      className="group/card relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card ring-1 ring-foreground/[0.04] transition-[box-shadow,transform,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/[0.06]"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/[0.05] blur-3xl transition-opacity duration-500 ease-out group-hover/card:bg-primary/[0.09]"
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-3 border-b border-border/60 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-sky-500/15 text-primary">
            <Users className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3
              id="contrib-intel-heading"
              className="text-base font-semibold tracking-tight text-foreground"
            >
              Contribution Intelligence
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {contributors.length === 0
                ? "Assign tasks to teammates to start tracking participation."
                : "How your team is showing up right now"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              <AnimatedNumber value={engagementScore} />
            </span>
            <span className="text-xs font-medium text-muted-foreground">/100</span>
          </div>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-700">
            <TrendingUp className="size-2.5" aria-hidden />
            Team efficiency
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col gap-4 p-5">
        {contributors.length === 0 ? (
          <EmptyContributors />
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Top contributors
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                <AnimatedNumber value={totalShipped} /> shipped
              </span>
            </div>
            <ul className="space-y-2">
              {contributors.map((c, i) => (
                <motion.li
                  key={c.member.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 + i * 0.04 }}
                  className="grid grid-cols-[1rem_auto_1fr_auto] items-center gap-2.5"
                >
                  <span className="text-right text-[10px] font-bold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="relative">
                    <div
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg text-[11px] font-semibold",
                        c.member.color
                      )}
                      aria-hidden
                    >
                      {c.member.initials}
                    </div>
                    {i === 0 ? (
                      <span
                        className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-amber-500 text-white ring-2 ring-card"
                        aria-label="Top contributor"
                      >
                        <Crown className="size-2" aria-hidden />
                      </span>
                    ) : null}
                    {i === contributors.length - 1 && contributors.length > 1 ? (
                      <span
                        className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-slate-400 text-white ring-2 ring-card"
                        aria-label="Least active"
                      >
                        <Snowflake className="size-2" aria-hidden />
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="hidden min-w-0 sm:block">
                      <div className="truncate text-xs font-semibold text-foreground">
                        {c.member.name}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {c.share}% of workload
                      </div>
                    </div>
                    <span className="truncate text-xs font-semibold text-foreground sm:hidden">
                      {c.member.name.split(" ")[0]}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/70">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${max === 0 ? 0 : (c.assigned / max) * 100}%` }}
                        transition={{
                          duration: 0.9,
                          delay: 0.15 + i * 0.05,
                          ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                        className={cn(
                          "h-full rounded-full",
                          i === 0 && "bg-gradient-to-r from-amber-400 to-orange-500",
                          i === 1 && "bg-gradient-to-r from-primary to-sky-400",
                          i === 2 && "bg-gradient-to-r from-emerald-500 to-teal-400",
                          i === 3 && "bg-gradient-to-r from-fuchsia-500 to-pink-400",
                          i >= 4 && "bg-gradient-to-r from-slate-400 to-slate-300"
                        )}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold tabular-nums text-foreground">
                      <AnimatedNumber value={c.assigned} delay={i * 0.04} />
                    </span>
                    <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-700">
                      <ArrowUpRight className="size-2.5" aria-hidden />
                      {c.completed}/{c.assigned}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-auto space-y-2 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workload across workspaces
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {summary.workloadByWorkspace.length} workspace
              {summary.workloadByWorkspace.length === 1 ? "" : "s"}
            </span>
          </div>
          {summary.workloadByWorkspace.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Create a workspace to see how work is distributed across your team.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {summary.workloadByWorkspace.slice(0, 4).map((w) => (
                <li key={w.workspaceId} className="flex items-center gap-2 text-[11px]">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {w.name}
                  </span>
                  <div className="h-1 w-20 overflow-hidden rounded-full bg-muted/70">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${w.pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums text-muted-foreground">
                    {w.pct}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.section>
  )
}

function EmptyContributors() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-10 text-center">
      <Users className="size-5 text-muted-foreground" aria-hidden />
      <p className="text-sm font-semibold text-foreground">No contributions yet</p>
      <p className="max-w-[28ch] text-xs text-muted-foreground">
        Once you assign tasks to teammates, their workload and completion rate will appear here.
      </p>
    </div>
  )
}
