"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query"
import { useMemo } from "react"
import { toast } from "sonner"

import type { AppNotification } from "@/lib/notifications/types"
import {
  fetchNotificationsPage,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/syncdesk/notifications-remote"
import {
  notificationsKey,
  notificationsUnreadKey,
} from "@/lib/syncdesk/notifications-keys"
import { getOptionalSupabaseClient } from "@/lib/supabase"

const PAGE_SIZE = 20

export function useNotificationsQuery(userId: string | undefined) {
  const query = useInfiniteQuery<
    AppNotification[],
    Error,
    InfiniteData<AppNotification[], string | undefined>,
    ReturnType<typeof notificationsKey>,
    string | undefined
  >({
    queryKey: notificationsKey(userId ?? "none"),
    enabled: Boolean(userId && getOptionalSupabaseClient()),
    initialPageParam: undefined,
    staleTime: 0,
    gcTime: 5 * 60_000,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return lastPage[lastPage.length - 1]?.createdAt
    },
    queryFn: async ({ pageParam }) => {
      const client = getOptionalSupabaseClient()
      if (!client || !userId) return []
      const { data, error } = await fetchNotificationsPage(client, userId, {
        limit: PAGE_SIZE,
        before: pageParam,
      })
      if (error) throw error
      return data
    },
  })

  const notifications = useMemo(
    () => query.data?.pages.flat() ?? [],
    [query.data?.pages]
  )

  return {
    ...query,
    notifications,
  }
}

export function useUnreadNotificationCount(userId: string | undefined) {
  return useQuery({
    queryKey: notificationsUnreadKey(userId ?? "none"),
    enabled: Boolean(userId && getOptionalSupabaseClient()),
    staleTime: 0,
    queryFn: async () => {
      const client = getOptionalSupabaseClient()
      if (!client || !userId) return 0
      const { count, error } = await fetchUnreadNotificationCount(client, userId)
      if (error) throw error
      return count
    },
  })
}

function patchNotificationRead(
  list: AppNotification[] | undefined,
  id: string
): AppNotification[] | undefined {
  if (!list) return list
  return list.map((n) => (n.id === id ? { ...n, isRead: true } : n))
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
    onMutate: async (id) => {
      const key = notificationsKey(userId ?? "none")
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<{ pages: AppNotification[][]; pageParams: unknown[] }>(key)
      qc.setQueryData(key, (old: { pages: AppNotification[][]; pageParams: unknown[] } | undefined) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => patchNotificationRead(page, id) ?? page),
        }
      })
      qc.setQueryData(notificationsUnreadKey(userId ?? "none"), (c: number | undefined) =>
        Math.max(0, (c ?? 0) - 1)
      )
      return { prev }
    },
    onError: (e: Error) => {
      toast.error(e.message)
      void qc.invalidateQueries({ queryKey: notificationsKey(userId ?? "none") })
      void qc.invalidateQueries({ queryKey: notificationsUnreadKey(userId ?? "none") })
    },
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
    onMutate: async () => {
      const key = notificationsKey(userId ?? "none")
      await qc.cancelQueries({ queryKey: key })
      qc.setQueryData(key, (old: { pages: AppNotification[][]; pageParams: unknown[] } | undefined) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => page.map((n) => ({ ...n, isRead: true }))),
        }
      })
      qc.setQueryData(notificationsUnreadKey(userId ?? "none"), 0)
    },
    onSuccess: () => {
      toast.success("All caught up.")
    },
    onError: (e: Error) => {
      toast.error(e.message)
      void qc.invalidateQueries({ queryKey: notificationsKey(userId ?? "none") })
      void qc.invalidateQueries({ queryKey: notificationsUnreadKey(userId ?? "none") })
    },
  })
}
