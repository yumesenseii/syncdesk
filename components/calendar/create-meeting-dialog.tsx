"use client"

import { useMemo, useState } from "react"
import { Calendar, Clock, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { type CalendarAttendee, type WorkspacePalette } from "@/lib/calendar/events"
import type { TeamMember } from "@/lib/boards/types"
import { cn } from "@/lib/utils"

export interface MeetingDraft {
  id?: string
  title: string
  description: string
  date: Date
  time: string
  durationMinutes: number
  workspaceId: string
  attendees: CalendarAttendee[]
}

function toDateInputValue(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function fromDateInputValue(s: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function CreateMeetingDialog({
  open,
  onOpenChange,
  initialDate,
  workspaces,
  team,
  existing,
  onSubmit,
  onDelete,
  submitting = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate: Date
  workspaces: WorkspacePalette[]
  team: TeamMember[]
  existing?: MeetingDraft | null
  onSubmit: (draft: MeetingDraft) => void | Promise<void>
  onDelete?: (id: string) => void | Promise<void>
  submitting?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <CreateMeetingBody
          initialDate={initialDate}
          workspaces={workspaces}
          team={team}
          existing={existing ?? null}
          onSubmit={onSubmit}
          onDelete={onDelete}
          onOpenChange={onOpenChange}
          submitting={submitting}
        />
      ) : null}
    </Dialog>
  )
}

function CreateMeetingBody({
  initialDate,
  workspaces,
  team,
  existing,
  onSubmit,
  onDelete,
  onOpenChange,
  submitting = false,
}: {
  initialDate: Date
  workspaces: WorkspacePalette[]
  team: TeamMember[]
  existing: MeetingDraft | null
  onSubmit: (draft: MeetingDraft) => void | Promise<void>
  onDelete?: (id: string) => void | Promise<void>
  onOpenChange: (open: boolean) => void
  submitting?: boolean
}) {
  const seed = useMemo<MeetingDraft>(() => {
    if (existing) return existing
    return {
      title: "",
      description: "",
      date: initialDate,
      time: "10:00",
      durationMinutes: 30,
      workspaceId: workspaces[0]?.id ?? "",
      attendees: [],
    }
    // Intentionally seeded once at mount; the body remounts on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [title, setTitle] = useState(seed.title)
  const [description, setDescription] = useState(seed.description)
  const [date, setDate] = useState<Date>(seed.date)
  const [time, setTime] = useState(seed.time)
  const [duration, setDuration] = useState(seed.durationMinutes)
  const [workspaceId, setWorkspaceId] = useState(seed.workspaceId)
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    seed.attendees.map((a) => a.id)
  )

  const toggleAttendee = (id: string) => {
    setAttendeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const [localSubmitting, setLocalSubmitting] = useState(false)
  const busy = submitting || localSubmitting

  const submit = async () => {
    if (busy) return
    if (!title.trim()) {
      toast.error("Add a meeting title to continue.")
      return
    }
    if (!workspaceId) {
      toast.error("Pick a workspace for this meeting.")
      return
    }
    const attendees: CalendarAttendee[] = attendeeIds
      .map((id) => team.find((m) => m.id === id))
      .filter((m): m is TeamMember => Boolean(m))
      .map((m) => ({
        id: m.id,
        name: m.name,
        initials: m.initials,
        color: m.color,
        avatarUrl: m.avatarUrl,
      }))
    setLocalSubmitting(true)
    try {
      await onSubmit({
        id: existing?.id,
        title: title.trim(),
        description: description.trim(),
        date,
        time,
        durationMinutes: duration,
        workspaceId,
        attendees,
      })
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save meeting.")
    } finally {
      setLocalSubmitting(false)
    }
  }

  const activeWorkspace = workspaces.find((w) => w.id === workspaceId)

  return (
    <DialogContent
      className={cn(
        "fixed left-1/2 top-1/2 z-50 flex w-full max-w-none -translate-x-1/2 -translate-y-1/2 flex-col gap-0",
        "overflow-hidden rounded-2xl bg-card p-0 text-foreground shadow-2xl ring-1 ring-foreground/10",
        "sm:max-w-[640px]"
      )}
    >
      <DialogTitle className="sr-only">
        {existing ? "Edit meeting" : "Create new meeting"}
      </DialogTitle>
      <DialogDescription className="sr-only">
        Schedule a new collaborative meeting and assign attendees.
      </DialogDescription>

      <header className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting title"
            className="block w-full bg-transparent text-lg font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60"
            aria-label="Meeting title"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-full"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-full"
          onClick={() => void submit()}
          disabled={busy}
        >
          {busy ? "Saving…" : existing ? "Save" : "Create"}
        </Button>
      </header>

      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Date
            </label>
            <div className="relative">
              <Calendar
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="date"
                value={toDateInputValue(date)}
                onChange={(e) => {
                  const next = fromDateInputValue(e.target.value)
                  if (next) setDate(next)
                }}
                className="h-9 rounded-lg border-border/70 bg-background pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Time
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Clock
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-9 rounded-lg border-border/70 bg-background pl-8"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 justify-between rounded-lg border-border/70 bg-background font-normal"
                  >
                    {duration}m
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {[15, 30, 45, 60, 90].map((m) => (
                    <DropdownMenuItem key={m} onClick={() => setDuration(m)}>
                      {m} minutes
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Agenda, notes, or links"
            rows={3}
            className="block w-full resize-y rounded-lg border border-border/70 bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Workspace
          </label>
          <div className="flex flex-wrap gap-1.5">
            {workspaces.map((w) => {
              const active = w.id === workspaceId
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWorkspaceId(w.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all",
                    active
                      ? cn(w.surfaceStrong, w.border, w.text)
                      : "border-border/60 bg-background text-foreground/80 hover:bg-muted/40"
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", w.dot)} aria-hidden />
                  {w.name}
                </button>
              )
            })}
          </div>
          {activeWorkspace ? (
            <p className="text-[11px] text-muted-foreground">
              Meeting will appear in <span className="font-semibold text-foreground">{activeWorkspace.name}</span>.
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Attendees
            </label>
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Users className="size-3" aria-hidden />
              {attendeeIds.length} selected
            </span>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {team.map((m) => {
              const selected = attendeeIds.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleAttendee(m.id)}
                  aria-pressed={selected}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition-colors",
                    selected
                      ? "border-primary/50 bg-primary/[0.06]"
                      : "border-border/60 bg-background hover:bg-muted/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      m.color
                    )}
                    aria-hidden
                  >
                    {m.initials}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-border/60 bg-card/95 px-5 py-3">
        {existing && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-full text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setLocalSubmitting(true)
                try {
                  await onDelete!(existing.id!)
                  onOpenChange(false)
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Could not delete meeting."
                  )
                } finally {
                  setLocalSubmitting(false)
                }
              })()
            }}
          >
            Delete meeting
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-full"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? "Saving…" : existing ? "Save changes" : "Create meeting"}
          </Button>
        </div>
      </footer>
    </DialogContent>
  )
}
