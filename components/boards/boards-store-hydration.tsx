"use client"

import { useEffect, useRef } from "react"

import { useAuth } from "@/hooks/use-auth"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { setBoardsRemoteContextResolver } from "@/lib/syncdesk/boards-sync-context"
import {
  ensureBoardsSchemaReady,
  pullRemoteBoardsState,
  subscribeBoardsRealtime,
} from "@/lib/syncdesk/boards-remote-sync"
import { rehydrateBoardsStore, useBoardsStore } from "@/stores/boards-store"

export function BoardsStoreHydration() {
  const { user, loading } = useAuth()
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    void rehydrateBoardsStore()
  }, [])

  useEffect(() => {
    setBoardsRemoteContextResolver(() => ({
      client: getOptionalSupabaseClient(),
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
    }))
  }, [user])

  useEffect(() => {
    if (loading) return
    const client = getOptionalSupabaseClient()
    const userId = user?.id
    if (!client || !userId) {
      useBoardsStore.getState().setRemoteReady(true)
      unsubRef.current?.()
      unsubRef.current = null
      return
    }

    let cancelled = false

    const pull = async (): Promise<boolean> => {
      const bundle = await pullRemoteBoardsState(client, userId)
      if (cancelled) return false
      if (!bundle) return false
      useBoardsStore.setState({
        workspaces: bundle.workspaces,
        boardsById: bundle.boardsById,
        tasksByBoardId: bundle.tasksByBoardId,
        teamMembers: bundle.teamMembers,
      })
      return true
    }

    const run = async () => {
      useBoardsStore.getState().setRemoteReady(false)
      const ready = await ensureBoardsSchemaReady(client, userId)
      if (cancelled) return
      if (!ready) {
        useBoardsStore.getState().setRemoteReady(true)
        return
      }
      await pull()
      if (cancelled) return
      useBoardsStore.getState().setRemoteReady(true)

      unsubRef.current?.()
      unsubRef.current = subscribeBoardsRealtime(client, userId, () => {
        void pull()
      })
    }

    void run()

    return () => {
      cancelled = true
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [loading, user?.id])

  return null
}
