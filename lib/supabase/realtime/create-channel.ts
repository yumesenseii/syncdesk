"use client"

import type {
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js"

export interface PostgresChangesBinding {
  event: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT}` | "*"
  schema: string
  table: string
  filter?: string
}

export interface CreatePostgresChannelOptions {
  /**
   * Human-readable label used as part of the channel topic. The helper appends a
   * random suffix so two callers can subscribe to overlapping bindings without
   * Supabase's per-topic channel dedup throwing "cannot add postgres_changes
   * callbacks after subscribe()".
   */
  topic: string
  bindings: PostgresChangesBinding[]
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onStatus?: (status: string) => void
}

function uniqueId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8)
  }
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Build, fully configure, then subscribe a realtime channel in one call.
 *
 * Supabase's API requires ALL `.on()` listeners to be attached BEFORE `.subscribe()`.
 * This helper enforces that ordering and uses a uniquified topic so the channel can
 * never collide with another caller's already-subscribed channel of the same name.
 *
 * Returns a cleanup function that removes the channel.
 */
export function subscribeToPostgresChanges(
  client: SupabaseClient,
  options: CreatePostgresChannelOptions
): () => void {
  const topic = `${options.topic}:${uniqueId()}`
  let channel: RealtimeChannel | null = client.channel(topic)

  for (const binding of options.bindings) {
    channel = channel.on(
      "postgres_changes",
      binding,
      options.onChange as Parameters<RealtimeChannel["on"]>[2]
    )
  }

  channel.subscribe((status) => {
    options.onStatus?.(status)
  })

  return () => {
    if (!channel) return
    const ref = channel
    channel = null
    void client.removeChannel(ref)
  }
}
