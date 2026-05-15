"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { WorkspaceActivity } from "@/components/workspaces/workspace-activity"
import { WorkspaceBoards } from "@/components/workspaces/workspace-boards"
import { WorkspaceContribution } from "@/components/workspaces/workspace-contribution"
import { WorkspaceHeader } from "@/components/workspaces/workspace-header"
import { WorkspaceInviteDialog } from "@/components/workspaces/workspace-invite-dialog"
import { WorkspaceProductivity } from "@/components/workspaces/workspace-productivity"
import { computeWorkspaceMetrics } from "@/lib/workspaces/workspace-metrics"
import { getWorkspaceByIdOrSlug, useBoardsStore } from "@/stores/boards-store"

export function WorkspaceOverview({ workspaceId }: { workspaceId: string }) {
  const workspaces = useBoardsStore((s) => s.workspaces)
  const boardsById = useBoardsStore((s) => s.boardsById)
  const tasksByBoardId = useBoardsStore((s) => s.tasksByBoardId)
  const teamMembers = useBoardsStore((s) => s.teamMembers)

  const workspace = useMemo(
    () => getWorkspaceByIdOrSlug(workspaces, workspaceId),
    [workspaces, workspaceId]
  )
  const setActiveWorkspaceId = useBoardsStore((s) => s.setActiveWorkspaceId)

  useEffect(() => {
    if (workspace) setActiveWorkspaceId(workspace.id)
  }, [workspace, setActiveWorkspaceId])

  const metrics = useMemo(() => {
    if (!workspace) return null
    return computeWorkspaceMetrics({ workspace, boardsById, tasksByBoardId, teamMembers })
  }, [workspace, boardsById, tasksByBoardId, teamMembers])

  const [inviteOpen, setInviteOpen] = useState(false)

  if (!workspace || !metrics) {
    return <WorkspaceNotFound />
  }

  return (
    <div className="space-y-6">
      <WorkspaceHeader metrics={metrics} onInvite={() => setInviteOpen(true)} />

      <section
        aria-labelledby="ws-intelligence"
        className="space-y-3"
      >
        <header className="flex items-end justify-between gap-3">
          <div>
            <h2 id="ws-intelligence" className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Workspace intelligence
            </h2>
            <p className="text-xs text-muted-foreground">
              Contribution insights, balance and team participation across this workspace.
            </p>
          </div>
        </header>
        <WorkspaceContribution metrics={metrics} />
      </section>

      <section aria-labelledby="ws-analytics" className="space-y-3">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h2 id="ws-analytics" className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Productivity analytics
            </h2>
            <p className="text-xs text-muted-foreground">
              Velocity, workload distribution, and activity patterns derived from this workspace’s tasks.
            </p>
          </div>
        </header>
        <WorkspaceProductivity metrics={metrics} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="ws-boards" className="space-y-3 lg:col-span-2">
          <header className="flex items-end justify-between gap-3">
            <div>
              <h2 id="ws-boards" className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Boards
              </h2>
              <p className="text-xs text-muted-foreground">
                Drill down into a board to manage tasks.
              </p>
            </div>
          </header>
          <WorkspaceBoards metrics={metrics} />
        </section>

        <section aria-labelledby="ws-activity" className="space-y-3">
          <header className="flex items-end justify-between gap-3">
            <div>
              <h2 id="ws-activity" className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Activity
              </h2>
              <p className="text-xs text-muted-foreground">Live workspace collaboration feed.</p>
            </div>
          </header>
          <WorkspaceActivity workspace={workspace} />
        </section>
      </div>

      <WorkspaceInviteDialog
        workspace={workspace}
        teamMembers={teamMembers}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </div>
  )
}

function WorkspaceNotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
      <p className="text-base font-semibold text-foreground">Workspace not found</p>
      <p className="max-w-md text-sm text-muted-foreground">
        This workspace may have been deleted, or it hasn’t finished syncing yet. Try going back to
        the boards list.
      </p>
      <Button asChild size="sm" className="mt-1 gap-2">
        <Link href="/dashboard/boards">
          <ArrowLeft className="size-4" aria-hidden />
          Back to boards
        </Link>
      </Button>
    </div>
  )
}
