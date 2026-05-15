"use client"

import { useEffect, useMemo } from "react"

import { useBoardsStore } from "@/stores/boards-store"

/** Keeps the dashboard top bar and welcome CTA aligned on one workspace. */
export function useActiveDashboardWorkspace() {
  const workspaces = useBoardsStore((s) => s.workspaces)
  const activeWorkspaceId = useBoardsStore((s) => s.activeWorkspaceId)
  const setActiveWorkspaceId = useBoardsStore((s) => s.setActiveWorkspaceId)

  useEffect(() => {
    if (workspaces.length === 0) {
      if (activeWorkspaceId !== null) {
        setActiveWorkspaceId(null)
      }
      return
    }
    const firstId = workspaces[0]?.id
    if (!firstId) return
    if (!activeWorkspaceId || !workspaces.some((w) => w.id === activeWorkspaceId)) {
      setActiveWorkspaceId(firstId)
    }
  }, [workspaces, activeWorkspaceId, setActiveWorkspaceId])

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null,
    [workspaces, activeWorkspaceId]
  )

  return { activeWorkspace, setActiveWorkspaceId, workspaces }
}
