"use client"

import type { SupabaseClient } from "@supabase/supabase-js"
import { toast } from "sonner"

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

export type ListWorkspaceMemberRpcRow = {
  member_row_id: string
  workspace_id: string
  user_id: string
  role: string
  joined_at: string
  display_name: string | null
  avatar_url: string | null
  email: string | null
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

export function rpcRowToTeamMember(row: ListWorkspaceMemberRpcRow): TeamMember {
  const name =
    row.display_name?.trim() ||
    (row.email ? row.email.split("@")[0] : "Member")
  const role = row.role as WorkspaceMemberRole
  return {
    id: row.user_id,
    userId: row.user_id,
    name,
    initials: initialsFromName(name),
    color: colorForUserId(row.user_id),
    email: row.email?.trim() || undefined,
    role: role === "owner" || role === "admin" || role === "viewer" ? role : "member",
    avatarUrl: row.avatar_url ?? undefined,
    joinedAt: row.joined_at,
  }
}

function workspaceMemberToTeamMember(
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
    joinedAt: row.joined_at,
  }
}

async function fetchWorkspaceMembersViaRpc(
  client: SupabaseClient,
  workspaceId: string
): Promise<{ members: TeamMember[]; error: string | null }> {
  const { data, error } = await client.rpc("list_workspace_members", {
    p_workspace_id: workspaceId,
  })

  if (error) {
    return { members: [], error: error.message }
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as ListWorkspaceMemberRpcRow[]
  const seen = new Set<string>()
  const members: TeamMember[] = []

  for (const row of rows) {
    if (!row.user_id || seen.has(row.user_id)) continue
    seen.add(row.user_id)
    members.push(rpcRowToTeamMember(row))
  }

  return { members, error: null }
}

/** Fallback when RPC is not deployed yet — no profiles embed (avoids relationship/RLS failures). */
async function fetchWorkspaceMembersDirect(
  client: SupabaseClient,
  workspaceId: string
): Promise<{ members: TeamMember[]; error: string | null }> {
  const [membersRes, invitesRes, wsRes] = await Promise.all([
    client
      .from("workspace_members")
      .select("id, workspace_id, user_id, role, joined_at")
      .eq("workspace_id", workspaceId)
      .order("joined_at", { ascending: true }),
    client
      .from("workspace_invites")
      .select("invited_email, accepted_by, accepted_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "accepted"),
    client.from("workspaces").select("owner_id").eq("id", workspaceId).maybeSingle(),
  ])

  if (membersRes.error) {
    return { members: [], error: membersRes.error.message }
  }

  const emailByUserId = new Map<string, string>()
  for (const inv of (invitesRes.data ?? []) as {
    invited_email: string
    accepted_by: string | null
  }[]) {
    if (inv.accepted_by && inv.invited_email) {
      emailByUserId.set(inv.accepted_by, inv.invited_email.trim().toLowerCase())
    }
  }

  const userIds = (membersRes.data ?? []).map((r) => r.user_id as string)
  const profileMap = new Map<string, DbProfile>()

  if (userIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds)
    for (const p of (profiles ?? []) as (DbProfile & { id: string })[]) {
      profileMap.set(p.id, p)
    }
  }

  const members: TeamMember[] = []
  const seen = new Set<string>()

  for (const raw of (membersRes.data ?? []) as WorkspaceMemberRow[]) {
    const profile = profileMap.get(raw.user_id) ?? null
    const email = emailByUserId.get(raw.user_id)
    members.push(workspaceMemberToTeamMember(raw, profile, email))
    seen.add(raw.user_id)
  }

  const ownerId = (wsRes.data as { owner_id?: string } | null)?.owner_id
  if (ownerId && !seen.has(ownerId)) {
    const profile = profileMap.get(ownerId) ?? null
    const { data: ownerProfile } = profile
      ? { data: profile }
      : await client
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", ownerId)
          .maybeSingle()
    const p = (ownerProfile ?? profile) as DbProfile | null
    const name = p?.display_name?.trim() || "Owner"
    members.unshift({
      id: ownerId,
      userId: ownerId,
      name,
      initials: initialsFromName(name),
      color: colorForUserId(ownerId),
      role: "owner",
      avatarUrl: p?.avatar_url ?? undefined,
      joinedAt: new Date(0).toISOString(),
    })
  }

  return { members, error: null }
}

export type FetchWorkspaceMembersResult = {
  members: TeamMember[]
  error: string | null
}

/**
 * Loads all workspace members from `workspace_members` (source of truth).
 * Uses security-definer RPC when available; falls back to direct select.
 */
export async function fetchWorkspaceMembersDetail(
  client: SupabaseClient,
  workspaceId: string,
  options?: { silent?: boolean }
): Promise<TeamMember[]> {
  const rpc = await fetchWorkspaceMembersViaRpc(client, workspaceId)
  if (!rpc.error) {
    return rpc.members
  }

  if (process.env.NODE_ENV === "development") {
    console.warn("[syncdesk] list_workspace_members RPC:", rpc.error, "— using direct fetch")
  }

  const direct = await fetchWorkspaceMembersDirect(client, workspaceId)
  if (direct.error) {
    const message = `Could not load workspace members: ${direct.error}`
    console.error("[syncdesk]", message)
    if (!options?.silent) {
      toast.error(message)
    }
    throw new Error(message)
  }

  return direct.members
}

export async function fetchWorkspaceMembersForWorkspaces(
  client: SupabaseClient,
  workspaceIds: string[]
): Promise<Record<string, TeamMember[]>> {
  if (workspaceIds.length === 0) return {}

  const results = await Promise.all(
    workspaceIds.map(async (id) => {
      try {
        const members = await fetchWorkspaceMembersDetail(client, id, { silent: true })
        return [id, members] as const
      } catch (e) {
        console.warn("[syncdesk] members for workspace", id, e)
        return [id, [] as TeamMember[]] as const
      }
    })
  )

  const byWorkspace: Record<string, TeamMember[]> = {}
  for (const [id, members] of results) {
    byWorkspace[id] = members
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

/** Verify current user has a workspace_members row after accepting an invite. */
export async function verifyWorkspaceMembership(
  client: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await client
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("[syncdesk] verify workspace membership:", error.message)
    return false
  }
  return Boolean(data)
}
