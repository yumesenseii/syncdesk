"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  PlusCircle,
  Radio,
  RefreshCw,
  Sparkles,
  UserPlus2,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  formatRelativeTime,
  type ActivityEvent,
  type ActivityType,
} from "@/lib/activity/events"
import { useActivityEventsQuery } from "@/hooks/use-activity-events"
import type { WorkspaceEntity } from "@/lib/boards/types"
import { cn } from "@/lib/utils"

const TYPE_LABEL: Record<ActivityType, string> = {
  all: "All",
  created: "Created",
  completed: "Completed",
  assigned: "Assigned",
  comment: "Comments",
  updated: "Updates",
  deadline: "Deadlines",
}

const TYPE_FILTERS: ActivityType[] = ["all", "created", "completed", "assigned", "comment", "updated", "deadline"]

function activityIcon(type: ActivityType) {
  switch (type) {
    case "created":
      return <PlusCircle className="size-3.5 text-sky-600" aria-hidden />
    case "completed":
      return <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
    case "assigned":
      return <UserPlus2 className="size-3.5 text-violet-600" aria-hidden />
    case "comment":
      return <MessageSquare className="size-3.5 text-amber-600" aria-hidden />
    case "deadline":
      return <AlertTriangle className="size-3.5 text-rose-600" aria-hidden />
    case "updated":
      return <RefreshCw className="size-3.5 text-blue-600" aria-hidden />
    default:
      return <Sparkles className="size-3.5 text-primary" aria-hidden />
  }
}

export function WorkspaceActivity({ workspace }: { workspace: WorkspaceEntity }) {
  const [filter, setFilter] = useState<ActivityType>("all")
  const { events, isLoading } = useActivityEventsQuery(workspace.id)

  const filtered = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.kind === filter)),
    [events, filter]
  )

  return (
    <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-5 sm:items-center">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Radio className="size-4 text-primary" aria-hidden />
            Recent activity
          </CardTitle>
          <CardDescription>
            Recent actions across boards in this workspace.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                filter === t
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {isLoading && filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            Loading activity…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            {events.length === 0
              ? "No activity yet — create a board, edit tasks, or invite teammates."
              : "No events match this filter."}
          </div>
        ) : (
          <ul className="relative space-y-3 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1.5rem)] before:w-px before:bg-border/70">
            {filtered.slice(0, 18).map((event, i) => (
              <ActivityRow key={event.id} event={event} index={i} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityRow({ event, index }: { event: ActivityEvent; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, delay: index * 0.025 }}
      className="relative flex items-start gap-3 pl-1"
    >
      <span className="relative z-10 mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm">
        {activityIcon(event.kind)}
      </span>
      <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
        <p className="text-sm leading-snug text-foreground">
          <span className="font-semibold">{event.actorLabel}</span>{" "}
          <span className="text-muted-foreground">{event.summary}</span>{" "}
          <span className="font-medium">{event.targetTitle}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {event.boardName ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 font-medium text-foreground">
              {event.boardName}
            </span>
          ) : null}
          {event.priority ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 font-medium",
                event.priority === "Urgent"
                  ? "bg-rose-500/10 text-rose-700"
                  : event.priority === "High"
                    ? "bg-amber-500/10 text-amber-700"
                    : event.priority === "Medium"
                      ? "bg-sky-500/10 text-sky-700"
                      : "bg-muted text-muted-foreground"
              )}
            >
              {event.priority}
            </span>
          ) : null}
          {event.meta ? <span>{event.meta}</span> : null}
          <span className="ml-auto">{formatRelativeTime(event.timestamp)}</span>
        </div>
      </div>
    </motion.li>
  )
}
