"use client"

import { Calendar, Clock, Users } from "lucide-react"

import { type CalendarEvent, formatTime, type WorkspacePalette } from "@/lib/calendar/events"
import { cn } from "@/lib/utils"

const PRIORITY_TONE: Record<string, string> = {
  Urgent: "bg-rose-500",
  High: "bg-amber-500",
  Medium: "bg-sky-500",
  Low: "bg-emerald-500",
}

export interface EventCardProps {
  event: CalendarEvent
  palette: WorkspacePalette | undefined
  /** Compact = single line / month-grid chip. Otherwise full agenda card. */
  variant?: "compact" | "list" | "detailed"
  draggable?: boolean
  onClick?: () => void
}

export function EventCard({
  event,
  palette,
  variant = "compact",
  draggable = false,
  onClick,
}: EventCardProps) {
  const dot = palette?.dot ?? "bg-primary"
  const surface = palette?.surface ?? "bg-primary/10"
  const surfaceStrong = palette?.surfaceStrong ?? "bg-primary/15"
  const border = palette?.border ?? "border-primary/30"
  const text = palette?.text ?? "text-foreground"
  const priorityTone = event.priority ? PRIORITY_TONE[event.priority] : null

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        draggable={draggable}
        onDragStart={
          draggable
            ? (e) => {
                e.dataTransfer.setData("text/plain", event.id)
                e.dataTransfer.effectAllowed = "move"
              }
            : undefined
        }
        title={event.title}
        className={cn(
          "group/event flex w-full items-center gap-1.5 truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-all duration-200",
          surface,
          border,
          "hover:-translate-y-px hover:shadow-sm",
          event.overdue && "border-rose-500/40 bg-rose-500/10 text-rose-700",
          draggable && "cursor-grab active:cursor-grabbing"
        )}
      >
        <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden />
        {event.time ? (
          <span className="shrink-0 tabular-nums text-foreground/70">
            {event.time.slice(0, 5)}
          </span>
        ) : null}
        <span className={cn("min-w-0 flex-1 truncate", text)}>{event.title}</span>
        {priorityTone ? (
          <span className={cn("size-1.5 shrink-0 rounded-full", priorityTone)} aria-hidden />
        ) : null}
      </button>
    )
  }

  if (variant === "list") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex w-full items-start gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2 text-left shadow-sm transition-all duration-200",
          "hover:-translate-y-px hover:border-border hover:shadow-md"
        )}
      >
        <span className={cn("mt-1 size-2 shrink-0 rounded-full", dot)} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{event.title}</span>
            {event.overdue ? (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                Overdue
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              {event.time ? formatTime(event.time) : "All day"}
            </span>
            {palette ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                  surfaceStrong,
                  border,
                  text
                )}
              >
                <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
                {palette.name}
              </span>
            ) : null}
            {event.priority ? (
              <span className="inline-flex items-center gap-1 text-foreground/70">
                <span
                  className={cn("size-1.5 rounded-full", priorityTone ?? "bg-muted")}
                  aria-hidden
                />
                {event.priority}
              </span>
            ) : null}
            {event.attendees.length > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" aria-hidden />
                {event.attendees.length}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/full flex w-full flex-col gap-2 rounded-2xl border bg-card px-3 py-3 text-left shadow-sm transition-all duration-200",
        border,
        "hover:-translate-y-px hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className={cn("mt-1 size-2 shrink-0 rounded-full", dot)} aria-hidden />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{event.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3" aria-hidden />
                {event.date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "2-digit",
                })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" aria-hidden />
                {event.time ? formatTime(event.time) : "All day"}
              </span>
            </div>
          </div>
        </div>
        {event.priority ? (
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              border,
              surfaceStrong,
              text
            )}
          >
            {event.priority}
          </span>
        ) : null}
      </div>
      {event.description ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {event.description}
        </p>
      ) : null}
      {event.attendees.length > 0 ? (
        <div className="flex items-center -space-x-1.5">
          {event.attendees.slice(0, 4).map((a) => (
            <span
              key={a.id}
              title={a.name}
              className={cn(
                "flex size-6 items-center justify-center rounded-full border border-card text-[10px] font-semibold",
                a.color
              )}
            >
              {a.initials}
            </span>
          ))}
          {event.attendees.length > 4 ? (
            <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">
              +{event.attendees.length - 4}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  )
}
