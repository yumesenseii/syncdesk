"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"

import { EventCard } from "@/components/calendar/event-card"
import {
  addDays,
  type CalendarEvent,
  type CalendarView,
  formatLongDay,
  formatTime,
  getMonthMatrix,
  isSameDay,
  startOfDay,
  startOfWeek,
  type WorkspacePalette,
} from "@/lib/calendar/events"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

interface CalendarGridProps {
  view: CalendarView
  cursor: Date
  events: CalendarEvent[]
  paletteByWorkspace: Map<string, WorkspacePalette>
  onEventSelect: (event: CalendarEvent) => void
  onDayClick: (date: Date) => void
  onEventDrop: (eventId: string, nextDate: Date) => void
  /** Total visible events (after filtering) so an empty state is friendly. */
  todayDate?: Date
}

export function CalendarGrid({
  view,
  cursor,
  events,
  paletteByWorkspace,
  onEventSelect,
  onDayClick,
  onEventDrop,
  todayDate = new Date(),
}: CalendarGridProps) {
  if (view === "month") {
    return (
      <MonthGrid
        cursor={cursor}
        events={events}
        paletteByWorkspace={paletteByWorkspace}
        onEventSelect={onEventSelect}
        onDayClick={onDayClick}
        onEventDrop={onEventDrop}
        todayDate={todayDate}
      />
    )
  }
  if (view === "week") {
    return (
      <WeekAgenda
        cursor={cursor}
        events={events}
        paletteByWorkspace={paletteByWorkspace}
        onEventSelect={onEventSelect}
        onDayClick={onDayClick}
        onEventDrop={onEventDrop}
        todayDate={todayDate}
      />
    )
  }
  return (
    <DayAgenda
      cursor={cursor}
      events={events}
      paletteByWorkspace={paletteByWorkspace}
      onEventSelect={onEventSelect}
      todayDate={todayDate}
    />
  )
}

