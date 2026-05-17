"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import type { TeamMember } from "@/lib/boards/types"
import { pullRemoteBoardsState } from "@/lib/syncdesk/boards-remote-sync"
import { fetchWorkspaceMembersDetail } from "@/lib/syncdesk/workspace-members-remote"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { subscribeToPostgresChanges } from "@/lib/supabase/realtime/create-channel"
import { useBoardsStore } from "@/stores/boards-store"

export const workspaceMembersKey = (workspaceId: string) =>
  ["workspace-members", workspaceId] as const

/** Recent join window for the highlight section (24 hours). */
export const RECENTLY_JOINED_MS = 24 * 60 * 60 * 1000

export function isRecentlyJoined(member: Pick<TeamMember, "joinedAt">, now = Date.now()): boolean {
  if (!member.joinedAt) return false
  const joined = Date.parse(member.joinedAt)
  return Number.isFinite(joined) && now - joined < RECENTLY_JOINED_MS
}

export function useWorkspaceMembersQuery(workspaceId: string | null | undefined) {
  return useQuery<TeamMember[]>({
    queryKey: workspaceMembersKey(workspaceId ?? "none"),
    enabled: Boolean(workspaceId && getOptionalSupabaseClient()),
    staleTime: 5_000,
    refetchOnMount: "always",
    queryFn: async () => {
      const client = getOptionalSupabaseClient()
      if (!client || !workspaceId) return []
      return fetchWorkspaceMembersDetail(client, workspaceId)
    },
  })
}

async function syncBoardsStoreFromRemote(workspaceId: string) {
  const client = getOptionalSupabaseClient()
  if (!client) return
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return
  const bundle = await pullRemoteBoardsState(client, user.id)
  if (!bundle) return
  useBoardsStore.setState({
    workspaces: bundle.workspaces,
    boardsById: bundle.boardsById,
    tasksByBoardId: bundle.tasksByBoardId,
    teamMembers: bundle.teamMembers,
  })
}

/**
 * Realtime: any membership change in this workspace refreshes member list + boards store.
 */
export function useWorkspaceMembersRealtime(workspaceId: string | null | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    const client = getOptionalSupabaseClient()
    if (!client || !workspaceId) return

    return subscribeToPostgresChanges(client, {
      topic: `workspace_members:${workspaceId}`,
      bindings: [
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
      ],
      onChange: () => {
        void qc.invalidateQueries({ queryKey: workspaceMembersKey(workspaceId) })
        void syncBoardsStoreFromRemote(workspaceId)
      },
    })
  }, [qc, workspaceId])
}
