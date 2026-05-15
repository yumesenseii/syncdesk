"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AnalyticsSummary } from "@/lib/analytics/metrics"
import { cn } from "@/lib/utils"

const tooltipStyles = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "0.65rem",
  fontSize: "12px",
  boxShadow: "0 8px 24px rgb(15 23 42 / 8%)",
}

const WS_PALETTE = ["#2563eb", "#a855f7", "#0ea5e9", "#f97316", "#10b981", "#e11d48"]

function ChartSkeleton({ className }: { className?: string }) {
  return <div className={cn("h-full w-full animate-pulse rounded-lg bg-muted/30", className)} />
}

export function AnalyticsCharts({ summary }: { summary: AnalyticsSummary }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

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
              Task completion trend
            </CardTitle>
            <CardDescription>
              Daily created vs completed across the selected scope.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 px-2 pb-4 pt-0 sm:px-4">
            {summary.velocity.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <p className="text-sm font-medium text-foreground">
                  No completion trend yet
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Create or complete tasks in this window and the chart will fill in from
                  real Supabase task timestamps.
                </p>
              </div>
            ) : !mounted ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={summary.velocity}
                  margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="aCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="aCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyles} />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
                  />
                  <Area
                    name="Created"
                    type="monotone"
                    dataKey="created"
                    stroke="#2563eb"
                    fill="url(#aCreated)"
                    strokeWidth={2}
                  />
                  <Area
                    name="Completed"
                    type="monotone"
                    dataKey="completed"
                    stroke="#10b981"
                    fill="url(#aCompleted)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
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
            <CardDescription>Distribution by column.</CardDescription>
          </CardHeader>
          <CardContent className="flex h-72 flex-col items-center justify-center px-2 pb-4 pt-0 sm:px-4">
            {summary.totalTasks === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks in scope.</p>
            ) : !mounted ? (
              <ChartSkeleton className="h-44 max-w-[14rem]" />
            ) : (
              <>
                <div className="h-44 w-full max-w-[14rem]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.byColumn}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        stroke="var(--card)"
                        strokeWidth={2}
                      >
                        {summary.byColumn.map((c) => (
                          <Cell key={c.columnId} fill={c.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyles} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {summary.byColumn.map((c) => (
                    <li key={c.columnId} className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: c.color }}
                        aria-hidden
                      />
                      <span className="font-medium text-foreground">{c.name}</span>
                      <span className="tabular-nums">{c.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.06 }}
        className="lg:col-span-3"
      >
        <Card className="h-full border-border/70 bg-card shadow-sm shadow-black/[0.04]">
          <CardHeader className="px-5 pb-2 pt-5">
            <CardTitle className="text-base font-semibold tracking-tight">
              Workload distribution
            </CardTitle>
            <CardDescription>Tasks per workspace.</CardDescription>
          </CardHeader>
          <CardContent className="h-64 px-2 pb-4 pt-0 sm:px-4">
            {summary.workloadByWorkspace.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No workspaces in scope.
              </div>
            ) : !mounted ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.workloadByWorkspace}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyles}
                    formatter={(value) => [`${value as number} tasks`, "Load"]}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
                    {summary.workloadByWorkspace.map((_, i) => (
                      <Cell key={i} fill={WS_PALETTE[i % WS_PALETTE.length]!} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
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
              Priority breakdown
            </CardTitle>
            <CardDescription>Where the workload is concentrated.</CardDescription>
          </CardHeader>
          <CardContent className="h-64 px-2 pb-4 pt-0 sm:px-4">
            {summary.totalTasks === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No tasks in scope.
              </div>
            ) : !mounted ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={summary.byPriority}
                  margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyles} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#a855f7"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#a855f7", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
