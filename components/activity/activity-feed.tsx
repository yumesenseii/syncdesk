"use client"

import { motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Pencil,
  Radio,
  Trash2,
  UserPlus,
} from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserAvatar } from "@/components/ui/user-avatar"
import {
  ACTIVITY_TYPE_LABEL,
  filterByDateRange,
  formatRelativeTime,
  type ActivityDateRange,
  type ActivityEvent,
  type ActivityType,
} from "@/lib/activity/events"
import { cn } from "@/lib/utils"

function kindIcon(kind: ActivityType, eventType?: string) {
  if (eventType?.startsWith("meeting_")) return CalendarDays
  if (
    eventType === "workspace_deleted" ||
    eventType === "task_deleted" ||
    eventType === "board_deleted" ||
    eventType === "meeting_deleted"
  ) {
    return Trash2
  }
  switch (kind) {
    case "created":
      return ClipboardList
    case "completed":
      return CheckCircle2
    case "assigned":
      return UserPlus
    case "comment":
      return MessageSquare
    case "updated":
      return Pencil
    case "deadline":
      return AlertTriangle
    default:
      return Radio
  }
}

function kindAccent(kind: ActivityType) {
  switch (kind) {
    case "completed":
      return "text-emerald-600 bg-emerald-500/10"
    case "deadline":
      return "text-rose-600 bg-rose-500/10"
    case "comment":
      return "text-sky-600 bg-sky-500/10"
    case "assigned":
      return "text-fuchsia-600 bg-fuchsia-500/10"
    case "updated":
      return "text-amber-600 bg-amber-500/10"
    case "created":
      return "text-primary bg-primary/10"
    default:
      return "text-muted-foreground bg-muted"
  }
}

function priorityPill(p?: ActivityEvent["priority"]) {
  if (!p) return null
  const cls =
    p === "Urgent"
      ? "border-rose-400/35 bg-rose-500/10 text-rose-700"
      : p === "High"
        ? "border-amber-400/35 bg-amber-500/10 text-amber-800"
        : p === "Medium"
          ? "border-sky-400/35 bg-sky-500/10 text-sky-700"
          : "border-emerald-400/35 bg-emerald-500/10 text-emerald-700"
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", cls)}>
      {p}
    </span>
  )
}

