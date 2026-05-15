import type {
  BoardMeta,
  BoardTask,
  TaskPriority,
  WorkspaceEntity,
} from "@/lib/boards/types"

export type CalendarView = "month" | "week" | "day"
export type CalendarEventKind = "task" | "meeting" | "deadline"

export interface WorkspacePalette {
  id: string
  name: string
  icon: string
  /** Tailwind class fragments for varying surfaces. */
  dot: string
  surface: string
  surfaceStrong: string
  border: string
  text: string
}

export interface CalendarAttendee {
  id: string
  name: string
  initials: string
  color: string
  avatarUrl?: string
}

export interface CalendarEvent {
  id: string
  date: Date
  /** Optional HH:MM 24h time, e.g. "14:30". When null the event is "all day" / due. */
  time: string | null
  durationMinutes?: number
  title: string
  description?: string
  kind: CalendarEventKind
  priority?: TaskPriority
  workspaceId: string
  boardId?: string
  taskId?: string
  attendees: CalendarAttendee[]
  overdue: boolean
}

const PALETTE: Pick<WorkspacePalette, "dot" | "surface" | "surfaceStrong" | "border" | "text">[] = [
  {
    dot: "bg-sky-500",
    surface: "bg-sky-500/10",
    surfaceStrong: "bg-sky-500/15",
    border: "border-sky-500/30",
    text: "text-sky-700 dark:text-sky-300",
  },
  {
    dot: "bg-fuchsia-500",
    surface: "bg-fuchsia-500/10",
    surfaceStrong: "bg-fuchsia-500/15",
    border: "border-fuchsia-500/30",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
  },
  {
    dot: "bg-emerald-500",
    surface: "bg-emerald-500/10",
    surfaceStrong: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  {
    dot: "bg-amber-500",
    surface: "bg-amber-500/10",
    surfaceStrong: "bg-amber-500/15",
    border: "border-amber-500/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  {
    dot: "bg-rose-500",
    surface: "bg-rose-500/10",
    surfaceStrong: "bg-rose-500/15",
    border: "border-rose-500/30",
    text: "text-rose-700 dark:text-rose-300",
  },
  {
    dot: "bg-violet-500",
    surface: "bg-violet-500/10",
    surfaceStrong: "bg-violet-500/15",
    border: "border-violet-500/30",
    text: "text-violet-700 dark:text-violet-300",
  },
]

export function buildWorkspacePalette(workspaces: WorkspaceEntity[]): Map<string, WorkspacePalette> {
  const out = new Map<string, WorkspacePalette>()
  workspaces.forEach((w, idx) => {
    const tone = PALETTE[idx % PALETTE.length]!
    out.set(w.id, { id: w.id, name: w.name, icon: w.icon, ...tone })
  })
  return out
}

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

/**
 * Parse a loose due-date string. Supports:
 *   "May 18", "May 18, 2026", "Jun 02", ISO "2026-05-18".
 * Empty / "—" / "TBD" return null.
 */
export function parseDueDate(value: string, reference: Date = new Date()): Date | null {
  if (!value) return null
  const v = value.trim()
  if (!v || v === "—" || /tbd/i.test(v)) return null
  const iso = Date.parse(v)
  if (!Number.isNaN(iso) && /\d{4}/.test(v)) return new Date(iso)
  const match = v.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/)
  if (match) {
    const [, monthRaw, dayRaw, yearRaw] = match
    const month = MONTHS[monthRaw!.toLowerCase()]
    if (month === undefined) return null
    const day = Number(dayRaw)
    const year = yearRaw ? Number(yearRaw) : reference.getFullYear()
    return new Date(year, month, day)
  }
  if (!Number.isNaN(iso)) return new Date(iso)
  return null
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

export function formatDueLabel(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0")
  return `${MONTH_SHORT[date.getMonth()]} ${d}`
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  const target = d.getMonth() + months
  d.setDate(1)
  d.setMonth(target)
  return d
}

export function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  const day = d.getDay() // 0 = Sun
  d.setDate(d.getDate() - day)
  return d
}

/**
 * Returns a 42-cell (6×7) grid of dates representing the visible month,
 * starting on Sunday. Days outside the active month are still included for layout.
 */
export function getMonthMatrix(reference: Date): Date[][] {
  const first = new Date(reference.getFullYear(), reference.getMonth(), 1)
  const start = startOfWeek(first)
  const weeks: Date[][] = []
  for (let w = 0; w < 6; w += 1) {
    const row: Date[] = []
    for (let d = 0; d < 7; d += 1) {
      row.push(addDays(start, w * 7 + d))
    }
    weeks.push(row)
  }
  return weeks
}

export function formatMonthYear(date: Date): string {
  return `${[
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][date.getMonth()]} ${date.getFullYear()}`
}

export function formatWeekRange(date: Date): string {
  const start = startOfWeek(date)
  const end = addDays(start, 6)
  if (start.getMonth() === end.getMonth()) {
    return `${MONTH_SHORT[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`
  }
  return `${MONTH_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTH_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`
}

export function formatLongDay(date: Date): string {
  const weekday = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][date.getDay()]
  return `${weekday}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":")
  const hour = Number(h)
  const meridian = hour >= 12 ? "PM" : "AM"
  const adjusted = ((hour + 11) % 12) + 1
  return `${adjusted}:${m ?? "00"} ${meridian}`
}

/** Deterministic-ish "scheduled" time so tasks-with-no-time still get a slot. */
function deterministicTime(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0
  const hour = 9 + (Math.abs(h) % 8) // between 09:00 and 16:00
  const minute = (Math.abs(h >> 3) % 4) * 15
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export function eventsFromTasks(
  tasksByBoardId: Record<string, BoardTask[]>,
  boardsById: Record<string, BoardMeta>,
  reference: Date
): CalendarEvent[] {
  const out: CalendarEvent[] = []
  Object.entries(tasksByBoardId).forEach(([boardId, list]) => {
    const board = boardsById[boardId]
    if (!board) return
    list.forEach((task) => {
      const date = parseDueDate(task.due, reference)
      if (!date) return
      out.push({
        id: `task:${task.id}`,
        date,
        time: deterministicTime(task.id),
        durationMinutes: 30,
        title: task.title,
        description: task.description,
        kind: "task",
        priority: task.priority,
        workspaceId: board.workspaceId,
        boardId: board.id,
        taskId: task.id,
        attendees: task.assignees.map((a) => ({
          id: a.id,
          name: a.name,
          initials: a.initials,
          color: a.color,
        })),
        overdue: task.overdue,
      })
    })
  })
  return out
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const dt = a.date.getTime() - b.date.getTime()
    if (dt !== 0) return dt
    const ta = a.time ?? "23:59"
    const tb = b.time ?? "23:59"
    return ta.localeCompare(tb)
  })
}

export function priorityRank(p?: TaskPriority): number {
  switch (p) {
    case "Urgent":
      return 0
    case "High":
      return 1
    case "Medium":
      return 2
    case "Low":
      return 3
    default:
      return 4
  }
}
