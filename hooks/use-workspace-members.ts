"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import type { TeamMember } from "@/lib/boards/types"
import { workspaceMembersKey } from "@/lib/syncdesk/workspace-collaboration-keys"
import { fetchWorkspaceMembersDetail } from "@/lib/syncdesk/workspace-members-remote"
import { useWorkspaceCollaborationRealtime } from "@/hooks/use-workspace-collaboration-realtime"
import { getOptionalSupabaseClient } from "@/lib/supabase"

export { workspaceMembersKey } from "@/lib/syncdesk/workspace-collaboration-keys"

/** Recent join window for the highlight section (24 hours). */
export const RECENTLY_JOINED_MS = 24 * 60 * 60 * 1000

export function isRecentlyJoined(member: Pick<TeamMember, "joinedAt">, now = Date.now()): boolean {
  if (!member.joinedAt) return false
  const joined = Date.parse(member.joinedAt)
  return Number.isFinite(joined) && now - joined < RECENTLY_JOINED_MS
}

export function useWorkspaceMembersQuery(
  workspaceId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<TeamMember[]>({
    queryKey: workspaceMembersKey(workspaceId ?? "none"),
    enabled: Boolean(workspaceId && getOptionalSupabaseClient() && options?.enabled !== false),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: "always",
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const client = getOptionalSupabaseClient()
      if (!client || !workspaceId) return []
      return fetchWorkspaceMembersDetail(client, workspaceId)
    },
  })
}

/** @deprecated Prefer `useWorkspaceCollaborationRealtime` — kept for existing call sites. */
export function useWorkspaceMembersRealtime(workspaceId: string | null | undefined) {
  useWorkspaceCollaborationRealtime(workspaceId)
}

function dedupeMembers(list: TeamMember[]): TeamMember[] {
  const seen = new Set<string>()
  return list.filter((m) => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}

/**
 * Workspace roster from `workspace_members` with realtime sync.
 * Shared by invite modal, board members dialog, and task assignee picker.
 */
export function useWorkspaceMembersList(workspaceId: string | null | undefined) {
  useWorkspaceCollaborationRealtime(workspaceId)
  const query = useWorkspaceMembersQuery(workspaceId)

  const members = useMemo(() => dedupeMembers(query.data ?? []), [query.data])

  return {
    members,
    isLoading: query.isPending && members.length === 0,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
