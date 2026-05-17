"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { invalidateActivityFeed } from "@/lib/activity/activity-invalidation"
import { isEmailJsConfigured, sendWorkspaceInviteEmail } from "@/lib/email"
import {
  refetchWorkspaceCollaboration,
  syncBoardsStoreFromRemote,
} from "@/lib/syncdesk/workspace-collaboration-sync"
import { workspaceInvitesKey } from "@/lib/syncdesk/workspace-collaboration-keys"
import {
  buildInviteAcceptUrl,
  callAcceptInvite,
  type AcceptInviteResult,
  fetchWorkspaceInvites,
  generateInviteToken,
  insertWorkspaceInvite,
  isPendingInviteDuplicateError,
  resendWorkspaceInvite,
  revokePendingWorkspaceInviteByEmail,
  revokeWorkspaceInvite,
  type WorkspaceInviteRole,
  type WorkspaceInviteRow,
} from "@/lib/syncdesk/workspace-invites-remote"
import { useWorkspaceCollaborationRealtime } from "@/hooks/use-workspace-collaboration-realtime"
import { verifyWorkspaceMembership } from "@/lib/syncdesk/workspace-members-remote"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { useBoardsStore } from "@/stores/boards-store"

export { workspaceInvitesKey } from "@/lib/syncdesk/workspace-collaboration-keys"

export function useWorkspaceInvitesQuery(
  workspaceId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<WorkspaceInviteRow[]>({
    queryKey: workspaceInvitesKey(workspaceId ?? "none"),
    enabled: Boolean(workspaceId && getOptionalSupabaseClient() && options?.enabled !== false),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: "always",
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const client = getOptionalSupabaseClient()
      if (!client || !workspaceId) return []
      const {
        data: { user },
      } = await client.auth.getUser()
      const { data, error } = await fetchWorkspaceInvites(
        client,
        workspaceId,
        user?.id ?? null
      )
      if (error) throw new Error(error.message)
      return (data as WorkspaceInviteRow[] | null) ?? []
    },
  })
}

function mergeInvites(
  current: WorkspaceInviteRow[] | undefined,
  incoming: WorkspaceInviteRow[]
): WorkspaceInviteRow[] {
  const map = new Map<string, WorkspaceInviteRow>()
  for (const row of current ?? []) {
    map.set(row.id, row)
  }
  for (const row of incoming) {
    map.set(row.id, row)
  }
  return Array.from(map.values()).sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
  )
}

function upsertInvite(
  current: WorkspaceInviteRow[] | undefined,
  row: WorkspaceInviteRow
): WorkspaceInviteRow[] {
  return mergeInvites(current, [row])
}

export interface SendInvitesInput {
  workspaceId: string
  workspaceName: string
  workspaceSlug?: string
  invitedBy: string
  inviterName: string
  inviterEmail: string
  role: WorkspaceInviteRole
  message?: string | null
  emails: string[]
}

export interface SendInvitesResult {
  created: WorkspaceInviteRow[]
  failed: { email: string; reason: string }[]
  emailDelivered: number
  emailFailures: { email: string; reason: string }[]
}

async function deliverInviteEmail(
  workspaceName: string,
  row: WorkspaceInviteRow
): Promise<{ ok: true } | { ok: false; message: string }> {
  const inviteLink = buildInviteAcceptUrl(row.token)
  const result = await sendWorkspaceInviteEmail({
    recipientEmail: row.invited_email,
    workspaceName,
    inviteLink,
  })
  if (result.ok) return { ok: true }
  return { ok: false, message: result.message }
}

