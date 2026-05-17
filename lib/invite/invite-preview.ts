import type { WorkspaceInviteRole, WorkspaceInviteStatus } from "@/lib/syncdesk/workspace-invites-remote"

export type InvitePreview = {
  inviteId: string
  invitedEmail: string
  role: WorkspaceInviteRole
  status: WorkspaceInviteStatus
  expiresAt: string
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  workspaceIcon: string
  inviterName: string
}

export type InvitePreviewRpcRow = {
  invite_id: string
  invited_email: string
  invite_role: string
  invite_status: string
  expires_at: string
  workspace_id: string
  workspace_name: string
  workspace_slug: string | null
  workspace_icon: string | null
  inviter_name: string | null
}

export function mapInvitePreviewRow(row: InvitePreviewRpcRow): InvitePreview | null {
  if (!row.invite_id || !row.workspace_id || !row.workspace_name) return null
  const role = row.invite_role as WorkspaceInviteRole
  const status = row.invite_status as WorkspaceInviteStatus
  return {
    inviteId: row.invite_id,
    invitedEmail: row.invited_email,
    role: role === "admin" || role === "viewer" ? role : "member",
    status,
    expiresAt: row.expires_at,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    workspaceSlug: row.workspace_slug ?? row.workspace_id,
    workspaceIcon: row.workspace_icon ?? "📂",
    inviterName: row.inviter_name?.trim() || "A teammate",
  }
}

export type InviteTerminalState = "invalid" | "expired" | "revoked" | "already_accepted"

export function getInviteTerminalState(
  preview: InvitePreview | null
): InviteTerminalState | null {
  if (!preview) return "invalid"
  if (preview.status === "expired") return "expired"
  if (preview.status === "revoked") return "revoked"
  if (preview.status === "accepted") return "already_accepted"
  if (preview.status !== "pending") return "invalid"
  const expires = Date.parse(preview.expiresAt)
  if (Number.isFinite(expires) && expires < Date.now()) return "expired"
  return null
}

export function formatInviteExpiry(expiresAt: string): string {
  const ms = Date.parse(expiresAt) - Date.now()
  if (!Number.isFinite(ms)) return "Expires soon"
  if (ms <= 0) return "Expired"
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000))
  if (days <= 1) return "Expires within 24 hours"
  return `Expires in ${days} days`
}

export type ParsedAcceptInviteError =
  | { kind: "wrong_email"; invitedEmail: string }
  | { kind: "expired" }
  | { kind: "revoked" }
  | { kind: "already_accepted" }
  | { kind: "invalid" }
  | { kind: "generic"; message: string }

export function parseAcceptInviteError(message: string): ParsedAcceptInviteError {
  const lower = message.toLowerCase()
  const signInMatch = message.match(/sign in with\s+(.+?)\s+to accept/i)
  if (signInMatch?.[1]) {
    return { kind: "wrong_email", invitedEmail: signInMatch[1].trim() }
  }
  if (lower.includes("already been accepted")) return { kind: "already_accepted" }
  if (lower.includes("revoked")) return { kind: "revoked" }
  if (lower.includes("expired")) return { kind: "expired" }
  if (lower.includes("no longer exists") || lower.includes("not found")) {
    return { kind: "invalid" }
  }
  return { kind: "generic", message }
}

export function workspaceDashboardPath(preview: Pick<InvitePreview, "workspaceSlug" | "workspaceId">): string {
  return `/dashboard/workspaces/${preview.workspaceSlug}`
}
