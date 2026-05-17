"use client"

import { useQuery } from "@tanstack/react-query"

import { mapInvitePreviewRow, type InvitePreview, type InvitePreviewRpcRow } from "@/lib/invite"
import { fetchWorkspaceInvitePreview } from "@/lib/syncdesk/workspace-invites-remote"
import { getOptionalSupabaseClient } from "@/lib/supabase"

export const invitePreviewKey = (token: string) => ["invite-preview", token] as const

export function useInvitePreviewQuery(token: string | null | undefined) {
  const trimmed = token?.trim() ?? ""
  return useQuery<InvitePreview | null>({
    queryKey: invitePreviewKey(trimmed || "none"),
    enabled: Boolean(trimmed && getOptionalSupabaseClient()),
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const client = getOptionalSupabaseClient()
      if (!client || !trimmed) return null
      const { data, error } = await fetchWorkspaceInvitePreview(client, trimmed)
      if (error) throw new Error(error.message)
      if (!data) return null
      return mapInvitePreviewRow(data as InvitePreviewRpcRow)
    },
  })
}
