"use client"

import { useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { AlarmClock, ShieldAlert, ShieldCheck } from "lucide-react"
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip } from "recharts"

import { useAnimatedNumber } from "@/hooks/use-animated-number"
import { computeAnalyticsSummary } from "@/lib/analytics/metrics"
import { parseDueDate } from "@/lib/calendar/events"
import { cn } from "@/lib/utils"
import { useBoardsStore } from "@/stores/boards-store"
import type { BoardTask, TaskPriority } from "@/lib/boards/types"

const TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "0.65rem",
  fontSize: "12px",
  boxShadow: "0 8px 24px rgb(15 23 42 / 8%)",
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

interface UpcomingRiskItem {
  taskId: string
  boardId: string
  workspaceSlug: string | null
  title: string
  workspaceName: string
  priority: TaskPriority
  due: string
  daysOut: number
}

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

function PriorityPill({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
        priority === "Urgent" && "border-rose-400/35 bg-rose-500/10 text-rose-700",
        priority === "High" && "border-amber-400/35 bg-amber-500/10 text-amber-700",
        priority === "Medium" && "border-sky-400/35 bg-sky-500/10 text-sky-700",
        priority === "Low" && "border-emerald-400/35 bg-emerald-500/10 text-emerald-700"
      )}
    >
      {priority}
    </span>
  )
}

function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

