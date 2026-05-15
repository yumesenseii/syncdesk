"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowUpRight, CalendarDays, Flag, Plus, Users2 } from "lucide-react"
import { useMemo, useState } from "react"

import { CreateBoardDialog } from "@/components/boards/create-board-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useActiveDashboardWorkspace } from "@/hooks/use-active-dashboard-workspace"
import { cn } from "@/lib/utils"
import { useBoardsStore } from "@/stores/boards-store"

export function DashboardWelcome({
  name,
  greeting,
}: {
  name: string
  greeting?: string
}) {
  const tasksByBoardId = useBoardsStore((s) => s.tasksByBoardId)
  const teamMembers = useBoardsStore((s) => s.teamMembers)
  const { activeWorkspace } = useActiveDashboardWorkspace()
  const [createBoardOpen, setCreateBoardOpen] = useState(false)

  const { totalTasks, completedTasks } = useMemo(() => {
    const all = Object.values(tasksByBoardId).flat()
    return {
      totalTasks: all.length,
      completedTasks: all.filter((t) => t.columnId === "completed").length,
    }
  }, [tasksByBoardId])

  const statusItems = useMemo(
    () =>
      [
        {
          icon: Flag,
          label: "Workspace",
          value: activeWorkspace ? activeWorkspace.name : "None selected",
          tint: "text-primary",
          bg: "bg-primary/10",
        },
        {
          icon: CalendarDays,
          label: "Progress",
          value:
            totalTasks === 0
              ? "No tasks yet"
              : `${completedTasks} / ${totalTasks} tasks completed`,
          tint: "text-sky-600",
          bg: "bg-sky-500/10",
        },
        {
          icon: Users2,
          label: "Team",
          value:
            teamMembers.length === 0
              ? "Just you so far"
              : `${teamMembers.length} member${teamMembers.length === 1 ? "" : "s"}`,
          tint: "text-emerald-600",
          bg: "bg-emerald-500/10",
        },
      ] as const,
    [activeWorkspace, completedTasks, teamMembers.length, totalTasks]
  )

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      aria-labelledby="dashboard-welcome-heading"
    >
      {activeWorkspace ? (
        <CreateBoardDialog
          open={createBoardOpen}
          onOpenChange={setCreateBoardOpen}
          workspaceId={activeWorkspace.id}
          workspaceName={activeWorkspace.name}
          workspaceSlug={activeWorkspace.slug}
        />
      ) : null}

      <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04] py-0 ring-1 ring-foreground/[0.04]">
        <div
          className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(80%_60%_at_20%_0%,oklch(from_var(--primary)_l_c_h/0.18)_0%,transparent_60%),radial-gradient(60%_50%_at_85%_0%,#38bdf833_0%,transparent_55%)]"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
          aria-hidden
        />

        <div className="relative flex flex-col gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
                Live workspace
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <h1
              id="dashboard-welcome-heading"
              className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              {greeting ?? "Welcome back"},{" "}
              <span className="bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-transparent">
                {name}
              </span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {activeWorkspace ? (
                <>
                  <span className="font-semibold text-foreground">{activeWorkspace.name}</span> has{" "}
                  <span className="font-semibold text-foreground">{activeWorkspace.boardIds.length}</span>{" "}
                  {activeWorkspace.boardIds.length === 1 ? "board" : "boards"} and{" "}
                  <span className="font-semibold text-foreground">{totalTasks} tasks</span> —{" "}
                  {completedTasks} marked done. Create boards here; add tasks inside each board.
                </>
              ) : (
                <>
                  Your workspace has{" "}
                  <span className="font-semibold text-foreground">{totalTasks} tasks</span> across
                  boards — {completedTasks} marked done.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-10 gap-1.5 border-border/70 bg-background/70 shadow-sm transition-colors duration-200 ease-out hover:bg-muted/60"
              asChild
            >
              <Link href="/dashboard/analytics">
                View report
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-10 gap-1.5 shadow-sm shadow-primary/20 transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-md"
              onClick={() => setCreateBoardOpen(true)}
              disabled={!activeWorkspace}
              title={
                activeWorkspace
                  ? `Create a board in ${activeWorkspace.name}`
                  : "Create a workspace first"
              }
            >
              <Plus className="size-4" aria-hidden />
              New board
            </Button>
          </div>
        </div>

        <div className="relative grid gap-px border-t border-border/60 bg-border/60 sm:grid-cols-3">
          {statusItems.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 bg-card/85 px-5 py-3.5 transition-colors duration-200 ease-out hover:bg-card sm:py-4"
              >
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    item.bg,
                    item.tint
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </div>
                  <div className="truncate text-sm font-medium text-foreground">{item.value}</div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </motion.section>
  )
}
