import type { SupabaseClient } from "@supabase/supabase-js"

export type AppNotificationRow = {
  id: string
  kind: string
  title: string
  body: string | null
  read_at: string | null
  created_at: string
}

export async function fetchNotifications(client: SupabaseClient, userId: string) {
  return client
    .from("notifications")
    .select("id, kind, title, body, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)
}

export async function markNotificationRead(client: SupabaseClient, id: string) {
  return client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id)
}

export async function markAllNotificationsRead(client: SupabaseClient, userId: string) {
  return client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
}
