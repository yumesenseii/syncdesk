"use client"

import { TrendingUp } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AnalyticsSummary } from "@/lib/analytics/metrics"

export function AnalyticsVelocity({ summary }: { summary: AnalyticsSummary }) {
  const hasData = summary.velocity.length > 0
  const totalCreated = summary.velocity.reduce((acc, v) => acc + v.created, 0)
  const totalCompleted = summary.velocity.reduce((acc, v) => acc + v.completed, 0)
  const ratio = totalCreated === 0 ? null : Math.round((totalCompleted / totalCreated) * 100)

  return (
    <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
      <CardHeader className="px-5 pb-2 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <TrendingUp className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight">
              Velocity tracking
            </CardTitle>
            <CardDescription>Pacing of created vs completed work in scope.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-2">
        {!hasData ? (
          <p className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-3 py-6 text-center text-xs text-muted-foreground">
            No velocity recorded yet. Create or complete tasks and the numbers will start
            populating from real timestamps.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/60 p-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Created
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {totalCreated}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Completed
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {totalCompleted}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Completion ratio
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {ratio === null ? "—" : `${ratio}%`}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