export function useSendWorkspaceInvitesMutation(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation<SendInvitesResult, Error, SendInvitesInput>({
    mutationFn: async (input) => {
      const client = getOptionalSupabaseClient()
      if (!client) {
        throw new Error(
          "Connect Supabase in .env.local to send invitations — local-only mode can’t deliver email."
        )
      }
      if (!isEmailJsConfigured()) {
        throw new Error(
          "EmailJS is not configured. Add NEXT_PUBLIC_EMAILJS_SERVICE_ID, NEXT_PUBLIC_EMAILJS_TEMPLATE_ID, and NEXT_PUBLIC_EMAILJS_PUBLIC_KEY."
        )
      }

      const { ensureWorkspaceOwnerMember } = await import(
        "@/lib/syncdesk/workspace-members-remote"
      )
      await ensureWorkspaceOwnerMember(client, input.workspaceId, input.invitedBy)

      const created: WorkspaceInviteRow[] = []
      const failed: { email: string; reason: string }[] = []
      const emailFailures: { email: string; reason: string }[] = []
      let emailDelivered = 0

      for (const rawEmail of input.emails) {
        const email = rawEmail.trim()
        if (!email) continue
        const token = generateInviteToken()
        const { data, error } = await insertWorkspaceInvite(client, {
          workspaceId: input.workspaceId,
          invitedBy: input.invitedBy,
          email,
          role: input.role,
          message: input.message ?? null,
          token,
        })
        if (error || !data) {
          const msg = error?.message ?? ""
          const duplicate = isPendingInviteDuplicateError(error)

          if (duplicate) {
            await client.rpc("expire_stale_workspace_invites", {
              p_workspace_id: input.workspaceId,
            })
            await revokePendingWorkspaceInviteByEmail(client, input.workspaceId, email)
            const retry = await insertWorkspaceInvite(client, {
              workspaceId: input.workspaceId,
              invitedBy: input.invitedBy,
              email,
              role: input.role,
              message: input.message ?? null,
              token: generateInviteToken(),
            })
            if (!retry.error && retry.data) {
              const row = retry.data as WorkspaceInviteRow
              created.push(row)
              const result = await deliverInviteEmail(input.workspaceName, row)
              if (result.ok) emailDelivered += 1
              else emailFailures.push({ email: row.invited_email, reason: result.message })
              continue
            }
          }

          failed.push({
            email,
            reason: duplicate
              ? "A pending invitation already exists for this email in this workspace."
              : msg || "Failed to create invitation.",
          })
          continue
        }
        const row = data as WorkspaceInviteRow
        created.push(row)
        const result = await deliverInviteEmail(input.workspaceName, row)
        if (result.ok) {
          emailDelivered += 1
        } else {
          emailFailures.push({ email: row.invited_email, reason: result.message })
        }
      }

      return { created, failed, emailDelivered, emailFailures }
    },
    onSuccess: (result) => {
      if (result.created.length > 0) {
        qc.setQueryData<WorkspaceInviteRow[]>(workspaceInvitesKey(workspaceId), (prev) =>
          mergeInvites(prev, result.created)
        )
      }
      void refetchWorkspaceCollaboration(qc, workspaceId, { activity: true })
      invalidateActivityFeed()
    },
    onSettled: () => {
      void refetchWorkspaceCollaboration(qc, workspaceId)
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

type RevokeInviteContext = { previous: WorkspaceInviteRow[] | undefined }

export function useRevokeWorkspaceInviteMutation(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation<WorkspaceInviteRow, Error, string, RevokeInviteContext>({
    mutationFn: async (inviteId) => {
      const client = getOptionalSupabaseClient()
      if (!client) throw new Error("Supabase is not configured.")
      const { data, error } = await revokeWorkspaceInvite(client, inviteId)
      if (error || !data) throw new Error(error?.message ?? "Failed to revoke invitation.")
      return data as WorkspaceInviteRow
    },
    onMutate: async (inviteId) => {
      await qc.cancelQueries({ queryKey: workspaceInvitesKey(workspaceId) })
      const previous = qc.getQueryData<WorkspaceInviteRow[]>(workspaceInvitesKey(workspaceId))
      qc.setQueryData<WorkspaceInviteRow[]>(workspaceInvitesKey(workspaceId), (prev) =>
        (prev ?? []).map((row) =>
          row.id === inviteId ? { ...row, status: "revoked" as const } : row
        )
      )
      return { previous }
    },
    onError: (err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(workspaceInvitesKey(workspaceId), context.previous)
      }
      toast.error(err.message)
    },
    onSuccess: (row) => {
      qc.setQueryData<WorkspaceInviteRow[]>(workspaceInvitesKey(workspaceId), (prev) =>
        upsertInvite(prev, row)
      )
      void refetchWorkspaceCollaboration(qc, workspaceId, { activity: true })
    },
    onSettled: () => {
      void refetchWorkspaceCollaboration(qc, workspaceId)
    },
  })
}

export interface ResendWorkspaceInviteInput {
  inviteId: string
  workspaceName: string
  inviterName: string
  inviterEmail: string
}

export function useResendWorkspaceInviteMutation(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation<WorkspaceInviteRow, Error, ResendWorkspaceInviteInput>({
    mutationFn: async (input) => {
      const client = getOptionalSupabaseClient()
      if (!client) throw new Error("Supabase is not configured.")
      const { data, error } = await resendWorkspaceInvite(client, input.inviteId)
      if (error || !data) throw new Error(error?.message ?? "Failed to resend invitation.")
      const row = data as WorkspaceInviteRow
      const send = await deliverInviteEmail(input.workspaceName, row)
      if (!send.ok) {
        throw new Error(send.message)
      }
      return row
    },
    onSuccess: (row) => {
      qc.setQueryData<WorkspaceInviteRow[]>(workspaceInvitesKey(workspaceId), (prev) =>
        upsertInvite(prev, row)
      )
      void refetchWorkspaceCollaboration(qc, workspaceId)
      toast.success("Invitation email sent.")
    },
    onError: (err) => toast.error(err.message),
  })
}

export type { AcceptInviteResult } from "@/lib/syncdesk/workspace-invites-remote"

export function useAcceptInviteMutation() {
  const qc = useQueryClient()
  return useMutation<AcceptInviteResult, Error, string>({
    mutationFn: async (token) => {
      const client = getOptionalSupabaseClient()
      if (!client) {
        throw new Error("Connect Supabase to accept this invitation.")
      }
      const { data, error } = await callAcceptInvite(client, token)
      if (error) throw new Error(error.message)
      if (!data) throw new Error("Invitation could not be accepted.")
      return data
    },
    onSuccess: async (result) => {
      invalidateActivityFeed()
      useBoardsStore.getState().setActiveWorkspaceId(result.workspace_id)

      const client = getOptionalSupabaseClient()
      if (client) {
        const {
          data: { user },
        } = await client.auth.getUser()
        if (user) {
          const verified = await verifyWorkspaceMembership(
            client,
            result.workspace_id,
            user.id
          )
          if (!verified) {
            toast.error(
              "Invitation accepted, but workspace membership could not be confirmed. Syncing again…"
            )
            console.error(
              "[syncdesk] accept invite: workspace_members row missing for",
              user.id,
              "in",
              result.workspace_id
            )
          }
        }
      }

      await refetchWorkspaceCollaboration(qc, result.workspace_id, { activity: true })
      await syncBoardsStoreFromRemote(result.workspace_id)
    },
  })
}

/** @deprecated Prefer `useWorkspaceCollaborationRealtime` — kept for existing call sites. */
export function useWorkspaceInvitesRealtime(workspaceId: string | null | undefined) {
  useWorkspaceCollaborationRealtime(workspaceId)
}
