"use client"

import { useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const weeklyData = [
  { name: "Mon", commits: 4, tasks: 3 },
  { name: "Tue", commits: 7, tasks: 5 },
  { name: "Wed", commits: 5, tasks: 6 },
  { name: "Thu", commits: 9, tasks: 4 },
  { name: "Fri", commits: 6, tasks: 8 },
  { name: "Sat", commits: 2, tasks: 2 },
  { name: "Sun", commits: 3, tasks: 1 },
]

export function DashboardPreview() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true)
    })
  }, [])

  return (
    <Card className="overflow-hidden border-border/80 bg-card/95 shadow-xl shadow-black/10 dark:shadow-black/40">
      <CardHeader className="border-b border-border/60 bg-muted/30">
        <CardTitle className="text-lg">Contribution snapshot</CardTitle>
        <CardDescription>
          Example analytics for commits vs. tasks closed this week.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Active members", value: "6" },
            { label: "Tasks done", value: "29" },
            { label: "Focus score", value: "86%" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm"
            >
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
        <div className="h-56 w-full min-w-0 sm:h-64">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/80" />
                <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                  contentStyle={{
                    borderRadius: "0.75rem",
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--card-foreground)",
                  }}
                />
                <Bar dataKey="commits" name="Commits" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="tasks" name="Tasks" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div
              className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
              aria-hidden
            >
              Loading chart…
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
