"use client"

import type { QueryClient } from "@tanstack/react-query"

import { invalidateActivityFeed } from "@/lib/activity/activity-invalidation"
import { workspaceInvitesKey, workspaceMembersKey } from "@/lib/syncdesk/workspace-collaboration-keys"
import { pullRemoteBoardsState } from "@/lib/syncdesk/boards-remote-sync"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { useBoardsStore } from "@/stores/boards-store"

export async function syncBoardsStoreFromRemote(_workspaceId?: string) {
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

export type RefetchWorkspaceCollaborationOptions = {
  /** Refresh workspaces sidebar / switcher / memberIds (default true). */
  syncBoards?: boolean
  /** Invalidate activity feed queries (default true). */
  activity?: boolean
}

/**
 * Refetch invite + member queries and optionally sync global boards state.
 * Used by realtime handlers and mutations so open modals update without a reload.
 */
export async function refetchWorkspaceCollaboration(
  qc: QueryClient,
  workspaceId: string,
  options: RefetchWorkspaceCollaborationOptions = {}
) {
  const { syncBoards = true, activity = true } = options

  await Promise.all([
    qc.refetchQueries({ queryKey: workspaceMembersKey(workspaceId), type: "active" }),
    qc.refetchQueries({ queryKey: workspaceInvitesKey(workspaceId), type: "active" }),
  ])

  if (syncBoards) {
    await syncBoardsStoreFromRemote(workspaceId)
  }

  if (activity) {
    invalidateActivityFeed()
  }
}

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** Debounce rapid postgres_changes bursts (e.g. accept = member insert + invite update). */
export function scheduleWorkspaceCollaborationRefetch(
  qc: QueryClient,
  workspaceId: string,
  options?: RefetchWorkspaceCollaborationOptions,
  delayMs = 200
) {
  const key = workspaceId
  const existing = debounceTimers.get(key)
  if (existing) clearTimeout(existing)
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key)
      void refetchWorkspaceCollaboration(qc, workspaceId, options)
    }, delayMs)
  )
}
