import type { SupabaseClient } from "@supabase/supabase-js"

export type ActorSnapshot = {
  name: string
  avatarUrl: string | null
}

const cache = new Map<string, ActorSnapshot>()

export function clearActorSnapshotCache() {
  cache.clear()
}

export async function resolveActorSnapshot(
  client: SupabaseClient,
  userId: string,
  fallbackEmail?: string | null
): Promise<ActorSnapshot> {
  const cached = cache.get(userId)
  if (cached) return cached

  const { data } = await client
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle()

  const displayName = data?.display_name?.trim()
  const name =
    displayName ||
    (fallbackEmail ? fallbackEmail.split("@")[0] : null) ||
    "Member"

  const snapshot: ActorSnapshot = {
    name,
    avatarUrl: data?.avatar_url ?? null,
  }
  cache.set(userId, snapshot)
  return snapshot
}
