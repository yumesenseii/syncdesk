"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo } from "react"

import { BoardHeader } from "@/components/boards/board-header"
import { BoardKanban } from "@/components/boards/board-kanban"
import { DashboardChrome } from "@/components/dashboard-chrome"
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar"
import { useBoardsReady } from "@/hooks/use-boards-ready"
import { useDashboardAuth } from "@/hooks/use-dashboard-auth"
import { getWorkspaceByIdOrSlug, useBoardsStore } from "@/stores/boards-store"

export default function BoardDetailPage() {
  const params = useParams()
  const workspaceSlug = String(params.workspaceSlug ?? "")
  const boardId = String(params.boardId ?? "")

  const { user, userId, loading, loggingOut, welcomeName, fullName, onLogout } = useDashboardAuth()
  const { ready: boardsReady } = useBoardsReady()

  const boardsById = useBoardsStore((s) => s.boardsById)
  const workspaces = useBoardsStore((s) => s.workspaces)

  const board = boardsById[boardId]
  const workspace = useMemo(
    () => getWorkspaceByIdOrSlug(workspaces, workspaceSlug),
    [workspaces, workspaceSlug]
  )

  const invalid =
    !board ||
    !workspace ||
    board.workspaceId !== workspace.id ||
    !workspace.boardIds.includes(boardId)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
          Loading board…
        </div>
      </div>
    )
  }

  if (!user) return null

  const display = welcomeName ?? (user.email ? user.email.split("@")[0] : "Account")

  return (
    <DashboardChrome
      userName={fullName}
      userEmail={user.email ?? ""}
      onLogout={onLogout}
      header={
        <DashboardTopBar
          userId={userId}
          displayName={display}
          email={user.email ?? ""}
          onLogout={onLogout}
          loggingOut={loggingOut}
        />
      }
    >
      {invalid ? (
        <div className="rounded-2xl border border-border/60 bg-card px-6 py-16 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">Board not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This board may have been deleted or the link is incorrect.
          </p>
          <Link
            href="/dashboard/boards"
            className="mt-6 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to Boards
          </Link>
        </div>
      ) : !boardsReady ? (
        <div className="-mt-2 space-y-4 sm:-mt-4 lg:-mt-6" aria-busy="true" aria-label="Loading board">
          <div className="h-14 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[28rem] w-72 shrink-0 animate-pulse rounded-2xl border border-border/60 bg-muted/30"
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="-mt-2 space-y-4 sm:-mt-4 lg:-mt-6">
          <BoardHeader board={board} workspace={workspace} />
          <BoardKanban boardId={board.id} boardTitle={board.name} />
        </div>
      )}
    </DashboardChrome>
  )
}
