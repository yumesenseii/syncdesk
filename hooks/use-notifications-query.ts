"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotificationRow,
} from "@/lib/syncdesk/notifications-remote"
import { getOptionalSupabaseClient } from "@/lib/supabase"

export function useNotificationsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: Boolean(userId && getOptionalSupabaseClient()),
    queryFn: async () => {
      const client = getOptionalSupabaseClient()
      if (!client || !userId) return []
      const { data, error } = await fetchNotifications(client, userId)
      if (error) throw error
      return (data ?? []) as AppNotificationRow[]
    },
    staleTime: 15_000,
    refetchInterval: 45_000,
  })
}

export function useMarkNotificationRead(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const client = getOptionalSupabaseClient()
      if (!client) throw new Error("Supabase is not configured.")
      const { error } = await markNotificationRead(client, id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications", userId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useMarkAllNotificationsRead(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const client = getOptionalSupabaseClient()
      if (!client || !userId) throw new Error("Supabase is not configured.")
      const { error } = await markAllNotificationsRead(client, userId)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications", userId] })
      toast.success("All caught up.")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
