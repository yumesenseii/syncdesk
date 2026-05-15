"use client"

import { useMemo } from "react"
import { AlertTriangle, Calendar, ListTodo, Sparkles, Users } from "lucide-react"

import {
  addDays,
  type CalendarEvent,
  startOfDay,
  startOfWeek,
  type WorkspacePalette,
} from "@/lib/calendar/events"
import { cn } from "@/lib/utils"

interface CalendarInsightsProps {
  events: CalendarEvent[]
  paletteByWorkspace: Map<string, WorkspacePalette>
  todayDate?: Date
}

export function CalendarInsights({
  events,
  paletteByWorkspace,
  todayDate = new Date(),
}: CalendarInsightsProps) {
  const stats = useMemo(() => {
    const today = startOfDay(todayDate)
    const weekStart = startOfWeek(today)
    const weekEnd = addDays(weekStart, 7)
    let totalThisMonth = 0
    let overdue = 0
    let meetingsThisWeek = 0
    let tasksThisWeek = 0
    const workspaceCount = new Map<string, number>()
    events.forEach((e) => {
      if (e.date.getMonth() === today.getMonth() && e.date.getFullYear() === today.getFullYear()) {
        totalThisMonth += 1
      }
      if (e.overdue) overdue += 1
      if (
        e.date.getTime() >= weekStart.getTime() &&
        e.date.getTime() < weekEnd.getTime()
      ) {
        if (e.kind === "meeting") meetingsThisWeek += 1
        if (e.kind === "task") tasksThisWeek += 1
      }
      workspaceCount.set(e.workspaceId, (workspaceCount.get(e.workspaceId) ?? 0) + 1)
    })
    let topWorkspaceId: string | null = null
    let topCount = -1
    workspaceCount.forEach((count, id) => {
      if (count > topCount) {
        topWorkspaceId = id
        topCount = count
      }
    })
    return {
      totalThisMonth,
      overdue,
      meetingsThisWeek,
      tasksThisWeek,
      topWorkspaceId,
      topCount: topCount === -1 ? 0 : topCount,
    }
  }, [events, todayDate])

  const topPalette = stats.topWorkspaceId ? paletteByWorkspace.get(stats.topWorkspaceId) : null

  // Four real, derived tiles. The previous "Momentum: Healthy/Watchful" tile
  // collapsed two unrelated counters into a feel-good label and was removed
  // in favour of a tasks-due-this-week counter that maps to an actual record.
  const tiles: {
    id: string
    label: string
    value: string
    helper?: string
    icon: typeof Calendar
    tone: string
  }[] = [
    {
      id: "month",
      label: "Events this month",
      value: String(stats.totalThisMonth),
      helper: "Across all workspaces",
      icon: Calendar,
      tone: "text-primary",
    },
    {
      id: "overdue",
      label: "Overdue",
      value: String(stats.overdue),
      helper: stats.overdue === 0 ? "Nothing past due" : "Needs attention",
      icon: AlertTriangle,
      tone: stats.overdue > 0 ? "text-rose-600" : "text-emerald-600",
    },
    {
      id: "meetings",
      label: "Meetings this week",
      value: String(stats.meetingsThisWeek),
      helper: stats.meetingsThisWeek === 0 ? "Nothing scheduled" : "Stay focused",
      icon: Users,
      tone: "text-fuchsia-600",
    },
    {
      id: "tasks-week",
      label: "Tasks due this week",
      value: String(stats.tasksThisWeek),
      helper: stats.tasksThisWeek === 0 ? "Clear runway" : "Plan accordingly",
      icon: ListTodo,
      tone: "text-emerald-600",
    },
  ]

  return (
    <section
      aria-label="Calendar insights"
      className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
    >
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Calendar insights</h3>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3" aria-hidden />
          Workspace
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => {
          const Icon = t.icon
          return (
            <div
              key={t.id}
              className="rounded-xl border border-border/60 bg-background/60 p-2.5 transition-colors hover:bg-background"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.label}
                </span>
                <Icon className={cn("size-3.5", t.tone)} aria-hidden />
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {t.value}
              </div>
              {t.helper ? (
                <div className="mt-0.5 text-[10px] text-muted-foreground">{t.helper}</div>
              ) : null}
            </div>
          )
        })}
      </div>

      {topPalette ? (
        <div
          className={cn(
            "mt-2 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs",
            topPalette.surface,
            topPalette.border
          )}
        >
          <span className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", topPalette.dot)} aria-hidden />
            <span className="font-semibold text-foreground">{topPalette.name}</span>
            <span className="text-muted-foreground">most active</span>
          </span>
          <span className="rounded-full bg-card/80 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/80">
            {stats.topCount} events
          </span>
        </div>
      ) : null}
    </section>
  )
}
