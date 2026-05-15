"use client"

import { useMemo } from "react"
import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  ListChecks,
  Plus,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  addMonths,
  type CalendarEventKind,
  type CalendarView,
  formatLongDay,
  formatMonthYear,
  formatWeekRange,
  type WorkspacePalette,
} from "@/lib/calendar/events"
import { cn } from "@/lib/utils"

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
]

const KINDS: { id: CalendarEventKind; label: string }[] = [
  { id: "task", label: "Tasks" },
  { id: "meeting", label: "Meetings" },
  { id: "deadline", label: "Deadlines" },
]

export function CalendarToolbar({
  cursor,
  view,
  onView,
  onCursorChange,
  onToday,
  onNewEvent,
  workspaces,
  selectedWorkspaceIds,
  onToggleWorkspace,
  onClearWorkspaceFilter,
  selectedKinds,
  onToggleKind,
  totalEvents,
  overdueCount,
}: {
  cursor: Date
  view: CalendarView
  onView: (next: CalendarView) => void
  onCursorChange: (next: Date) => void
  onToday: () => void
  onNewEvent: () => void
  workspaces: WorkspacePalette[]
  selectedWorkspaceIds: string[]
  onToggleWorkspace: (id: string) => void
  onClearWorkspaceFilter: () => void
  selectedKinds: CalendarEventKind[]
  onToggleKind: (kind: CalendarEventKind) => void
  totalEvents: number
  overdueCount: number
}) {
  const periodLabel = useMemo(() => {
    if (view === "week") return formatWeekRange(cursor)
    if (view === "day") return formatLongDay(cursor)
    return formatMonthYear(cursor)
  }, [cursor, view])

  const stepLabel = view === "month" ? "month" : view === "week" ? "week" : "day"

  const goPrev = () => {
    if (view === "month") onCursorChange(addMonths(cursor, -1))
    else if (view === "week") {
      const d = new Date(cursor)
      d.setDate(d.getDate() - 7)
      onCursorChange(d)
    } else {
      const d = new Date(cursor)
      d.setDate(d.getDate() - 1)
      onCursorChange(d)
    }
  }
  const goNext = () => {
    if (view === "month") onCursorChange(addMonths(cursor, 1))
    else if (view === "week") {
      const d = new Date(cursor)
      d.setDate(d.getDate() + 7)
      onCursorChange(d)
    } else {
      const d = new Date(cursor)
      d.setDate(d.getDate() + 1)
      onCursorChange(d)
    }
  }

  const filterActive =
    selectedWorkspaceIds.length > 0 && selectedWorkspaceIds.length < workspaces.length
  const kindFilterActive = selectedKinds.length < KINDS.length

  return (
    <section
      aria-label="Calendar header"
      className="space-y-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarRange className="size-3" aria-hidden />
            Workspace schedule
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Calendar
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            View and manage tasks, deadlines, and meetings across your workspaces.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
            <ListChecks className="size-3" aria-hidden />
            {totalEvents} event{totalEvents === 1 ? "" : "s"}
            {overdueCount > 0 ? (
              <span className="ml-1 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                {overdueCount} overdue
              </span>
            ) : null}
          </span>
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5 rounded-full px-3 shadow-sm shadow-primary/20 transition-all duration-200 ease-out hover:-translate-y-px disabled:opacity-60 disabled:shadow-none"
            onClick={onNewEvent}
            disabled={workspaces.length === 0}
            title={
              workspaces.length === 0
                ? "Create a workspace before scheduling a meeting"
                : "Create a new event"
            }
          >
            <Plus className="size-4" aria-hidden />
            New event
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/70 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/50 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-border/70 bg-background/70 px-3 text-sm"
            onClick={onToday}
          >
            Today
          </Button>
          <div className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-background/70 p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-muted-foreground hover:text-foreground"
              aria-label={`Previous ${stepLabel}`}
              onClick={goPrev}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-muted-foreground hover:text-foreground"
              aria-label={`Next ${stepLabel}`}
              onClick={goNext}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 rounded-full px-2.5 text-sm font-semibold tracking-tight text-foreground hover:bg-muted/50"
              >
                <span>{periodLabel}</span>
                <ChevronDown className="size-3.5 opacity-60" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Jump to month</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Array.from({ length: 12 }).map((_, idx) => {
                const target = new Date(cursor.getFullYear(), idx, 1)
                const isCurrent = cursor.getMonth() === idx
                return (
                  <DropdownMenuItem
                    key={idx}
                    onClick={() => onCursorChange(target)}
                    className={cn(isCurrent && "bg-muted/60")}
                  >
                    {formatMonthYear(target)}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Calendar view"
            className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-background/70 p-0.5"
          >
            {VIEWS.map((v) => {
              const active = v.id === view
              return (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onView(v.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v.label}
                </button>
              )
            })}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 gap-1.5 rounded-full border-border/70 bg-background/70 px-3 text-xs",
                  (filterActive || kindFilterActive) &&
                    "border-primary/50 bg-primary/[0.06] text-primary hover:bg-primary/[0.08]"
                )}
              >
                <Filter className="size-3.5" aria-hidden />
                Filter
                {filterActive || kindFilterActive ? (
                  <span
                    aria-hidden
                    className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground"
                  >
                    {(filterActive ? workspaces.length - selectedWorkspaceIds.length : 0) +
                      (kindFilterActive ? KINDS.length - selectedKinds.length : 0)}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="flex items-center justify-between gap-2">
                <span>Workspaces</span>
                {filterActive ? (
                  <button
                    type="button"
                    className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault()
                      onClearWorkspaceFilter()
                    }}
                  >
                    Reset
                  </button>
                ) : null}
              </DropdownMenuLabel>
              {workspaces.map((w) => {
                const selected = selectedWorkspaceIds.includes(w.id)
                return (
                  <DropdownMenuItem
                    key={w.id}
                    onSelect={(e) => {
                      e.preventDefault()
                      onToggleWorkspace(w.id)
                    }}
                    className="gap-2"
                  >
                    <Checkbox checked={selected} onCheckedChange={() => onToggleWorkspace(w.id)} />
                    <span className={cn("size-2 rounded-full", w.dot)} aria-hidden />
                    <span className="flex-1 truncate">{w.name}</span>
                  </DropdownMenuItem>
                )
              })}

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Event types</DropdownMenuLabel>
              {KINDS.map((k) => {
                const selected = selectedKinds.includes(k.id)
                return (
                  <DropdownMenuItem
                    key={k.id}
                    onSelect={(e) => {
                      e.preventDefault()
                      onToggleKind(k.id)
                    }}
                    className="gap-2"
                  >
                    <Checkbox checked={selected} onCheckedChange={() => onToggleKind(k.id)} />
                    <span className="flex-1 truncate">{k.label}</span>
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                }}
                className="gap-2 text-muted-foreground"
              >
                <Sparkles className="size-3.5" aria-hidden />
                Smart filters coming soon
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  )
}
