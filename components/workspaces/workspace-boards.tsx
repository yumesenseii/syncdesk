"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { AlertTriangle, ArrowUpRight, CheckCircle2, KanbanSquare, Plus } from "lucide-react"
import { useState } from "react"

import { CreateBoardDialog } from "@/components/boards/create-board-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  healthAccent,
  type BoardSummary,
  type WorkspaceMetrics,
} from "@/lib/workspaces/workspace-metrics"

export function WorkspaceBoards({ metrics }: { metrics: WorkspaceMetrics }) {
  const { workspace, boards } = metrics
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-5 sm:items-center">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <KanbanSquare className="size-4 text-primary" aria-hidden />
            Boards in this workspace
          </CardTitle>
          <CardDescription>
            Open a board to manage tasks — analytics here update in real time.
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" aria-hidden />
          New board
        </Button>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {boards.length === 0 ? (
          <EmptyBoards onCreate={() => setCreateOpen(true)} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {boards.map((b, i) => (
              <BoardTile key={b.board.id} summary={b} index={i} workspaceSlug={workspace.slug} />
            ))}
          </div>
        )}
      </CardContent>

      <CreateBoardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        workspaceSlug={workspace.slug}
      />
    </Card>
  )
}

function BoardTile({
  summary,
  index,
  workspaceSlug,
}: {
  summary: BoardSummary
  index: number
  workspaceSlug: string
}) {
  const { board, total, completed, overdue, completionPct, members, health } = summary
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.03 }}
    >
      <Link
        href={`/dashboard/boards/${workspaceSlug}/${board.id}`}
        className="group flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
              {board.name}
              <ArrowUpRight
                className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </h3>
            {board.description ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{board.description}</p>
            ) : null}
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              healthAccent(health)
            )}
          >
            {health}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
            <span className="font-medium text-foreground">{completed}</span>/<span>{total}</span>
          </span>
          {overdue > 0 ? (
            <span className="inline-flex items-center gap-1 text-rose-600">
              <AlertTriangle className="size-3.5" aria-hidden />
              <span className="font-medium">{overdue}</span> overdue
            </span>
          ) : (
            <span className="text-emerald-700">On track</span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Completion</span>
            <span className="font-medium tabular-nums text-foreground">{completionPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionPct}%` }}
              transition={{ duration: 0.45, delay: index * 0.04 }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-sky-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {members.slice(0, 4).map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-card",
                  m.color
                )}
                title={m.name}
              >
                {m.initials}
              </div>
            ))}
            {members.length > 4 ? (
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                +{members.length - 4}
              </span>
            ) : null}
            {members.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">No assignees</span>
            ) : null}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            {total} {total === 1 ? "task" : "tasks"}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

function EmptyBoards({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 py-10 text-center">
      <KanbanSquare className="size-8 text-muted-foreground" aria-hidden />
      <div>
        <p className="text-sm font-medium text-foreground">No boards yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create your first Kanban board to start tracking tasks here.
        </p>
      </div>
      <Button type="button" size="sm" onClick={onCreate} className="gap-2">
        <Plus className="size-4" aria-hidden />
        New board
      </Button>
    </div>
  )
}
