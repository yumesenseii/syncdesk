"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { toast } from "sonner"

import { invalidateActivityFeed } from "@/lib/activity/activity-invalidation"
import {
  buildInviteAcceptUrl,
  callAcceptInvite,
  type AcceptInviteResult,
  dispatchInviteEmail,
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
import { pullRemoteBoardsState } from "@/lib/syncdesk/boards-remote-sync"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { useBoardsStore } from "@/stores/boards-store"
import { subscribeToPostgresChanges } from "@/lib/supabase/realtime/create-channel"

const invitesKey = (workspaceId: string) => ["workspace-invites", workspaceId] as const

export function useWorkspaceInvitesQuery(workspaceId: string | null | undefined) {
  return useQuery<WorkspaceInviteRow[]>({
    queryKey: invitesKey(workspaceId ?? "none"),
    enabled: Boolean(workspaceId && getOptionalSupabaseClient()),
    staleTime: 5_000,
    refetchOnMount: "always",
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

/**
 * Subscribe to realtime changes on workspace_invites for the given workspace so the
 * UI refreshes instantly when invites are sent / accepted / revoked from another tab.
 *
 * Uses a uniquified channel topic so multiple components in the same tree (e.g. the
 * workspace header AND the invite dialog) can subscribe at the same time without
 * tripping Supabase's "cannot add postgres_changes callbacks after subscribe()" guard.
 */
export function useWorkspaceInvitesRealtime(workspaceId: string | null | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    const client = getOptionalSupabaseClient()
    if (!client || !workspaceId) return
    return subscribeToPostgresChanges(client, {
      topic: `workspace_invites:${workspaceId}`,
      bindings: [
        {
          event: "*",
          schema: "public",
          table: "workspace_invites",
          filter: `workspace_id=eq.${workspaceId}`,
        },
      ],
      onChange: () => {
        void qc.invalidateQueries({ queryKey: invitesKey(workspaceId) })
      },
    })
  }, [qc, workspaceId])
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
  /** Invites saved in DB but Resend / Edge Function could not send email */
  emailFailures: { email: string; reason: string }[]
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
              const acceptUrl = buildInviteAcceptUrl(row.token)
              const result = await dispatchInviteEmail(client, {
                inviteId: row.id,
                workspaceId: row.workspace_id,
                workspaceName: input.workspaceName,
                inviterName: input.inviterName,
                inviterEmail: input.inviterEmail,
                recipientEmail: row.invited_email,
                role: row.role,
                acceptUrl,
                message: row.message,
                expiresAt: row.expires_at,
              })
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
        const acceptUrl = buildInviteAcceptUrl(row.token)
        const result = await dispatchInviteEmail(client, {
          inviteId: row.id,
          workspaceId: row.workspace_id,
          workspaceName: input.workspaceName,
          inviterName: input.inviterName,
          inviterEmail: input.inviterEmail,
          recipientEmail: row.invited_email,
          role: row.role,
          acceptUrl,
          message: row.message,
          expiresAt: row.expires_at,
        })
        if (result.ok) {
          emailDelivered += 1
        } else {
          emailFailures.push({ email: row.invited_email, reason: result.message })
        }
      }

      return { created, failed, emailDelivered, emailFailures }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: invitesKey(workspaceId) })
    },
    onSuccess: () => {
      invalidateActivityFeed()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

export function useRevokeWorkspaceInviteMutation(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation<WorkspaceInviteRow, Error, string>({
    mutationFn: async (inviteId) => {
      const client = getOptionalSupabaseClient()
      if (!client) throw new Error("Supabase is not configured.")
      const { data, error } = await revokeWorkspaceInvite(client, inviteId)
      if (error || !data) throw new Error(error?.message ?? "Failed to revoke invitation.")
      return data as WorkspaceInviteRow
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invitesKey(workspaceId) })
    },
    onError: (err) => toast.error(err.message),
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
      const acceptUrl = buildInviteAcceptUrl(row.token)
      const send = await dispatchInviteEmail(client, {
        inviteId: row.id,
        workspaceId: row.workspace_id,
        workspaceName: input.workspaceName,
        inviterName: input.inviterName,
        inviterEmail: input.inviterEmail,
        recipientEmail: row.invited_email,
        role: row.role,
        acceptUrl,
        message: row.message,
        expiresAt: row.expires_at,
      })
      if (!send.ok) {
        throw new Error(send.message)
      }
      return row
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invitesKey(workspaceId) })
      toast.success("Invitation email sent.")
    },
    onError: (err) => toast.error(err.message),
  })
}

export type { AcceptInviteResult } from "@/lib/syncdesk/workspace-invites-remote"

export function useAcceptInviteMutation() {
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
    onSuccess: async () => {
      invalidateActivityFeed()
      const client = getOptionalSupabaseClient()
      if (!client) return
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user) return
      const bundle = await pullRemoteBoardsState(client, user.id)
      if (bundle) {
        useBoardsStore.setState({
          workspaces: bundle.workspaces,
          boardsById: bundle.boardsById,
          tasksByBoardId: bundle.tasksByBoardId,
          teamMembers: bundle.teamMembers,
        })
      }
    },
  })
}
