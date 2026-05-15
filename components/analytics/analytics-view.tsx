"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { useMemo } from "react"
import { LineChart, Sparkles } from "lucide-react"

import { AnalyticsAiInsights } from "@/components/analytics/analytics-ai-insights"
import { AnalyticsCharts } from "@/components/analytics/analytics-charts"
import { AnalyticsContribution } from "@/components/analytics/analytics-contribution"
import { AnalyticsHeatmap } from "@/components/analytics/analytics-heatmap"
import { AnalyticsKpiGrid } from "@/components/analytics/analytics-kpi-grid"
import { AnalyticsVelocity } from "@/components/analytics/analytics-velocity"
import { AnalyticsWorkspaceHealth } from "@/components/analytics/analytics-workspace-health"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { computeAnalyticsSummary, type Range } from "@/lib/analytics/metrics"
import { useBoardsStore } from "@/stores/boards-store"

export function AnalyticsView({
  workspaceId,
  range,
}: {
  workspaceId: string | "all"
  range: Range
}) {
  const workspaces = useBoardsStore((s) => s.workspaces)
  const boardsById = useBoardsStore((s) => s.boardsById)
  const tasksByBoardId = useBoardsStore((s) => s.tasksByBoardId)
  const teamMembers = useBoardsStore((s) => s.teamMembers)

  const summary = useMemo(
    () =>
      computeAnalyticsSummary(
        { workspaces, boardsById, tasksByBoardId, teamMembers, workspaceId },
        range
      ),
    [boardsById, range, tasksByBoardId, teamMembers, workspaceId, workspaces]
  )

  const hasWorkspace = workspaces.length > 0
  const hasTasks = summary.totalTasks > 0

  return (
    <div className="space-y-8">
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="space-y-1"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {summary.workspaceTitle}
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Strategic workspace intelligence
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          KPIs, trends, and contribution analytics computed live from your boards. Switch range or
          workspace in the toolbar to drill down.
        </p>
      </motion.header>

      {!hasWorkspace ? (
        <Card className="flex flex-col items-center gap-3 border-border/60 bg-card px-6 py-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LineChart className="size-5" aria-hidden />
          </div>
          <p className="text-base font-semibold text-foreground">No analytics available yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Analytics derives every KPI from your real tasks. Create a workspace and a board to
            start populating charts here.
          </p>
          <Button asChild>
            <Link href="/dashboard/boards">Create your first workspace</Link>
          </Button>
        </Card>
      ) : !hasTasks ? (
        <Card className="flex flex-col items-center gap-3 border-border/60 bg-card px-6 py-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <p className="text-base font-semibold text-foreground">
            No tasks in the selected scope
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Add a task to any board in this workspace and analytics will start computing from
            real lifecycle events.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/boards">Open Boards</Link>
          </Button>
        </Card>
      ) : (
        <>
          <AnalyticsKpiGrid summary={summary} />

          <AnalyticsCharts summary={summary} />

          <div className="grid items-start gap-6 xl:grid-cols-12 xl:gap-8">
            <div className="space-y-6 xl:col-span-8">
              <AnalyticsContribution summary={summary} />
              <AnalyticsWorkspaceHealth summary={summary} />
              <AnalyticsHeatmap summary={summary} />
            </div>
            <div className="space-y-6 xl:col-span-4">
              <AnalyticsAiInsights summary={summary} />
              <AnalyticsVelocity summary={summary} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
