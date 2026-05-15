"use client"

import Link from "next/link"
import { ChevronRight, HeartPulse } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AnalyticsSummary, WorkspaceHealth } from "@/lib/analytics/metrics"
import { cn } from "@/lib/utils"

function statusStyles(status: WorkspaceHealth["status"]) {
  switch (status) {
    case "Healthy":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/25"
    case "Active":
      return "bg-sky-500/10 text-sky-700 border-sky-500/25"
    case "At risk":
      return "bg-amber-500/10 text-amber-700 border-amber-500/25"
    case "Critical":
      return "bg-rose-500/10 text-rose-700 border-rose-500/25"
  }
}

export function AnalyticsWorkspaceHealth({ summary }: { summary: AnalyticsSummary }) {
  return (
    <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
      <CardHeader className="border-b border-border/60 px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
            <HeartPulse className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold tracking-tight">
              Workspace health
            </CardTitle>
            <CardDescription>Status, completion and risk across every workspace.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {summary.health.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No workspaces yet — create one from the Boards page.
          </p>
        ) : (
          <ul className="divide-y divide-border/60" role="list">
            {summary.health.map((row) => {
              const firstBoard = row.workspace.boardIds[0]
              const href = firstBoard
                ? `/dashboard/boards/${row.workspace.slug}/${firstBoard}`
                : "/dashboard/boards"
              return (
                <li key={row.workspace.id}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/70 text-base">
                      {row.workspace.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {row.workspace.name}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            statusStyles(row.status)
                          )}
                        >
                          {row.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground tabular-nums">
                        <span>
                          <span className="font-medium text-foreground">{row.completed}</span> /{" "}
                          {row.total} done
                        </span>
                        <span>
                          <span className="font-medium text-foreground">{row.completionPct}%</span>{" "}
                          completion
                        </span>
                        <span className={cn(row.overdue > 0 && "text-rose-600")}>
                          <span className="font-medium">{row.overdue}</span> overdue
                        </span>
                      </div>
                    </div>
                    <div className="hidden w-40 shrink-0 sm:block">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500"
                          style={{ width: `${row.completionPct}%` }}
                        />
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
