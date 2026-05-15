"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { BoardTaskDialog } from "@/components/boards/board-task-dialog"
import { CalendarGrid } from "@/components/calendar/calendar-grid"
import { CalendarInsights } from "@/components/calendar/calendar-insights"
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar"
import {
  CreateMeetingDialog,
  type MeetingDraft,
} from "@/components/calendar/create-meeting-dialog"
import { MiniCalendar } from "@/components/calendar/mini-calendar"
import { UpcomingEvents } from "@/components/calendar/upcoming-events"
import { WorkspaceLegend } from "@/components/calendar/workspace-legend"
import { calendarEventToDraft } from "@/lib/calendar/meeting-types"
import {
  buildWorkspacePalette,
  type CalendarEvent,
  type CalendarEventKind,
  type CalendarView,
  eventsFromTasks,
  formatDueLabel,
  isSameDay,
  startOfDay,
} from "@/lib/calendar/events"
import { useCalendarMeetingsQuery, useMeetingMutations } from "@/hooks/use-meetings"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { useBoardsStore } from "@/stores/boards-store"

const ALL_KINDS: CalendarEventKind[] = ["task", "meeting", "deadline"]

export function CalendarShell() {
  const workspaces = useBoardsStore((s) => s.workspaces)
  const boardsById = useBoardsStore((s) => s.boardsById)
  const tasksByBoardId = useBoardsStore((s) => s.tasksByBoardId)
  const teamMembers = useBoardsStore((s) => s.teamMembers)
  const updateTask = useBoardsStore((s) => s.updateTask)

  const { meetings } = useCalendarMeetingsQuery()
  const {
    createMeeting,
    updateMeeting,
    deleteMeeting,
    rescheduleMeeting,
    isPending: meetingMutationPending,
  } = useMeetingMutations()

  const supabaseReady = Boolean(getOptionalSupabaseClient())

  const [today] = useState(() => startOfDay(new Date()))
  const [cursor, setCursor] = useState<Date>(today)
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [view, setView] = useState<CalendarView>("month")

  const [workspaceFilter, setWorkspaceFilter] = useState<string[]>([])
  const [kindFilter, setKindFilter] = useState<CalendarEventKind[]>(ALL_KINDS)

  const [createOpen, setCreateOpen] = useState(false)
  const [createInitialDate, setCreateInitialDate] = useState<Date>(today)
  const [editingMeeting, setEditingMeeting] = useState<MeetingDraft | null>(null)

  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskDialogTask, setTaskDialogTask] = useState<{
    boardId: string
    task: import("@/lib/boards/types").BoardTask
  } | null>(null)

  const paletteByWorkspace = useMemo(
    () => buildWorkspacePalette(workspaces),
    [workspaces]
  )
  const palettesList = useMemo(
    () => workspaces.map((w) => paletteByWorkspace.get(w.id)!).filter(Boolean),
    [workspaces, paletteByWorkspace]
  )

  const allEvents = useMemo<CalendarEvent[]>(() => {
    const tasks = eventsFromTasks(tasksByBoardId, boardsById, today)
    return [...tasks, ...meetings]
  }, [tasksByBoardId, boardsById, today, meetings])

  const visibleEvents = useMemo(() => {
    const wsActive =
      workspaceFilter.length === 0 || workspaceFilter.length === workspaces.length
        ? null
        : new Set(workspaceFilter)
    const kindsActive =
      kindFilter.length === ALL_KINDS.length ? null : new Set(kindFilter)
    return allEvents.filter((e) => {
      if (wsActive && !wsActive.has(e.workspaceId)) return false
      if (kindsActive && !kindsActive.has(e.kind)) return false
      return true
    })
  }, [allEvents, workspaceFilter, workspaces.length, kindFilter])

  const overdueCount = useMemo(
    () => visibleEvents.filter((e) => e.overdue).length,
    [visibleEvents]
  )

  const toggleWorkspaceFilter = (id: string) => {
    setWorkspaceFilter((prev) => {
      if (prev.length === 0) {
        return workspaces.filter((w) => w.id !== id).map((w) => w.id)
      }
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id)
        return next
      }
      const next = [...prev, id]
      if (next.length === workspaces.length) return []
      return next
    })
  }

  const clearWorkspaceFilter = () => setWorkspaceFilter([])

  const toggleKind = (kind: CalendarEventKind) => {
    setKindFilter((prev) => {
      if (prev.includes(kind)) return prev.filter((k) => k !== kind)
      return [...prev, kind]
    })
  }

  const handleEventSelect = useCallback(
    (event: CalendarEvent) => {
      if (event.kind === "task" && event.boardId && event.taskId) {
        const list = tasksByBoardId[event.boardId] ?? []
        const task = list.find((t) => t.id === event.taskId)
        if (task) {
          setTaskDialogTask({ boardId: event.boardId, task })
          setTaskDialogOpen(true)
        }
        return
      }
      if (event.kind === "meeting") {
        setEditingMeeting(calendarEventToDraft(event))
        setCreateInitialDate(event.date)
        setCreateOpen(true)
      }
    },
    [tasksByBoardId]
  )

  const handleDayClick = useCallback(
    (date: Date) => {
      setSelectedDate(date)
      setCursor(date)
      if (view === "month") {
        setCreateInitialDate(date)
        setEditingMeeting(null)
        setCreateOpen(true)
      } else if (view === "week") {
        setView("day")
      }
    },
    [view]
  )

  const handleEventDrop = useCallback(
    async (eventId: string, nextDate: Date) => {
      if (eventId.startsWith("task:")) {
        const taskId = eventId.slice("task:".length)
        let boardId: string | null = null
        for (const [bid, list] of Object.entries(tasksByBoardId)) {
          if (list.some((t) => t.id === taskId)) {
            boardId = bid
            break
          }
        }
        if (boardId) {
          updateTask(boardId, taskId, {
            due: formatDueLabel(nextDate),
            overdue: nextDate.getTime() < today.getTime(),
          })
        }
        return
      }

      if (eventId.startsWith("meeting:")) {
        const meeting = meetings.find((m) => m.id === eventId)
        if (!meeting) return
        if (!supabaseReady) {
          toast.error("Connect Supabase to reschedule meetings.")
          return
        }
        try {
          await rescheduleMeeting.mutateAsync({
            eventId,
            nextDate,
            time: meeting.time ?? "10:00",
            durationMinutes: meeting.durationMinutes ?? 30,
          })
          toast.success("Meeting rescheduled")
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not reschedule meeting.")
        }
      }
    },
    [tasksByBoardId, updateTask, today, meetings, supabaseReady, rescheduleMeeting]
  )

  const handleCreateOrUpdateMeeting = async (draft: MeetingDraft) => {
    if (!supabaseReady) {
      toast.error("Supabase is not configured. Meetings cannot be saved.")
      throw new Error("Supabase not configured")
    }

    if (draft.id) {
      await updateMeeting.mutateAsync({ ...draft, id: draft.id })
      toast.success("Meeting updated")
      setEditingMeeting(null)
      return
    }

    await createMeeting.mutateAsync(draft)
    toast.success("Meeting created")
  }

  const handleDeleteMeeting = async (id: string) => {
    if (!supabaseReady) {
      toast.error("Supabase is not configured.")
      throw new Error("Supabase not configured")
    }
    await deleteMeeting.mutateAsync(id)
    toast.success("Meeting deleted")
    setEditingMeeting(null)
  }

  const goToday = () => {
    const t = startOfDay(new Date())
    setCursor(t)
    setSelectedDate(t)
  }

  const handleMiniCursorChange = (next: Date) => setCursor(next)

  const handleMiniSelect = (date: Date) => {
    setSelectedDate(date)
    setCursor(date)
    if (view !== "month") setView("day")
  }

  const hasWorkspace = workspaces.length > 0

  return (
    <div className="space-y-4">
      {!hasWorkspace ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/15 px-6 py-12 text-center">
          <p className="text-base font-semibold text-foreground">Create a workspace to start scheduling</p>
          <p className="max-w-md text-sm text-muted-foreground">
            The calendar surfaces tasks, deadlines and meetings from your workspaces. Spin up
            a workspace on the Boards page and your schedule will populate from real records.
          </p>
          <Link
            href="/dashboard/boards"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/25 transition-colors hover:bg-primary/90"
          >
            Go to Boards
          </Link>
        </div>
      ) : null}

      <CalendarToolbar
        cursor={cursor}
        view={view}
        onView={setView}
        onCursorChange={setCursor}
        onToday={goToday}
        onNewEvent={() => {
          setCreateInitialDate(selectedDate)
          setEditingMeeting(null)
          setCreateOpen(true)
        }}
        workspaces={palettesList}
        selectedWorkspaceIds={
          workspaceFilter.length === 0
            ? palettesList.map((w) => w.id)
            : workspaceFilter
        }
        onToggleWorkspace={toggleWorkspaceFilter}
        onClearWorkspaceFilter={clearWorkspaceFilter}
        selectedKinds={kindFilter}
        onToggleKind={toggleKind}
        totalEvents={visibleEvents.length}
        overdueCount={overdueCount}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px] xl:gap-5">
        <div className="min-w-0 space-y-4">
          <CalendarGrid
            view={view}
            cursor={cursor}
            events={visibleEvents}
            paletteByWorkspace={paletteByWorkspace}
            onEventSelect={handleEventSelect}
            onDayClick={handleDayClick}
            onEventDrop={handleEventDrop}
            todayDate={today}
          />
          <SelectedDayPreview
            date={selectedDate}
            events={visibleEvents.filter((e) => isSameDay(e.date, selectedDate))}
            paletteByWorkspace={paletteByWorkspace}
            onEventSelect={handleEventSelect}
            onAddEvent={() => {
              setCreateInitialDate(selectedDate)
              setEditingMeeting(null)
              setCreateOpen(true)
            }}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <MiniCalendar
            cursor={cursor}
            selected={selectedDate}
            events={visibleEvents}
            onCursorChange={handleMiniCursorChange}
            onSelect={handleMiniSelect}
            todayDate={today}
          />
          <UpcomingEvents
            events={visibleEvents}
            paletteByWorkspace={paletteByWorkspace}
            onEventSelect={handleEventSelect}
            todayDate={today}
          />
          <CalendarInsights
            events={visibleEvents}
            paletteByWorkspace={paletteByWorkspace}
            todayDate={today}
          />
          <WorkspaceLegend
            workspaces={palettesList}
            events={allEvents}
            selectedIds={
              workspaceFilter.length === 0
                ? palettesList.map((w) => w.id)
                : workspaceFilter
            }
            onToggle={toggleWorkspaceFilter}
          />
        </aside>
      </div>

      <CreateMeetingDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o)
          if (!o) setEditingMeeting(null)
        }}
        initialDate={createInitialDate}
        workspaces={palettesList}
        team={teamMembers}
        existing={editingMeeting}
        onSubmit={handleCreateOrUpdateMeeting}
        onDelete={editingMeeting ? handleDeleteMeeting : undefined}
        submitting={meetingMutationPending}
      />

      <BoardTaskDialog
        boardId={taskDialogTask?.boardId ?? ""}
        task={taskDialogTask?.task ?? null}
        mode="edit"
        open={taskDialogOpen}
        onOpenChange={(o) => {
          setTaskDialogOpen(o)
          if (!o) setTaskDialogTask(null)
        }}
      />
    </div>
  )
}

