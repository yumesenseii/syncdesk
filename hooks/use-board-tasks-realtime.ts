"use client"

import { useEffect } from "react"

import { getOptionalSupabaseClient } from "@/lib/supabase"
import { subscribeToPostgresChanges } from "@/lib/supabase/realtime/create-channel"
import { useBoardsStore } from "@/stores/boards-store"

/**
 * Sync task comment counts on the kanban when board_tasks.comments_count updates.
 */
export function useBoardTasksRealtime(boardId: string | null | undefined) {
  useEffect(() => {
    const client = getOptionalSupabaseClient()
    if (!client || !boardId) return

    return subscribeToPostgresChanges(client, {
      topic: `board_tasks:${boardId}`,
      bindings: [
        {
          event: "UPDATE",
          schema: "public",
          table: "board_tasks",
          filter: `board_id=eq.${boardId}`,
        },
      ],
      onChange: (payload) => {
        const row = payload.new as { id?: string; comments_count?: number } | undefined
        if (!row?.id || typeof row.comments_count !== "number") return
        useBoardsStore.getState().patchTaskLocal(boardId, row.id, {
          comments: row.comments_count,
        })
      },
    })
  }, [boardId])
}
