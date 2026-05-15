import type { SupabaseClient } from "@supabase/supabase-js"

import type { MeetingDraft } from "@/components/calendar/create-meeting-dialog"
import {
  attendeesToJson,
  draftToTimestamps,
  type CalendarMeetingRow,
} from "@/lib/calendar/meeting-types"

export const MEETINGS_SELECT =
  "id, workspace_id, created_by, title, description, start_at, end_at, attendees, created_at, updated_at"

export type CreateMeetingInput = MeetingDraft

export type UpdateMeetingInput = MeetingDraft & { id: string }

export async function fetchCalendarMeetings(
  client: SupabaseClient,
  workspaceIds: string[]
) {
  if (workspaceIds.length === 0) {
    return { data: [] as CalendarMeetingRow[], error: null }
  }

  const { data, error } = await client
    .from("calendar_meetings")
    .select(MEETINGS_SELECT)
    .in("workspace_id", workspaceIds)
    .order("start_at", { ascending: true })

  return { data: (data as CalendarMeetingRow[] | null) ?? [], error }
}

export async function insertCalendarMeeting(
  client: SupabaseClient,
  userId: string,
  draft: CreateMeetingInput
) {
  const { start_at, end_at } = draftToTimestamps(draft)
  return client
    .from("calendar_meetings")
    .insert({
      workspace_id: draft.workspaceId,
      created_by: userId,
      title: draft.title.trim(),
      description: draft.description.trim(),
      start_at,
      end_at,
      attendees: attendeesToJson(draft.attendees),
    })
    .select(MEETINGS_SELECT)
    .single()
}

export async function updateCalendarMeeting(
  client: SupabaseClient,
  draft: UpdateMeetingInput
) {
  const rowId = draft.id.startsWith("meeting:")
    ? draft.id.slice("meeting:".length)
    : draft.id
  const { start_at, end_at } = draftToTimestamps(draft)

  return client
    .from("calendar_meetings")
    .update({
      workspace_id: draft.workspaceId,
      title: draft.title.trim(),
      description: draft.description.trim(),
      start_at,
      end_at,
      attendees: attendeesToJson(draft.attendees),
    })
    .eq("id", rowId)
    .select(MEETINGS_SELECT)
    .single()
}

export async function deleteCalendarMeeting(client: SupabaseClient, eventId: string) {
  const rowId = eventId.startsWith("meeting:")
    ? eventId.slice("meeting:".length)
    : eventId
  return client.from("calendar_meetings").delete().eq("id", rowId)
}

/** Move meeting to a new calendar day while preserving clock time and duration. */
export async function rescheduleCalendarMeeting(
  client: SupabaseClient,
  eventId: string,
  nextDate: Date,
  time: string,
  durationMinutes: number
) {
  const draft = {
    date: nextDate,
    time,
    durationMinutes,
  }
  const { start_at, end_at } = draftToTimestamps(draft)
  const rowId = eventId.startsWith("meeting:")
    ? eventId.slice("meeting:".length)
    : eventId

  return client
    .from("calendar_meetings")
    .update({ start_at, end_at })
    .eq("id", rowId)
    .select(MEETINGS_SELECT)
    .single()
}
