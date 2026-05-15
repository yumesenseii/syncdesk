import type { CalendarAttendee, CalendarEvent } from "@/lib/calendar/events"
import { startOfDay } from "@/lib/calendar/events"
import type { MeetingDraft } from "@/components/calendar/create-meeting-dialog"

export const MEETING_EVENT_PREFIX = "meeting:"

export interface MeetingAttendeeJson {
  id: string
  name: string
  initials: string
  color: string
  avatarUrl?: string
}

export interface CalendarMeetingRow {
  id: string
  workspace_id: string
  created_by: string
  title: string
  description: string
  start_at: string
  end_at: string
  attendees: MeetingAttendeeJson[] | null
  created_at: string
  updated_at: string
}

export function meetingEventId(rowId: string): string {
  return `${MEETING_EVENT_PREFIX}${rowId}`
}

export function parseMeetingEventId(eventId: string): string | null {
  if (!eventId.startsWith(MEETING_EVENT_PREFIX)) return null
  return eventId.slice(MEETING_EVENT_PREFIX.length)
}

function parseAttendees(raw: MeetingAttendeeJson[] | null): CalendarAttendee[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((a) => a && typeof a.id === "string")
    .map((a) => ({
      id: a.id,
      name: a.name ?? "Member",
      initials: a.initials ?? "??",
      color: a.color ?? "bg-primary/15 text-primary",
      avatarUrl: a.avatarUrl,
    }))
}

export function meetingRowToCalendarEvent(row: CalendarMeetingRow): CalendarEvent {
  const start = new Date(row.start_at)
  const end = new Date(row.end_at)
  const durationMinutes = Math.max(
    15,
    Math.round((end.getTime() - start.getTime()) / 60_000)
  )
  const time = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`

  return {
    id: meetingEventId(row.id),
    date: startOfDay(start),
    time,
    durationMinutes,
    title: row.title,
    description: row.description || undefined,
    kind: "meeting",
    workspaceId: row.workspace_id,
    attendees: parseAttendees(row.attendees),
    overdue: false,
  }
}

export function attendeesToJson(attendees: CalendarAttendee[]): MeetingAttendeeJson[] {
  return attendees.map((a) => ({
    id: a.id,
    name: a.name,
    initials: a.initials,
    color: a.color,
    ...(a.avatarUrl ? { avatarUrl: a.avatarUrl } : {}),
  }))
}

/** Local date + HH:MM → ISO timestamps (stored as timestamptz). */
export function draftToTimestamps(draft: Pick<MeetingDraft, "date" | "time" | "durationMinutes">): {
  start_at: string
  end_at: string
} {
  const [hourRaw, minuteRaw] = draft.time.split(":")
  const hours = Number(hourRaw)
  const minutes = Number(minuteRaw)
  const start = new Date(draft.date)
  start.setHours(Number.isFinite(hours) ? hours : 10, Number.isFinite(minutes) ? minutes : 0, 0, 0)
  const end = new Date(start.getTime() + draft.durationMinutes * 60_000)
  return { start_at: start.toISOString(), end_at: end.toISOString() }
}

export function meetingRowToDraft(row: CalendarMeetingRow): import("@/components/calendar/create-meeting-dialog").MeetingDraft {
  const start = new Date(row.start_at)
  const end = new Date(row.end_at)
  const durationMinutes = Math.max(
    15,
    Math.round((end.getTime() - start.getTime()) / 60_000)
  )
  const time = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`

  return {
    id: meetingEventId(row.id),
    title: row.title,
    description: row.description ?? "",
    date: startOfDay(start),
    time,
    durationMinutes,
    workspaceId: row.workspace_id,
    attendees: parseAttendees(row.attendees),
  }
}

export function calendarEventToDraft(event: CalendarEvent): import("@/components/calendar/create-meeting-dialog").MeetingDraft {
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    date: event.date,
    time: event.time ?? "10:00",
    durationMinutes: event.durationMinutes ?? 30,
    workspaceId: event.workspaceId,
    attendees: event.attendees,
  }
}
