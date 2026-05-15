"use client"

import { motion } from "framer-motion"
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Gauge,
  Layers,
  Users,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { AnalyticsSummary } from "@/lib/analytics/metrics"
import { cn } from "@/lib/utils"

interface KpiCard {
  label: string
  value: string
  hint: string
  icon: typeof Award
  tint: string
  bg: string
  emphasis?: "default" | "warning"
}

export function AnalyticsKpiGrid({ summary }: { summary: AnalyticsSummary }) {
  const empty = summary.totalTasks === 0

  const items: KpiCard[] = [
    {
      label: "Contribution leader",
      value: summary.contributionLeader
        ? `${summary.contributionLeader.member.initials} · ${summary.contributionLeader.share}%`
        : "—",
      hint: summary.contributionLeader
        ? summary.contributionLeader.member.name
        : "No contributions yet",
      icon: Award,
      tint: "text-fuchsia-600",
      bg: "bg-fuchsia-500/10",
    },
    {
      label: "Productivity score",
      value: empty ? "—" : `${summary.productivityScore}`,
      hint: empty ? "Add tasks to see a score" : "Composite (completion + load − risk)",
      icon: Gauge,
      tint: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Completion rate",
      value: empty ? "—" : `${summary.completionPct}%`,
      hint: empty ? "No tasks in scope" : `${summary.completedTasks} of ${summary.totalTasks} done`,
      icon: CheckCircle2,
      tint: "text-emerald-600",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Overdue tasks",
      value: `${summary.overdueTasks}`,
      hint: summary.overdueTasks === 0 ? "Nothing slipping" : "Across selected scope",
      icon: AlertTriangle,
      tint: "text-rose-600",
      bg: "bg-rose-500/10",
      emphasis: summary.overdueTasks > 0 ? "warning" : "default",
    },
    {
      label: "Team efficiency",
      value: empty ? "—" : `${summary.teamEfficiency}%`,
      hint: empty ? "No contributors yet" : `${summary.activeMembers} active contributors`,
      icon: Users,
      tint: "text-sky-600",
      bg: "bg-sky-500/10",
    },
    {
      label: "Active workload",
      value: `${summary.inProgressTasks + summary.reviewTasks}`,
      hint: `${summary.inProgressTasks} in progress · ${summary.reviewTasks} in review`,
      icon: Layers,
      tint: "text-amber-600",
      bg: "bg-amber-500/10",
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item, i) => {
        const Icon = item.icon
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.04 }}
          >
            <Card
              className={cn(
                "border-border/70 bg-card shadow-sm shadow-black/[0.04] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-md",
                item.emphasis === "warning" && "ring-1 ring-rose-500/30"
              )}
            >
              <CardContent className="space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </span>
                  <div
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      item.bg,
                      item.tint
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    {item.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.hint}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}
