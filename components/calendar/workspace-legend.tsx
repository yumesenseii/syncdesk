"use client"

import { useMemo } from "react"
import { Check } from "lucide-react"

import { type CalendarEvent, type WorkspacePalette } from "@/lib/calendar/events"
import { cn } from "@/lib/utils"

export function WorkspaceLegend({
  workspaces,
  events,
  selectedIds,
  onToggle,
}: {
  workspaces: WorkspacePalette[]
  events: CalendarEvent[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    events.forEach((e) => map.set(e.workspaceId, (map.get(e.workspaceId) ?? 0) + 1))
    return map
  }, [events])

  return (
    <section
      aria-label="Workspace legend"
      className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
    >
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Workspaces</h3>
        <span className="text-[10px] text-muted-foreground">Click to filter</span>
      </header>
      <ul className="space-y-1">
        {workspaces.map((w) => {
          const active = selectedIds.includes(w.id)
          const count = counts.get(w.id) ?? 0
          return (
            <li key={w.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(w.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all duration-200",
                  active
                    ? cn(w.surface, w.border)
                    : "border-transparent bg-background/60 hover:border-border/60 hover:bg-background"
                )}
              >
                <span className={cn("size-2 rounded-full", w.dot)} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {w.name}
                </span>
                <span className="rounded-full bg-card/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {count}
                </span>
                {active ? (
                  <Check className={cn("size-3.5", w.text)} aria-hidden />
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
