import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveActorSnapshot } from "@/lib/activity/resolve-actor"
import type {
  ActivityEventMetadata,
  ActivityEventRow,
  ActivityEventType,
} from "@/lib/activity/activity-event-types"

export type InsertActivityEventInput = {
  workspaceId: string
  eventType: ActivityEventType
  summary: string
  boardId?: string | null
  taskId?: string | null
  meetingId?: string | null
  metadata?: ActivityEventMetadata
  /** Skip profile lookup when caller already has snapshot */
  actorName?: string | null
  actorAvatarUrl?: string | null
}

export const ACTIVITY_SELECT =
  "id, workspace_id, board_id, task_id, meeting_id, actor_user_id, actor_name, actor_avatar_url, event_type, summary, metadata, created_at"

export async function insertActivityEvent(
  client: SupabaseClient,
  actorUserId: string,
  input: InsertActivityEventInput,
  actorEmail?: string | null
) {
  let actorName = input.actorName ?? null
  let actorAvatarUrl = input.actorAvatarUrl ?? null

  if (!actorName?.trim()) {
    const snapshot = await resolveActorSnapshot(client, actorUserId, actorEmail)
    actorName = snapshot.name
    actorAvatarUrl = actorAvatarUrl ?? snapshot.avatarUrl
  }

  return client.from("activity_events").insert({
    workspace_id: input.workspaceId,
    board_id: input.boardId ?? null,
    task_id: input.taskId ?? null,
    meeting_id: input.meetingId ?? null,
    actor_user_id: actorUserId,
    actor_name: actorName,
    actor_avatar_url: actorAvatarUrl,
    event_type: input.eventType,
    summary: input.summary,
    metadata: input.metadata ?? {},
  })
}

export type FetchActivityEventsOptions = {
  workspaceIds: string[]
  limit?: number
  /** ISO timestamp — return events strictly older than this */
  before?: string
}

export async function fetchActivityEvents(
  client: SupabaseClient,
  options: FetchActivityEventsOptions
) {
  const limit = options.limit ?? 80

  let mainQuery = client
    .from("activity_events")
    .select(ACTIVITY_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (options.workspaceIds.length > 0) {
    mainQuery = mainQuery.in("workspace_id", options.workspaceIds)
  } else {
    mainQuery = mainQuery.is("workspace_id", null).eq("event_type", "workspace_deleted")
  }

  if (options.before) {
    mainQuery = mainQuery.lt("created_at", options.before)
  }

  const orphanQuery =
    options.workspaceIds.length > 0
      ? client
          .from("activity_events")
          .select(ACTIVITY_SELECT)
          .is("workspace_id", null)
          .eq("event_type", "workspace_deleted")
          .order("created_at", { ascending: false })
          .limit(Math.min(limit, 20))
      : null

  const [mainRes, orphanRes] = await Promise.all([
    mainQuery,
    orphanQuery,
  ])

  if (mainRes.error) return { data: [] as ActivityEventRow[], error: mainRes.error }
  if (orphanRes?.error) return { data: [] as ActivityEventRow[], error: orphanRes.error }

  const merged = [...(mainRes.data ?? []), ...(orphanRes?.data ?? [])] as ActivityEventRow[]
  const seen = new Set<string>()
  const deduped = merged.filter((row) => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  })
  deduped.sort((a, b) => b.created_at.localeCompare(a.created_at))

  return { data: deduped.slice(0, limit), error: null }
}

/** Assignment events for the signed-in user's inbox. */
export async function fetchAssignmentInboxEvents(
  client: SupabaseClient,
  workspaceIds: string[],
  userId: string,
  limit = 12
) {
  if (workspaceIds.length === 0) {
    return { data: [] as ActivityEventRow[], error: null }
  }

  const { data, error } = await client
    .from("activity_events")
    .select(ACTIVITY_SELECT)
    .in("workspace_id", workspaceIds)
    .eq("event_type", "task_assigned")
    .contains("metadata", { inbox_for_user_id: userId })
    .order("created_at", { ascending: false })
    .limit(limit)

  return { data: (data as ActivityEventRow[] | null) ?? [], error }
}
