"use client"

import { useMemo } from "react"
import { AlertTriangle, CalendarClock, Flame, Users } from "lucide-react"

import { EventCard } from "@/components/calendar/event-card"
import {
  type CalendarEvent,
  isSameDay,
  priorityRank,
  startOfDay,
  type WorkspacePalette,
} from "@/lib/calendar/events"
import { cn } from "@/lib/utils"

type Group = "today" | "overdue" | "meetings" | "priority"

interface UpcomingEventsProps {
  events: CalendarEvent[]
  paletteByWorkspace: Map<string, WorkspacePalette>
  onEventSelect: (event: CalendarEvent) => void
  todayDate?: Date
}

export function UpcomingEvents({
  events,
  paletteByWorkspace,
  onEventSelect,
  todayDate = new Date(),
}: UpcomingEventsProps) {
  const today = useMemo(() => startOfDay(todayDate), [todayDate])

  const buckets = useMemo(() => {
    const todayItems: CalendarEvent[] = []
    const overdueItems: CalendarEvent[] = []
    const meetingItems: CalendarEvent[] = []
    const priorityItems: CalendarEvent[] = []
    events.forEach((event) => {
      if (event.overdue) overdueItems.push(event)
      if (isSameDay(event.date, today)) todayItems.push(event)
      if (event.kind === "meeting" && event.date.getTime() >= today.getTime()) {
        meetingItems.push(event)
      }
      if (
        event.kind === "task" &&
        !event.overdue &&
        (event.priority === "High" || event.priority === "Urgent") &&
        event.date.getTime() >= today.getTime()
      ) {
        priorityItems.push(event)
      }
    })
    overdueItems.sort((a, b) => a.date.getTime() - b.date.getTime())
    todayItems.sort((a, b) => (a.time ?? "23:59").localeCompare(b.time ?? "23:59"))
    meetingItems.sort((a, b) => a.date.getTime() - b.date.getTime())
    priorityItems.sort((a, b) => {
      const p = priorityRank(a.priority) - priorityRank(b.priority)
      if (p !== 0) return p
      return a.date.getTime() - b.date.getTime()
    })
    return {
      today: todayItems.slice(0, 3),
      overdue: overdueItems.slice(0, 3),
      meetings: meetingItems.slice(0, 3),
      priority: priorityItems.slice(0, 3),
    } as Record<Group, CalendarEvent[]>
  }, [events, today])

  const total = events.filter((e) => e.date.getTime() >= today.getTime()).length

  const sections: { id: Group; label: string; icon: typeof Flame; tone: string }[] = [
    { id: "overdue", label: "Overdue", icon: AlertTriangle, tone: "text-rose-600" },
    { id: "today", label: "Today", icon: Flame, tone: "text-amber-600" },
    { id: "meetings", label: "Upcoming meetings", icon: Users, tone: "text-primary" },
    { id: "priority", label: "Priority items", icon: CalendarClock, tone: "text-fuchsia-600" },
  ]

  return (
    <section
      aria-label="Upcoming events"
      className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
    >
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Up next</h3>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {total} scheduled
        </span>
      </header>
      <div className="space-y-3">
        {sections.map((section) => {
          const list = buckets[section.id]
          if (list.length === 0) return null
          const Icon = section.icon
          return (
            <div key={section.id} className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className={cn("size-3", section.tone)} aria-hidden />
                {section.label}
                <span className="ml-auto tabular-nums">{list.length}</span>
              </div>
              <div className="space-y-1.5">
                {list.map((e) => (
                  <EventCard
                    key={`${section.id}:${e.id}`}
                    event={e}
                    palette={paletteByWorkspace.get(e.workspaceId)}
                    variant="list"
                    onClick={() => onEventSelect(e)}
                  />
                ))}
              </div>
            </div>
          )
        })}
        {sections.every((s) => buckets[s.id].length === 0) ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-3 py-6 text-center text-xs text-muted-foreground">
            Nothing on the horizon. Plan a meeting or add a task to get started.
          </div>
        ) : null}
      </div>
    </section>
  )
}
