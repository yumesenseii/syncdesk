"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  WORKSPACE_WEEKDAYS,
  type WorkspaceMetrics,
} from "@/lib/workspaces/workspace-metrics"

const tooltipStyles = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "0.65rem",
  fontSize: "12px",
  boxShadow: "0 8px 24px rgb(15 23 42 / 8%)",
}

export function WorkspaceProductivity({ metrics }: { metrics: WorkspaceMetrics }) {
  const { velocity, byColumn, heatmap, contributors } = metrics

  const heatmapMax = useMemo(() => {
    let max = 1
    for (const row of heatmap) for (const v of row.values) if (v > max) max = v
    return max
  }, [heatmap])

  const workloadBars = useMemo(
    () =>
      contributors
        .slice(0, 6)
        .map((c) => ({ name: c.member.initials, assigned: c.assigned, completed: c.completed })),
    [contributors]
  )

  return (
    <div className="grid gap-4 lg:grid-cols-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="lg:col-span-4"
      >
        <Card className="h-full border-border/70 bg-card shadow-sm shadow-black/[0.04]">
          <CardHeader className="px-5 pb-2 pt-5">
            <CardTitle className="text-base font-semibold tracking-tight">
              Completion velocity
            </CardTitle>
            <CardDescription>
              Tasks created and completed across the last 14 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-5">
            <div className="h-56">
              {velocity.length === 0 ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                  No velocity data yet. Add and complete tasks in this workspace to populate
                  the trend.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={velocity}>
                    <defs>
                      <linearGradient id="ws-created" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ws-completed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyles} />
                    <Area
                      type="monotone"
                      dataKey="created"
                      stroke="#2563eb"
                      fill="url(#ws-created)"
                      strokeWidth={2}
                      isAnimationActive
                    />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      stroke="#059669"
                      fill="url(#ws-completed)"
                      strokeWidth={2}
                      isAnimationActive
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.04 }}
        className="lg:col-span-2"
      >
        <Card className="h-full border-border/70 bg-card shadow-sm shadow-black/[0.04]">
          <CardHeader className="px-5 pb-2 pt-5">
            <CardTitle className="text-base font-semibold tracking-tight">Status mix</CardTitle>
            <CardDescription>Tasks by column across the workspace.</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-5">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={tooltipStyles} />
                  <Pie
                    data={byColumn}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={64}
                    paddingAngle={3}
                    isAnimationActive
                  >
                    {byColumn.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 px-3 text-[11px]">
              {byColumn.map((c) => (
                <li key={c.id} className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto font-medium tabular-nums text-foreground">{c.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.08 }}
        className="lg:col-span-3"
      >
        <Card className="h-full border-border/70 bg-card shadow-sm shadow-black/[0.04]">
          <CardHeader className="px-5 pb-2 pt-5">
            <CardTitle className="text-base font-semibold tracking-tight">
              Workload distribution
            </CardTitle>
            <CardDescription>Assigned vs completed by member.</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-5">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyles} />
                  <Bar dataKey="assigned" fill="#2563eb" radius={[6, 6, 0, 0]} isAnimationActive />
                  <Bar dataKey="completed" fill="#10b981" radius={[6, 6, 0, 0]} isAnimationActive />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.12 }}
        className="lg:col-span-3"
      >
        <Card className="h-full border-border/70 bg-card shadow-sm shadow-black/[0.04]">
          <CardHeader className="px-5 pb-2 pt-5">
            <CardTitle className="text-base font-semibold tracking-tight">Activity heatmap</CardTitle>
            <CardDescription>Concentration of productivity across recent weeks.</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {heatmap.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 text-center text-xs text-muted-foreground">
                No productivity data yet for this workspace.
              </div>
            ) : (
              <div
                role="grid"
                aria-label="Activity heatmap"
                className="grid gap-1"
                style={{ gridTemplateColumns: `auto repeat(${WORKSPACE_WEEKDAYS.length}, minmax(0, 1fr))` }}
              >
              <span aria-hidden />
              {WORKSPACE_WEEKDAYS.map((d) => (
                <span key={d} className="text-center text-[10px] text-muted-foreground" aria-hidden>
                  {d}
                </span>
              ))}
              {heatmap.map((row) => (
                <RowFragment
                  key={row.week}
                  week={row.week}
                  values={row.values}
                  max={heatmapMax}
                />
              ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function RowFragment({
  week,
  values,
  max,
}: {
  week: string
  values: number[]
  max: number
}) {
  return (
    <>
      <span className="text-[10px] text-muted-foreground">{week}</span>
      {values.map((v, i) => {
        const intensity = max === 0 ? 0 : v / max
        const opacity = 0.08 + intensity * 0.85
        return (
          <div
            key={`${week}-${i}`}
            className={cn("aspect-square rounded-md")}
            style={{ background: `rgb(37 99 235 / ${opacity})` }}
            title={`${WORKSPACE_WEEKDAYS[i]} · ${v}`}
          />
        )
      })}
    </>
  )
}