export function ActivityFeed({
  events,
  isLoading = false,
  searchQuery,
  type,
  range,
  workspaceId,
}: {
  events: ActivityEvent[]
  isLoading?: boolean
  searchQuery: string
  type: ActivityType
  range: ActivityDateRange
  workspaceId: string | "all"
}) {
  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const ranged = filterByDateRange(events, range)
    return ranged.filter((e) => {
      if (workspaceId !== "all" && e.workspaceId !== workspaceId) return false
      if (type !== "all" && e.kind !== type) return false
      if (!q) return true
      const hay = [
        e.actorLabel,
        e.summary,
        e.targetTitle,
        e.boardName ?? "",
        e.workspaceName ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [events, range, searchQuery, type, workspaceId])

  const grouped = useMemo(() => groupByDay(visible), [visible])

  // The empty-state copy depends on *why* the feed is empty. We separate
  // "your account has zero activity ever" from "your filters hide events
  // that exist" so first-time users see an actionable onboarding message
  // instead of a misleading "no matches" prompt.
  const hasAnyEvents = events.length > 0
  const filtersAreActive =
    range !== "all" ||
    type !== "all" ||
    workspaceId !== "all" ||
    searchQuery.trim().length > 0

  return (
    <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
      <CardHeader className="border-b border-border/60 px-5 pb-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <span
                className={cn(
                  "relative flex size-2 items-center justify-center",
                  !hasAnyEvents && "opacity-40"
                )}
              >
                {hasAnyEvents ? (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/40" />
                ) : null}
                <span
                  className={cn(
                    "relative inline-flex size-2 rounded-full",
                    hasAnyEvents ? "bg-emerald-500" : "bg-muted-foreground/40"
                  )}
                />
              </span>
              Activity feed
            </CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Filter:{" "}
              <span className="font-medium text-foreground">{ACTIVITY_TYPE_LABEL[type]}</span>
              {workspaceId !== "all" ? <span> · workspace filtered</span> : null}
            </p>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {visible.length} {visible.length === 1 ? "event" : "events"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <Radio className="size-5 animate-pulse text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Loading activity…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <Radio className="size-5 text-muted-foreground" aria-hidden />
            {!hasAnyEvents ? (
              <>
                <p className="text-sm font-medium text-foreground">No activity yet.</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Create a board, edit tasks, or invite teammates — actions will appear here.
                </p>
              </>
            ) : filtersAreActive ? (
              <>
                <p className="text-sm font-medium text-foreground">No events match your filters.</p>
                <p className="text-xs text-muted-foreground">
                  Try widening the date range, switching workspace or clearing the search.
                </p>
              </>
            ) : (
              <p className="text-sm font-medium text-foreground">No events to show.</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border/50" role="list">
            {grouped.map((group) => (
              <li key={group.label} className="bg-card">
                <div className="sticky top-0 z-10 border-b border-border/40 bg-card/95 px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                  {group.label}
                </div>
                <ul role="list">
                  {group.events.map((event, i) => {
                    const Icon = kindIcon(event.kind, event.eventType)
                    const accent = kindAccent(event.kind)
                    const href =
                      event.eventType?.startsWith("meeting_")
                        ? "/dashboard/calendar"
                        : event.boardId && event.workspaceSlug
                          ? `/dashboard/boards/${event.workspaceSlug}/${event.boardId}`
                          : "/dashboard/boards"
                    return (
                      <motion.li
                        key={event.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.18, delay: i * 0.015 }}
                      >
                        <Link
                          href={href}
                          className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                        >
                          {event.actor ? (
                            <UserAvatar
                              name={event.actorLabel}
                              initials={event.actor.initials ?? event.actorLabel.slice(0, 2)}
                              avatarUrl={event.actor.avatarUrl}
                              color={event.actor.color}
                              size="md"
                              className="rounded-md ring-1 ring-border/40 transition-transform group-hover:scale-[1.02]"
                              ringClassName=""
                            />
                          ) : (
                            <div
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center rounded-md",
                                accent
                              )}
                              aria-hidden
                            >
                              <Icon className="size-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm leading-snug text-foreground">
                              <span className="font-semibold">{event.actorLabel}</span>{" "}
                              <span className="text-muted-foreground">{event.summary}</span>{" "}
                              <span className="font-medium">{event.targetTitle}</span>
                              {event.meta ? (
                                <span className="text-muted-foreground"> · {event.meta}</span>
                              ) : null}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              {event.workspaceName ? (
                                <span className="rounded-md bg-muted/80 px-1.5 py-0.5 font-medium text-foreground/80">
                                  {event.workspaceName}
                                </span>
                              ) : null}
                              {event.boardName ? (
                                <span className="rounded-full border border-border/70 bg-background px-1.5 py-0.5">
                                  {event.boardName}
                                </span>
                              ) : null}
                              {priorityPill(event.priority)}
                              <span className="ml-auto inline-flex items-center gap-1">
                                {formatRelativeTime(event.timestamp)}
                                <ArrowRight className="size-3 opacity-60" aria-hidden />
                              </span>
                            </div>
                          </div>
                        </Link>
                      </motion.li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function groupByDay(events: ActivityEvent[]): { label: string; events: ActivityEvent[] }[] {
  const groups = new Map<string, ActivityEvent[]>()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 24 * 60 * 60 * 1000

  for (const e of events) {
    const d = new Date(e.timestamp)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    let label: string
    if (day === today) label = "Today"
    else if (day === yesterday) label = "Yesterday"
    else
      label = d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    const list = groups.get(label) ?? []
    list.push(e)
    groups.set(label, list)
  }
  return Array.from(groups.entries()).map(([label, events]) => ({ label, events }))
}