function MonthGrid({
  cursor,
  events,
  paletteByWorkspace,
  onEventSelect,
  onDayClick,
  onEventDrop,
  todayDate,
}: Omit<CalendarGridProps, "view"> & { todayDate: Date }) {
  const weeks = useMemo(() => getMonthMatrix(cursor), [cursor])
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach((e) => {
      const k = keyForDate(e.date)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(e)
    })
    map.forEach((list) =>
      list.sort((a, b) => {
        const ta = a.time ?? "23:59"
        const tb = b.time ?? "23:59"
        return ta.localeCompare(tb)
      })
    )
    return map
  }, [events])

  const activeMonth = cursor.getMonth()
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  return (
    <section
      aria-label="Calendar month grid"
      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
    >
      <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-border/40">
        {weeks.flat().map((day) => {
          const k = keyForDate(day)
          const inMonth = day.getMonth() === activeMonth
          const isToday = isSameDay(day, todayDate)
          const list = eventsByDay.get(k) ?? []
          const max = 3
          const hidden = list.length - max
          const isDragOver = dragOverKey === k
          return (
            <div
              key={k}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragOverKey !== k) setDragOverKey(k)
              }}
              onDragLeave={() => {
                if (dragOverKey === k) setDragOverKey(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData("text/plain")
                if (id) onEventDrop(id, day)
                setDragOverKey(null)
              }}
              className={cn(
                "group/day flex min-h-[8rem] flex-col gap-1.5 p-2 transition-colors",
                inMonth ? "bg-card" : "bg-muted/[0.18] text-muted-foreground",
                isDragOver && "bg-primary/[0.06]"
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onDayClick(day)}
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors",
                    isToday
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                      : "text-foreground/80 hover:bg-muted/60"
                  )}
                  aria-label={`Open ${formatLongDay(day)}`}
                >
                  {day.getDate()}
                </button>
                <button
                  type="button"
                  onClick={() => onDayClick(day)}
                  className="rounded-md p-0.5 text-muted-foreground/60 opacity-0 transition-all duration-200 hover:bg-muted/50 hover:text-foreground group-hover/day:opacity-100"
                  aria-label="Add event"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                {list.slice(0, max).map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    palette={paletteByWorkspace.get(event.workspaceId)}
                    variant="compact"
                    draggable
                    onClick={() => onEventSelect(event)}
                  />
                ))}
                {hidden > 0 ? (
                  <button
                    type="button"
                    onClick={() => onDayClick(day)}
                    className="self-start rounded-md px-1 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    +{hidden} more
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function WeekAgenda({
  cursor,
  events,
  paletteByWorkspace,
  onEventSelect,
  onDayClick,
  onEventDrop,
  todayDate,
}: Omit<CalendarGridProps, "view"> & { todayDate: Date }) {
  const weekStart = useMemo(() => startOfWeek(cursor), [cursor])
  const days = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)),
    [weekStart]
  )
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    days.forEach((d) => map.set(keyForDate(d), []))
    events.forEach((e) => {
      const k = keyForDate(e.date)
      if (map.has(k)) map.get(k)!.push(e)
    })
    map.forEach((list) =>
      list.sort((a, b) => (a.time ?? "23:59").localeCompare(b.time ?? "23:59"))
    )
    return map
  }, [days, events])

  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  return (
    <section
      aria-label="Calendar week"
      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
    >
      <div className="grid grid-cols-1 divide-y divide-border/40 sm:grid-cols-7 sm:divide-x sm:divide-y-0">
        {days.map((d) => {
          const k = keyForDate(d)
          const list = grouped.get(k) ?? []
          const isToday = isSameDay(d, todayDate)
          const isDragOver = dragOverKey === k
          return (
            <div
              key={k}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragOverKey !== k) setDragOverKey(k)
              }}
              onDragLeave={() => {
                if (dragOverKey === k) setDragOverKey(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData("text/plain")
                if (id) onEventDrop(id, d)
                setDragOverKey(null)
              }}
              className={cn(
                "flex min-h-[18rem] flex-col bg-card transition-colors",
                isDragOver && "bg-primary/[0.05]"
              )}
            >
              <button
                type="button"
                onClick={() => onDayClick(d)}
                className={cn(
                  "flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2 text-left transition-colors hover:bg-muted/30",
                  isToday && "bg-primary/[0.06]"
                )}
              >
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {WEEKDAY_LABELS[d.getDay()]}
                  </div>
                  <div
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      isToday ? "text-primary" : "text-foreground"
                    )}
                  >
                    {d.getDate()}
                  </div>
                </div>
                {list.length > 0 ? (
                  <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {list.length}
                  </span>
                ) : null}
              </button>
              <div className="flex flex-1 flex-col gap-1.5 p-2">
                {list.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center px-2 text-[11px] text-muted-foreground">
                    No events
                  </div>
                ) : (
                  list.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      palette={paletteByWorkspace.get(event.workspaceId)}
                      variant="compact"
                      draggable
                      onClick={() => onEventSelect(event)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function DayAgenda({
  cursor,
  events,
  paletteByWorkspace,
  onEventSelect,
  todayDate,
}: {
  cursor: Date
  events: CalendarEvent[]
  paletteByWorkspace: Map<string, WorkspacePalette>
  onEventSelect: (event: CalendarEvent) => void
  todayDate: Date
}) {
  const list = useMemo(() => {
    const day = startOfDay(cursor)
    return events
      .filter((e) => isSameDay(e.date, day))
      .sort((a, b) => (a.time ?? "23:59").localeCompare(b.time ?? "23:59"))
  }, [events, cursor])

  const slots = useMemo(() => {
    const out: { hour: number; label: string }[] = []
    for (let h = 7; h < 21; h += 1) {
      const meridian = h >= 12 ? "PM" : "AM"
      const display = ((h + 11) % 12) + 1
      out.push({ hour: h, label: `${display} ${meridian}` })
    }
    return out
  }, [])

  const eventsByHour = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>()
    list.forEach((e) => {
      const hour = e.time ? Number(e.time.split(":")[0]) : -1
      if (hour < 0) return
      if (!map.has(hour)) map.set(hour, [])
      map.get(hour)!.push(e)
    })
    return map
  }, [list])

  const allDay = list.filter((e) => !e.time)
  const isToday = isSameDay(cursor, todayDate)

  return (
    <section
      aria-label="Calendar day"
      className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {WEEKDAY_LABELS[cursor.getDay()]}
            {isToday ? <span className="ml-2 text-primary">Today</span> : null}
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {formatLongDay(cursor)}
          </h2>
        </div>
        <span className="rounded-full bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">
          {list.length} event{list.length === 1 ? "" : "s"}
        </span>
      </header>

      {allDay.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            All day
          </div>
          <div className="flex flex-wrap gap-2">
            {allDay.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                palette={paletteByWorkspace.get(e.workspaceId)}
                variant="compact"
                onClick={() => onEventSelect(e)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-[3.5rem_1fr] gap-x-3 divide-y divide-border/40 rounded-xl border border-border/40 bg-background/50">
        {slots.map((slot) => {
          const items = eventsByHour.get(slot.hour) ?? []
          return (
            <div
              key={slot.hour}
              className="col-span-2 grid grid-cols-subgrid items-start py-2"
            >
              <div className="pl-3 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {slot.label}
              </div>
              <div className="flex flex-wrap gap-1.5 pr-3">
                {items.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground/70">—</span>
                ) : (
                  items.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onEventSelect(e)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1 text-left text-xs shadow-sm transition-all hover:-translate-y-px hover:shadow-md",
                        paletteByWorkspace.get(e.workspaceId)?.border ?? "border-border/60"
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          paletteByWorkspace.get(e.workspaceId)?.dot ?? "bg-primary"
                        )}
                        aria-hidden
                      />
                      <span className="font-medium text-foreground">{e.title}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {e.time ? formatTime(e.time) : ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function keyForDate(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
