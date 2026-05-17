"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import {
  notificationsKey,
  notificationsUnreadKey,
} from "@/lib/syncdesk/notifications-keys"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { subscribeToPostgresChanges } from "@/lib/supabase/realtime/create-channel"

/**
 * Live notification inbox: refetch on INSERT/UPDATE for the signed-in user.
 */
export function useNotificationsRealtime(userId: string | null | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    const client = getOptionalSupabaseClient()
    if (!client || !userId) return

    const refetch = () => {
      void qc.invalidateQueries({ queryKey: notificationsKey(userId) })
      void qc.invalidateQueries({ queryKey: notificationsUnreadKey(userId) })
    }

    return subscribeToPostgresChanges(client, {
      topic: `notifications:${userId}`,
      bindings: [
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
      ],
      onChange: refetch,
    })
  }, [qc, userId])
}
