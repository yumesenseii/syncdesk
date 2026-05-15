"use client"

import { useEffect, useState } from "react"

import { useBoardsStore } from "@/stores/boards-store"

/** True after persisted boards state has rehydrated from localStorage. */
export function useBoardsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    const finish = useBoardsStore.persist.onFinishHydration(() => setHydrated(true))
    setHydrated(useBoardsStore.persist.hasHydrated())
    return finish
  }, [])
  return hydrated
}

/** True after the first remote pull attempt finished (success or local-only). */
export function useBoardsRemoteReady(): boolean {
  return useBoardsStore((s) => s.remoteReady)
}

export function useBoardsReady(): { hydrated: boolean; remoteReady: boolean; ready: boolean } {
  const hydrated = useBoardsHydrated()
  const remoteReady = useBoardsRemoteReady()
  return { hydrated, remoteReady, ready: hydrated && remoteReady }
}
