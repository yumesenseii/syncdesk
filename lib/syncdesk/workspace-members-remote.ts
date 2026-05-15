"use client"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { TeamMember, WorkspaceMemberRole } from "@/lib/boards/types"

export type { WorkspaceMemberRole }

export interface WorkspaceMemberRow {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceMemberRole
  joined_at: string
}

type DbProfile = {
  display_name: string | null
  avatar_url: string | null
}

const MEMBER_COLORS = [
  "bg-sky-500/15 text-sky-700",
  "bg-violet-500/15 text-violet-700",
  "bg-emerald-500/15 text-emerald-700",
  "bg-amber-500/15 text-amber-800",
  "bg-rose-500/15 text-rose-700",
  "bg-indigo-500/15 text-indigo-700",
] as const

export function initialsFromName(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "")
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase()
  if (letters.length === 1) return letters.toUpperCase()
  return "??"
}

export function colorForUserId(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash + userId.charCodeAt(i)) % MEMBER_COLORS.length
  }
  return MEMBER_COLORS[Math.abs(hash)] ?? MEMBER_COLORS[0]
}

export function workspaceMemberToTeamMember(
  row: WorkspaceMemberRow,
  profile: DbProfile | null,
  email?: string | null
): TeamMember {
  const name =
    profile?.display_name?.trim() ||
    (email ? email.split("@")[0] : "Member")
  return {
    id: row.user_id,
    userId: row.user_id,
    name,
    initials: initialsFromName(name),
    color: colorForUserId(row.user_id),
    email: email ?? undefined,
    role: row.role,
    avatarUrl: profile?.avatar_url ?? undefined,
  }
}

export async function fetchWorkspaceMembersForWorkspaces(
  client: SupabaseClient,
  workspaceIds: string[]
): Promise<Record<string, TeamMember[]>> {
  if (workspaceIds.length === 0) return {}

  const { data, error } = await client
    .from("workspace_members")
    .select("id, workspace_id, user_id, role, joined_at, profiles(display_name, avatar_url)")
    .in("workspace_id", workspaceIds)
    .order("joined_at", { ascending: true })

  if (error || !data) {
    console.warn("[syncdesk] fetch workspace_members:", error?.message)
    return {}
  }

  const byWorkspace: Record<string, TeamMember[]> = {}
  for (const raw of data as Array<
    WorkspaceMemberRow & { profiles: DbProfile | DbProfile[] | null }
  >) {
    const profile = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles
    const member = workspaceMemberToTeamMember(raw, profile ?? null)
    const list = byWorkspace[raw.workspace_id] ?? []
    list.push(member)
    byWorkspace[raw.workspace_id] = list
  }
  return byWorkspace
}

export async function fetchMyWorkspaceMemberships(
  client: SupabaseClient,
  userId: string
): Promise<{ workspaceId: string; role: WorkspaceMemberRole }[]> {
  const { data, error } = await client
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)

  if (error || !data) return []
  return (data as { workspace_id: string; role: WorkspaceMemberRole }[]).map((r) => ({
    workspaceId: r.workspace_id,
    role: r.role,
  }))
}

export async function remoteInsertWorkspaceOwner(
  client: SupabaseClient,
  workspaceId: string,
  userId: string
) {
  return client.from("workspace_members").upsert(
    {
      workspace_id: workspaceId,
      user_id: userId,
      role: "owner",
    },
    { onConflict: "workspace_id,user_id" }
  )
}

/** Ensures the workspace owner has a membership row (fixes invite/RLS on legacy workspaces). */
export async function ensureWorkspaceOwnerMember(
  client: SupabaseClient,
  workspaceId: string,
  userId: string
) {
  const { data: ws } = await client
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle()
  if (ws?.owner_id !== userId) return { error: null }
  return remoteInsertWorkspaceOwner(client, workspaceId, userId)
}

export async function remoteUpdateWorkspaceMemberRole(
  client: SupabaseClient,
  workspaceId: string,
  memberUserId: string,
  role: WorkspaceMemberRole
) {
  return client
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId)
}

export async function remoteRemoveWorkspaceMember(
  client: SupabaseClient,
  workspaceId: string,
  memberUserId: string
) {
  return client
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId)
}
