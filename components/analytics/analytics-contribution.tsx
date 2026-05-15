"use client"

import { Crown, MinusCircle, TrendingUp, Users } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AnalyticsSummary } from "@/lib/analytics/metrics"
import { cn } from "@/lib/utils"

export function AnalyticsContribution({ summary }: { summary: AnalyticsSummary }) {
  const ranked = summary.workloadByMember
  const total = Math.max(1, ranked.reduce((acc, r) => acc + r.assigned, 0))

  return (
    <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
      <CardHeader className="border-b border-border/60 px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold tracking-tight">
              Contribution comparison
            </CardTitle>
            <CardDescription>
              Workload and completion ratio per teammate within scope.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-5 py-4">
        {ranked.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No contributions in this scope.
          </p>
        ) : (
          ranked.map((row, i) => {
            const width = Math.max(2, Math.round((row.assigned / total) * 100))
            const completionPct =
              row.assigned === 0 ? 0 : Math.round((row.completed / row.assigned) * 100)
            return (
              <div
                key={row.member.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2 transition-colors hover:bg-muted/40"
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                    row.member.color
                  )}
                  aria-hidden
                >
                  {row.member.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {row.member.name}
                    </span>
                    {i === 0 && row.assigned > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                        <Crown className="size-3" aria-hidden /> Lead
                      </span>
                    ) : row.assigned === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <MinusCircle className="size-3" aria-hidden /> Inactive
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                        <TrendingUp className="size-3" aria-hidden /> {completionPct}% done
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                    <span>
                      {row.assigned} tasks · {row.completed} done
                    </span>
                    <span>{row.share}% share</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
