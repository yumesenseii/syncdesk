"use client"

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
