"use client"

import { Activity } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WEEKDAYS, type AnalyticsSummary } from "@/lib/analytics/metrics"
import { cn } from "@/lib/utils"

function intensityClass(value: number) {
  if (value === 0) return "bg-muted/60"
  if (value <= 2) return "bg-primary/20"
  if (value <= 4) return "bg-primary/40"
  if (value <= 6) return "bg-primary/60"
  if (value <= 8) return "bg-primary/80"
  return "bg-primary"
}

export function AnalyticsHeatmap({ summary }: { summary: AnalyticsSummary }) {
  return (
    <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
      <CardHeader className="px-5 pb-2 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
            <Activity className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight">
              Productivity heatmap
            </CardTitle>
            <CardDescription>Activity by weekday across recent weeks.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-2">
        {summary.heatmap.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No productivity data yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The grid fills in as tasks are created and completed across your workspaces.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `auto repeat(${WEEKDAYS.length}, minmax(0, 1fr))` }}
              >
                <div aria-hidden />
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
                {summary.heatmap.map((row) => (
                  <FragmentRow key={row.week} week={row.week} values={row.values} />
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>Less</span>
              {[0, 2, 4, 6, 8, 10].map((v) => (
                <span
                  key={v}
                  className={cn("inline-block size-3 rounded-sm", intensityClass(v))}
                  aria-hidden
                />
              ))}
              <span>More</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function FragmentRow({ week, values }: { week: string; values: number[] }) {
  return (
    <>
      <div className="pr-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {week}
      </div>
      {values.map((v, i) => (
        <div
          key={i}
          className={cn(
            "aspect-square min-h-[18px] w-full rounded-sm transition-colors",
            intensityClass(v)
          )}
          title={`${v} events`}
          aria-label={`${v} events on day ${i + 1} of ${week}`}
        />
      ))}
    </>
  )
}
