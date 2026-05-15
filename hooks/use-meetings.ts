"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"

import type { MeetingDraft } from "@/components/calendar/create-meeting-dialog"
import type { CalendarEvent } from "@/lib/calendar/events"
import {
  meetingEventId,
  meetingRowToCalendarEvent,
  parseMeetingEventId,
  type CalendarMeetingRow,
} from "@/lib/calendar/meeting-types"
import * as taskActivity from "@/lib/activity/task-activity"
import { useAuth } from "@/hooks/use-auth"
import {
  deleteCalendarMeeting,
  fetchCalendarMeetings,
  insertCalendarMeeting,
  rescheduleCalendarMeeting,
  updateCalendarMeeting,
} from "@/lib/syncdesk/meetings-remote"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { subscribeToPostgresChanges } from "@/lib/supabase/realtime/create-channel"
import { useBoardsStore } from "@/stores/boards-store"

export const calendarMeetingsKey = (workspaceIds: string[]) =>
  ["calendar-meetings", workspaceIds.slice().sort().join(",")] as const

export function useCalendarMeetingsQuery() {
  const workspaces = useBoardsStore((s) => s.workspaces)
  const remoteReady = useBoardsStore((s) => s.remoteReady)
  const workspaceIds = useMemo(() => workspaces.map((w) => w.id), [workspaces])

  const query = useQuery({
    queryKey: calendarMeetingsKey(workspaceIds),
    enabled: remoteReady && Boolean(getOptionalSupabaseClient()) && workspaceIds.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const client = getOptionalSupabaseClient()
      if (!client) return []
      const { data, error } = await fetchCalendarMeetings(client, workspaceIds)
      if (error) throw new Error(error.message)
      return data
    },
  })

  const qc = useQueryClient()

  useEffect(() => {
    const client = getOptionalSupabaseClient()
    if (!client || workspaceIds.length === 0) return

    const bindings = workspaceIds.flatMap((id) =>
      (["INSERT", "UPDATE", "DELETE"] as const).map((event) => ({
        event,
        schema: "public",
        table: "calendar_meetings",
        filter: `workspace_id=eq.${id}`,
      }))
    )

    return subscribeToPostgresChanges(client, {
      topic: `calendar_meetings:${workspaceIds.join(",")}`,
      bindings,
      onChange: () => {
        void qc.invalidateQueries({ queryKey: calendarMeetingsKey(workspaceIds) })
      },
    })
  }, [qc, workspaceIds])

  const meetings: CalendarEvent[] = useMemo(() => {
    const rows = query.data ?? []
    return rows.map(meetingRowToCalendarEvent)
  }, [query.data])

  return {
    meetings,
    rows: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

function upsertRowInCache(
  qc: ReturnType<typeof useQueryClient>,
  workspaceIds: string[],
  row: CalendarMeetingRow
) {
  qc.setQueryData<CalendarMeetingRow[]>(calendarMeetingsKey(workspaceIds), (prev) => {
    const list = prev ?? []
    const idx = list.findIndex((r) => r.id === row.id)
    if (idx === -1) return [...list, row].sort((a, b) => a.start_at.localeCompare(b.start_at))
    const next = [...list]
    next[idx] = row
    return next
  })
}

function workspaceCtx(
  workspaces: { id: string; name: string; slug: string }[],
  workspaceId: string
) {
  const w = workspaces.find((x) => x.id === workspaceId)
  return w ? { name: w.name, slug: w.slug } : undefined
}

function removeRowFromCache(
  qc: ReturnType<typeof useQueryClient>,
  workspaceIds: string[],
  rowId: string
) {
  qc.setQueryData<CalendarMeetingRow[]>(calendarMeetingsKey(workspaceIds), (prev) =>
    (prev ?? []).filter((r) => r.id !== rowId)
  )
}

export function useMeetingMutations() {
  const { user } = useAuth()
  const workspaces = useBoardsStore((s) => s.workspaces)
  const workspaceIds = useMemo(() => workspaces.map((w) => w.id), [workspaces])
  const qc = useQueryClient()

  const createMeeting = useMutation({
    mutationFn: async (draft: MeetingDraft) => {
      const client = getOptionalSupabaseClient()
      if (!client) throw new Error("Supabase is not configured.")
      if (!user?.id) throw new Error("You must be signed in to create a meeting.")
      const { data, error } = await insertCalendarMeeting(client, user.id, draft)
      if (error) throw new Error(error.message)
      if (!data) throw new Error("Meeting was not created.")
      return data as CalendarMeetingRow
    },
    onSuccess: (row) => {
      upsertRowInCache(qc, workspaceIds, row)
      taskActivity.logMeetingCreated(
        row.workspace_id,
        row.id,
        row.title,
        row.start_at,
        workspaceCtx(workspaces, row.workspace_id)
      )
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: calendarMeetingsKey(workspaceIds) })
    },
  })

  const updateMeeting = useMutation({
    mutationFn: async (draft: MeetingDraft & { id: string }) => {
      const client = getOptionalSupabaseClient()
      if (!client) throw new Error("Supabase is not configured.")
      const { data, error } = await updateCalendarMeeting(client, draft)
      if (error) throw new Error(error.message)
      if (!data) throw new Error("Meeting was not updated.")
      return data as CalendarMeetingRow
    },
    onSuccess: (row) => {
      upsertRowInCache(qc, workspaceIds, row)
      taskActivity.logMeetingUpdated(
        row.workspace_id,
        row.id,
        row.title,
        row.start_at,
        workspaceCtx(workspaces, row.workspace_id)
      )
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: calendarMeetingsKey(workspaceIds) })
    },
  })

  const deleteMeeting = useMutation({
    mutationFn: async (eventId: string) => {
      const client = getOptionalSupabaseClient()
      if (!client) throw new Error("Supabase is not configured.")
      const rowId = parseMeetingEventId(eventId) ?? eventId
      const cached = qc
        .getQueryData<CalendarMeetingRow[]>(calendarMeetingsKey(workspaceIds))
        ?.find((r) => r.id === rowId)
      const { error } = await deleteCalendarMeeting(client, eventId)
      if (error) throw new Error(error.message)
      return { rowId, cached }
    },
    onSuccess: ({ rowId, cached }) => {
      removeRowFromCache(qc, workspaceIds, rowId)
      if (cached) {
        taskActivity.logMeetingDeleted(
          cached.workspace_id,
          cached.id,
          cached.title,
          workspaceCtx(workspaces, cached.workspace_id)
        )
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: calendarMeetingsKey(workspaceIds) })
    },
  })

  const rescheduleMeeting = useMutation({
    mutationFn: async ({
      eventId,
      nextDate,
      time,
      durationMinutes,
    }: {
      eventId: string
      nextDate: Date
      time: string
      durationMinutes: number
    }) => {
      const client = getOptionalSupabaseClient()
      if (!client) throw new Error("Supabase is not configured.")
      const { data, error } = await rescheduleCalendarMeeting(
        client,
        eventId,
        nextDate,
        time,
        durationMinutes
      )
      if (error) throw new Error(error.message)
      if (!data) throw new Error("Meeting was not rescheduled.")
      return data as CalendarMeetingRow
    },
    onSuccess: (row) => {
      upsertRowInCache(qc, workspaceIds, row)
      taskActivity.logMeetingUpdated(
        row.workspace_id,
        row.id,
        row.title,
        row.start_at,
        workspaceCtx(workspaces, row.workspace_id)
      )
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: calendarMeetingsKey(workspaceIds) })
    },
  })

  return {
    createMeeting,
    updateMeeting,
    deleteMeeting,
    rescheduleMeeting,
    isPending:
      createMeeting.isPending ||
      updateMeeting.isPending ||
      deleteMeeting.isPending ||
      rescheduleMeeting.isPending,
  }
}

export { meetingEventId }
