"use client"

import type { SupabaseClient } from "@supabase/supabase-js"

export type WorkspaceInviteStatus = "pending" | "accepted" | "expired" | "revoked"
export type WorkspaceInviteRole = "member" | "admin" | "viewer"

export interface WorkspaceInviteRow {
  id: string
  workspace_id: string
  invited_email: string
  invited_by: string
  role: WorkspaceInviteRole
  status: WorkspaceInviteStatus
  token: string
  message: string | null
  created_at: string
  expires_at: string
  accepted_at: string | null
  accepted_by: string | null
}

const SELECT_COLUMNS =
  "id, workspace_id, invited_email, invited_by, role, status, token, message, created_at, expires_at, accepted_at, accepted_by"

export async function fetchWorkspaceInvites(
  client: SupabaseClient,
  workspaceId: string,
  userId?: string | null
) {
  if (userId) {
    const { ensureWorkspaceOwnerMember } = await import(
      "@/lib/syncdesk/workspace-members-remote"
    )
    await ensureWorkspaceOwnerMember(client, workspaceId, userId)
  }

  const { error: expireErr } = await client.rpc("expire_stale_workspace_invites", {
    p_workspace_id: workspaceId,
  })
  if (expireErr && process.env.NODE_ENV === "development") {
    console.warn("[invites] expire_stale_workspace_invites:", expireErr.message)
  }

  return client
    .from("workspace_invites")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
}

export function isInviteExpired(invite: Pick<WorkspaceInviteRow, "expires_at" | "status">): boolean {
  if (invite.status !== "pending") return false
  const expires = Date.parse(invite.expires_at)
  return Number.isFinite(expires) && expires < Date.now()
}

/** True only for the partial unique index on pending workspace + email. */
export function isPendingInviteDuplicateError(
  error: { code?: string; message?: string; details?: string } | null | undefined
): boolean {
  if (!error || error.code !== "23505") return false
  const blob = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase()
  return blob.includes("workspace_invites_pending")
}

export async function revokePendingWorkspaceInviteByEmail(
  client: SupabaseClient,
  workspaceId: string,
  email: string
) {
  return client.rpc("revoke_pending_workspace_invite_by_email", {
    p_workspace_id: workspaceId,
    p_email: email.trim(),
  })
}

export interface CreateInviteInput {
  workspaceId: string
  invitedBy: string
  email: string
  role: WorkspaceInviteRole
  message?: string | null
  token: string
}

export async function insertWorkspaceInvite(client: SupabaseClient, input: CreateInviteInput) {
  return client
    .from("workspace_invites")
    .insert({
      workspace_id: input.workspaceId,
      invited_by: input.invitedBy,
      invited_email: input.email,
      role: input.role,
      message: input.message ?? null, 
      status: "pending",
      token: input.token,
    })
    .select(SELECT_COLUMNS)
    .single()
}

export async function revokeWorkspaceInvite(client: SupabaseClient, inviteId: string) {
  return client
    .from("workspace_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .select(SELECT_COLUMNS)
    .maybeSingle()
}

export async function resendWorkspaceInvite(client: SupabaseClient, inviteId: string) {
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  return client
    .from("workspace_invites")
    .update({ status: "pending", expires_at: expiresAt })
    .eq("id", inviteId)
    .select(SELECT_COLUMNS)
    .single()
}

/** RPC row shape — `accepted_workspace_id` after migration 0009; legacy `workspace_id` before. */
export type AcceptInviteRpcRow = {
  accepted_workspace_id?: string
  workspace_id?: string
  workspace_slug?: string
  workspace_name?: string
  team_member_id?: string
}

export type AcceptInviteResult = {
  workspace_id: string
  workspace_slug?: string
  workspace_name: string
  team_member_id: string
}

export function normalizeAcceptInviteRow(row: AcceptInviteRpcRow): AcceptInviteResult {
  const workspace_id = row.accepted_workspace_id ?? row.workspace_id
  if (!workspace_id || !row.workspace_name || !row.team_member_id) {
    throw new Error("Invitation response is missing workspace data.")
  }
  return {
    workspace_id,
    workspace_slug: row.workspace_slug,
    workspace_name: row.workspace_name,
    team_member_id: row.team_member_id,
  }
}

export async function callAcceptInvite(client: SupabaseClient, token: string) {
  const { data, error } = await client.rpc("accept_workspace_invite", { p_token: token })
  if (error) return { data: null, error }
  const raw = (Array.isArray(data) ? data[0] : data) as AcceptInviteRpcRow | null
  if (!raw) return { data: null, error: null }
  try {
    return { data: normalizeAcceptInviteRow(raw), error: null }
  } catch (e) {
    return {
      data: null,
      error: { message: e instanceof Error ? e.message : "Invalid invitation response." } as {
        message: string
      },
    }
  }
}

export function buildInviteAcceptUrl(token: string): string {
  if (typeof window === "undefined") return `/invite/${token}`
  return `${window.location.origin}/invite/${token}`
}

export function generateInviteToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "")
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function fetchWorkspaceInvitePreview(client: SupabaseClient, token: string) {
  const { data, error } = await client.rpc("get_workspace_invite_preview", {
    p_token: token.trim(),
  })
  if (error) return { data: null, error }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
  if (!row) return { data: null, error: null }
  return { data: row, error: null }
}