export function DashboardProjectRiskMonitor() {
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

  const { weeklyOverdue, upcomingRisks, deadlinePressurePct, highRiskWorkspaces } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const overdueByWeekday = new Map<number, number>()
    for (let i = 0; i < 7; i += 1) overdueByWeekday.set(i, 0)

    const upcoming: UpcomingRiskItem[] = []

    for (const [boardId, list] of Object.entries(tasksByBoardId)) {
      const board = boardsById[boardId]
      if (!board) continue
      const workspace = workspaces.find((w) => w.id === board.workspaceId)
      for (const t of list as BoardTask[]) {
        const date = parseDueDate(t.due, today)
        if (!date) continue
        const days = daysBetween(date, today)
        if (t.columnId !== "completed") {
          if (days < 0) {
            // Overdue tasks contribute to the weekday histogram on the day they
            // were due. Pin pre-current-week entries to Mon for compact display.
            const weekday = date.getDay() === 0 ? 6 : date.getDay() - 1
            overdueByWeekday.set(weekday, (overdueByWeekday.get(weekday) ?? 0) + 1)
          }
          if (days >= 0 && days <= 7) {
            upcoming.push({
              taskId: t.id,
              boardId,
              workspaceSlug: workspace?.slug ?? null,
              title: t.title,
              workspaceName: workspace?.name ?? "Workspace",
              priority: t.priority,
              due: t.due,
              daysOut: days,
            })
          }
        }
      }
    }

    upcoming.sort((a, b) => a.daysOut - b.daysOut)

    const weekly = WEEKDAYS.map((day, i) => ({ day, v: overdueByWeekday.get(i) ?? 0 }))

    const nonEmptyWorkspaces = summary.health.filter((h) => h.total > 0)
    const pressure =
      nonEmptyWorkspaces.length === 0
        ? 0
        : Math.round(
            nonEmptyWorkspaces.reduce((acc, h) => acc + h.riskScore, 0) /
              nonEmptyWorkspaces.length
          )
    const highRisk = summary.health.filter(
      (h) => h.status === "At risk" || h.status === "Critical"
    ).length

    return {
      weeklyOverdue: weekly,
      upcomingRisks: upcoming.slice(0, 4),
      deadlinePressurePct: Math.min(100, pressure),
      highRiskWorkspaces: highRisk,
    }
  }, [tasksByBoardId, boardsById, workspaces, summary.health])

  const totalOverdue = summary.overdueTasks
  const peakDay = weeklyOverdue.reduce((p, c) => (c.v > p.v ? c : p))
  const hasAnyData = summary.totalTasks > 0
  const allZero = weeklyOverdue.every((d) => d.v === 0) && upcomingRisks.length === 0

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
      aria-labelledby="risk-monitor-heading"
      className="group/card relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card ring-1 ring-foreground/[0.04] transition-[box-shadow,transform,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-rose-500/30 hover:shadow-xl hover:shadow-rose-500/[0.06]"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/40 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-rose-500/[0.05] blur-3xl transition-opacity duration-500 ease-out group-hover/card:bg-rose-500/[0.09]"
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-3 border-b border-border/60 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/15 to-orange-500/15 text-rose-600">
            <ShieldAlert className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3
              id="risk-monitor-heading"
              className="text-base font-semibold tracking-tight text-foreground"
            >
              Project Risk Monitor
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {hasAnyData
                ? "Where slippage and pressure are creeping in"
                : "Risks will appear once you have tasks with due dates"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              <AnimatedNumber value={totalOverdue} />
            </span>
            <span className="text-xs font-medium text-muted-foreground">overdue</span>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              totalOverdue === 0
                ? "bg-emerald-500/10 text-emerald-700"
                : "bg-rose-500/10 text-rose-700"
            )}
          >
            {totalOverdue === 0 ? (
              <ShieldCheck className="size-2.5" aria-hidden />
            ) : (
              <AlarmClock className="size-2.5" aria-hidden />
            )}
            {totalOverdue === 0 ? "On track" : `${highRiskWorkspaces} at risk`}
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col gap-4 p-5">
        {!hasAnyData ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Overdue by day
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    Peak{" "}
                    <span className="font-semibold text-foreground">
                      {peakDay.day} · {peakDay.v}
                    </span>
                  </span>
                </div>
                <div className="h-20 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyOverdue} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <Tooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v) => [`${v as number} overdue`, "Tasks"]}
                        labelStyle={{ color: "var(--muted-foreground)", fontSize: 11 }}
                      />
                      <Bar dataKey="v" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900}>
                        {weeklyOverdue.map((d, i) => (
                          <Cell
                            key={i}
                            fill={d.v >= 3 ? "#e11d48" : d.v >= 1 ? "#fb7185" : "#fecdd3"}
                            fillOpacity={d.v >= 3 ? 0.95 : 0.85}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {weeklyOverdue.map((d, i) => (
                    <span key={i}>{d.day.slice(0, 1)}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 rounded-xl border border-border/60 bg-card/60 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Deadline pressure
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      deadlinePressurePct >= 60
                        ? "bg-rose-500/10 text-rose-700"
                        : deadlinePressurePct >= 30
                          ? "bg-amber-500/10 text-amber-700"
                          : "bg-emerald-500/10 text-emerald-700"
                    )}
                  >
                    {deadlinePressurePct >= 60
                      ? "High"
                      : deadlinePressurePct >= 30
                        ? "Medium"
                        : "Low"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    <AnimatedNumber value={deadlinePressurePct} />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">%</span>
                </div>
                <div className="space-y-1.5">
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={deadlinePressurePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Deadline pressure ${deadlinePressurePct}%`}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${deadlinePressurePct}%` }}
                      transition={{ duration: 0.9, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                    <span>0</span>
                    <span>
                      <span className="font-semibold text-foreground">{highRiskWorkspaces}</span>{" "}
                      high-risk workspace{highRiskWorkspaces === 1 ? "" : "s"}
                    </span>
                    <span>100</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-2 border-t border-border/60 pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Upcoming risks
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {totalOverdue} late · {upcomingRisks.length} due soon
                </span>
              </div>
              {upcomingRisks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-3 py-3 text-center text-[11px] text-muted-foreground">
                  Nothing due in the next 7 days{allZero ? "" : " — add task due dates to populate this list."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {upcomingRisks.map((r, i) => (
                    <motion.li
                      key={r.taskId}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: 0.1 + i * 0.04 }}
                      className="group/risk flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/80 px-3 py-2 transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:border-rose-500/30 hover:bg-card hover:shadow-sm"
                    >
                      <AlarmClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {r.workspaceSlug ? (
                            <Link
                              href={`/dashboard/boards/${r.workspaceSlug}/${r.boardId}`}
                              className="truncate text-xs font-semibold text-foreground hover:underline"
                            >
                              {r.title}
                            </Link>
                          ) : (
                            <span className="truncate text-xs font-semibold text-foreground">
                              {r.title}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="rounded-md bg-muted/70 px-1 py-0.5 font-semibold uppercase tracking-wider text-foreground/70">
                            {r.workspaceName}
                          </span>
                          <span>Due {r.due}</span>
                        </div>
                      </div>
                      <PriorityPill priority={r.priority} />
                      <span
                        className={cn(
                          "shrink-0 text-[10px] font-semibold tabular-nums",
                          r.daysOut <= 1
                            ? "text-rose-600"
                            : r.daysOut <= 3
                              ? "text-amber-600"
                              : "text-muted-foreground"
                        )}
                      >
                        {r.daysOut === 0 ? "today" : `${r.daysOut}d`}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </motion.section>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-10 text-center">
      <ShieldCheck className="size-5 text-emerald-600" aria-hidden />
      <p className="text-sm font-semibold text-foreground">No risks tracked yet</p>
      <p className="max-w-[34ch] text-xs text-muted-foreground">
        Create boards and add tasks with due dates — overdue items and deadline pressure will show up here automatically.
      </p>
    </div>
  )
}
