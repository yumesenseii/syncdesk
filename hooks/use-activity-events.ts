"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"

import { registerActivityFeedInvalidator } from "@/lib/activity/activity-invalidation"
import { mapActivityRowsToEvents } from "@/lib/activity/format-activity"
import type { ActivityEvent } from "@/lib/activity/events"
import {
  fetchActivityEvents,
  fetchAssignmentInboxEvents,
} from "@/lib/syncdesk/activity-remote"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { subscribeToPostgresChanges } from "@/lib/supabase/realtime/create-channel"
import { useBoardsStore } from "@/stores/boards-store"

export const activityEventsKey = (workspaceIds: string[]) =>
  ["activity-events", workspaceIds.slice().sort().join(",")] as const

export const activityInboxKey = (userId: string, workspaceIds: string[]) =>
  ["activity-inbox", userId, workspaceIds.slice().sort().join(",")] as const

export function useActivityEventsQuery(workspaceId: string | "all" = "all") {
  const workspaces = useBoardsStore((s) => s.workspaces)
  const teamMembers = useBoardsStore((s) => s.teamMembers)
  const remoteReady = useBoardsStore((s) => s.remoteReady)

  const workspaceIds = useMemo(() => {
    if (workspaceId !== "all") return [workspaceId]
    return workspaces.map((w) => w.id)
  }, [workspaceId, workspaces])

  const query = useQuery({
    queryKey: activityEventsKey(workspaceIds),
    enabled: remoteReady && Boolean(getOptionalSupabaseClient()) && workspaceIds.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const client = getOptionalSupabaseClient()
      if (!client) return []
      const { data, error } = await fetchActivityEvents(client, {
        workspaceIds,
        limit: 100,
      })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const qc = useQueryClient()

  useEffect(() => {
    return registerActivityFeedInvalidator(() => {
      void qc.invalidateQueries({ queryKey: activityEventsKey(workspaceIds) })
      void qc.invalidateQueries({ queryKey: ["activity-inbox"] })
    })
  }, [qc, workspaceIds])

  useEffect(() => {
    const client = getOptionalSupabaseClient()
    if (!client || workspaceIds.length === 0) return

    const filters = workspaceIds.flatMap((id) =>
      (["INSERT", "UPDATE", "DELETE"] as const).map((event) => ({
        event,
        schema: "public",
        table: "activity_events",
        filter: `workspace_id=eq.${id}`,
      }))
    )

    return subscribeToPostgresChanges(client, {
      topic: `activity_events:${workspaceIds.join(",")}`,
      bindings: filters,
      onChange: () => {
        void qc.invalidateQueries({ queryKey: activityEventsKey(workspaceIds) })
      },
    })
  }, [qc, workspaceIds])

  const events: ActivityEvent[] = useMemo(() => {
    const rows = query.data ?? []
    return mapActivityRowsToEvents(rows, teamMembers)
  }, [query.data, teamMembers])

  return {
    events,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useActivityInboxQuery(userId: string | null | undefined) {
  const workspaces = useBoardsStore((s) => s.workspaces)
  const teamMembers = useBoardsStore((s) => s.teamMembers)
  const remoteReady = useBoardsStore((s) => s.remoteReady)
  const workspaceIds = useMemo(() => workspaces.map((w) => w.id), [workspaces])

  const query = useQuery({
    queryKey: activityInboxKey(userId ?? "none", workspaceIds),
    enabled:
      Boolean(userId) &&
      remoteReady &&
      Boolean(getOptionalSupabaseClient()) &&
      workspaceIds.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const client = getOptionalSupabaseClient()
      if (!client || !userId) return []
      const { data, error } = await fetchAssignmentInboxEvents(
        client,
        workspaceIds,
        userId,
        12
      )
      if (error) throw new Error(error.message)
      return data
    },
  })

  const items = useMemo(() => {
    const rows = query.data ?? []
    return mapActivityRowsToEvents(rows, teamMembers)
  }, [query.data, teamMembers])

  return { items, isLoading: query.isLoading, refetch: query.refetch }
}
