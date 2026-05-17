import type { SupabaseClient } from "@supabase/supabase-js"

import type { TaskComment } from "@/lib/boards/types"
import { colorForUserId, initialsFromName } from "@/lib/syncdesk/workspace-members-remote"

export type TaskCommentRow = {
  id: string
  task_id: string
  user_id: string
  content: string
  created_at: string
}

type ProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export function mapTaskCommentRow(
  row: TaskCommentRow,
  profile: ProfileRow | null,
  emailLocal?: string | null
): TaskComment {
  const name =
    profile?.display_name?.trim() ||
    (emailLocal ? emailLocal.split("@")[0] : null) ||
    "Member"
  return {
    id: row.id,
    authorId: row.user_id,
    authorName: name,
    initials: initialsFromName(name),
    color: colorForUserId(row.user_id),
    avatarUrl: profile?.avatar_url ?? undefined,
    text: row.content,
    createdAt: Date.parse(row.created_at),
  }
}

export async function fetchTaskComments(client: SupabaseClient, taskId: string) {
  const { data, error } = await client
    .from("task_comments")
    .select("id, task_id, user_id, content, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })

  if (error) return { data: [] as TaskComment[], error }

  const rows = (data ?? []) as TaskCommentRow[]
  if (rows.length === 0) return { data: [], error: null }

  const userIds = [...new Set(rows.map((r) => r.user_id))]
  const { data: profiles } = await client
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds)

  const profileMap = new Map(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p])
  )

  return {
    data: rows.map((r) => mapTaskCommentRow(r, profileMap.get(r.user_id) ?? null)),
    error: null,
  }
}

export async function insertTaskComment(
  client: SupabaseClient,
  input: { taskId: string; userId: string; content: string }
) {
  const { data, error } = await client
    .from("task_comments")
    .insert({
      task_id: input.taskId,
      user_id: input.userId,
      content: input.content.trim(),
    })
    .select("id, task_id, user_id, content, created_at")
    .single()

  return { data: data as TaskCommentRow | null, error }
}
