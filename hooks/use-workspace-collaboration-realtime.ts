"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { scheduleWorkspaceCollaborationRefetch } from "@/lib/syncdesk/workspace-collaboration-sync"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { subscribeToPostgresChanges } from "@/lib/supabase/realtime/create-channel"

/**
 * Live sync for workspace members, pending invites, activity feed, and boards store
 * while any client is viewing this workspace (modal open or workspace page).
 */
export function useWorkspaceCollaborationRealtime(workspaceId: string | null | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    const client = getOptionalSupabaseClient()
    if (!client || !workspaceId) return

    const onChange = () => {
      scheduleWorkspaceCollaborationRefetch(qc, workspaceId)
    }

    return subscribeToPostgresChanges(client, {
      topic: `workspace_collaboration:${workspaceId}`,
      bindings: [
        {
          event: "INSERT",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        {
          event: "UPDATE",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        {
          event: "DELETE",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        {
          event: "INSERT",
          schema: "public",
          table: "workspace_invites",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        {
          event: "UPDATE",
          schema: "public",
          table: "workspace_invites",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        {
          event: "DELETE",
          schema: "public",
          table: "workspace_invites",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        {
          event: "INSERT",
          schema: "public",
          table: "activity_events",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        {
          event: "UPDATE",
          schema: "public",
          table: "activity_events",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        {
          event: "DELETE",
          schema: "public",
          table: "activity_events",
          filter: `workspace_id=eq.${workspaceId}`,
        },
      ],
      onChange,
    })
  }, [qc, workspaceId])
}
