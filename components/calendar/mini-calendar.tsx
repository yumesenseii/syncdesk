"use client"

import { useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  addMonths,
  type CalendarEvent,
  formatMonthYear,
  getMonthMatrix,
  isSameDay,
} from "@/lib/calendar/events"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]

export function MiniCalendar({
  cursor,
  selected,
  events,
  onCursorChange,
  onSelect,
  todayDate = new Date(),
}: {
  cursor: Date
  selected: Date
  events: CalendarEvent[]
  onCursorChange: (next: Date) => void
  onSelect: (date: Date) => void
  todayDate?: Date
}) {
  const weeks = useMemo(() => getMonthMatrix(cursor), [cursor])

  const eventDays = useMemo(() => {
    const set = new Set<string>()
    events.forEach((e) => {
      set.add(`${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`)
    })
    return set
  }, [events])

  const activeMonth = cursor.getMonth()

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          {formatMonthYear(cursor)}
        </span>
        <div className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-background/70 p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Previous month"
            onClick={() => onCursorChange(addMonths(cursor, -1))}
          >
            <ChevronLeft className="size-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Next month"
            onClick={() => onCursorChange(addMonths(cursor, 1))}
          >
            <ChevronRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {WEEKDAYS.map((d, idx) => (
          <span key={`${d}-${idx}`}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {weeks.flat().map((day) => {
          const inMonth = day.getMonth() === activeMonth
          const isToday = isSameDay(day, todayDate)
          const isSelected = isSameDay(day, selected)
          const hasEvent = eventDays.has(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`)
          return (
            <button
              key={`${day.getMonth()}-${day.getDate()}-${day.getFullYear()}`}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-md text-xs tabular-nums transition-all",
                inMonth ? "text-foreground" : "text-muted-foreground/50",
                isSelected && "bg-primary text-primary-foreground shadow-sm shadow-primary/30",
                !isSelected && isToday && "ring-1 ring-primary",
                !isSelected && "hover:bg-muted/60"
              )}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
            >
              <span>{day.getDate()}</span>
              {hasEvent ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-1 size-1 rounded-full",
                    isSelected ? "bg-primary-foreground/80" : "bg-primary/80"
                  )}
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