function SelectedDayPreview({
  date,
  events,
  paletteByWorkspace,
  onEventSelect,
  onAddEvent,
}: {
  date: Date
  events: CalendarEvent[]
  paletteByWorkspace: Map<string, ReturnType<typeof buildWorkspacePalette> extends Map<string, infer V> ? V : never>
  onEventSelect: (event: CalendarEvent) => void
  onAddEvent: () => void
}) {
  const label = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
  return (
    <section
      aria-label={`Schedule for ${label}`}
      className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/50"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Selected day
          </div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">{label}</h3>
        </div>
        <button
          type="button"
          onClick={onAddEvent}
          className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
        >
          + Add event
        </button>
      </header>
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-3 py-6 text-center text-xs text-muted-foreground">
          Nothing scheduled for this day yet.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {events.map((e) => (
            <button
              key={`preview-${e.id}`}
              type="button"
              onClick={() => onEventSelect(e)}
              className="flex items-start gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-left text-sm shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
            >
              <span
                className={`mt-1 size-1.5 shrink-0 rounded-full ${paletteByWorkspace.get(e.workspaceId)?.dot ?? "bg-primary"}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-foreground">{e.title}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {e.time ? e.time : "All day"}
                  {paletteByWorkspace.get(e.workspaceId)
                    ? ` · ${paletteByWorkspace.get(e.workspaceId)!.name}`
                    : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
