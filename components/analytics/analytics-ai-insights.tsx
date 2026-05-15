"use client"

import { AlertTriangle, Brain, Lightbulb, Sparkles, Trophy } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AnalyticsSummary } from "@/lib/analytics/metrics"
import { cn } from "@/lib/utils"

type Tone = "positive" | "neutral" | "warning"

interface Insight {
  icon: typeof Brain
  tone: Tone
  title: string
  body: string
}

const TONE_STYLES: Record<Tone, string> = {
  positive: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  neutral: "bg-primary/10 text-primary border-primary/20",
  warning: "bg-rose-500/10 text-rose-700 border-rose-500/20",
}

function buildInsights(summary: AnalyticsSummary): Insight[] {
  // Without any tasks there is nothing real to summarise. Returning an empty
  // list lets the card render its honest empty-state copy instead of
  // generic "no overdue tasks" / "maintain pace" filler.
  if (summary.totalTasks === 0) return []

  const out: Insight[] = []

  if (summary.contributionLeader) {
    out.push({
      icon: Trophy,
      tone: "positive",
      title: `${summary.contributionLeader.member.name} is leading contributions`,
      body: `${summary.contributionLeader.share}% workload share with ${summary.contributionLeader.completed} completed tasks — consider acknowledging or rotating reviewers.`,
    })
  }

  const inactive = summary.workloadByMember.filter((m) => m.assigned === 0)
  if (inactive.length > 0) {
    const names = inactive.slice(0, 2).map((m) => m.member.name).join(", ")
    out.push({
      icon: AlertTriangle,
      tone: "warning",
      title: `${inactive.length} ${inactive.length === 1 ? "member is" : "members are"} inactive`,
      body: `${names}${inactive.length > 2 ? " and others" : ""} have no assigned tasks in scope — assign or reach out.`,
    })
  }

  if (summary.overdueTasks > 0) {
    out.push({
      icon: AlertTriangle,
      tone: "warning",
      title: `${summary.overdueTasks} deadline${summary.overdueTasks === 1 ? "" : "s"} at risk`,
      body: "Open the boards filtered by overdue to triage and rebalance the workload.",
    })
  } else if (summary.completedTasks > 0) {
    out.push({
      icon: Sparkles,
      tone: "positive",
      title: "No overdue tasks",
      body: "Maintain pace — schedule a brief retro before the next sprint window.",
    })
  }

  if (summary.completionPct >= 70) {
    out.push({
      icon: Lightbulb,
      tone: "positive",
      title: "Healthy completion velocity",
      body: `${summary.completionPct}% of tasks are done — protect deep-work blocks to keep momentum.`,
    })
  } else if (summary.completedTasks > 0) {
    out.push({
      icon: Lightbulb,
      tone: "neutral",
      title: "Completion is trailing",
      body: `Only ${summary.completionPct}% complete — pull two review items forward to unblock the rest.`,
    })
  }

  if (summary.inProgressTasks > summary.activeMembers * 3 && summary.activeMembers > 0) {
    out.push({
      icon: Brain,
      tone: "warning",
      title: "Work-in-progress is high",
      body: `${summary.inProgressTasks} active tasks across ${summary.activeMembers} contributors — limit WIP to improve throughput.`,
    })
  }

  return out.slice(0, 5)
}

export function AnalyticsAiInsights({ summary }: { summary: AnalyticsSummary }) {
  const insights = buildInsights(summary)

  return (
    <Card className="border-border/70 bg-gradient-to-b from-card to-muted/30 shadow-sm shadow-black/[0.04]">
      <CardHeader className="px-5 pb-2 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight">
              Smart insights
            </CardTitle>
            <CardDescription>
              Pattern-based reads computed from your live workspace data.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5 pt-2">
        {insights.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {summary.totalTasks === 0
              ? "No tasks in scope — create one to start surfacing insights."
              : "Not enough activity yet to surface a useful signal."}
          </p>
        ) : (
          insights.map((insight) => {
            const Icon = insight.icon
            return (
              <div
                key={insight.title}
                className={cn(
                  "flex gap-3 rounded-xl border bg-card/80 p-3.5 shadow-sm",
                  TONE_STYLES[insight.tone]
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/60"
                  )}
                  aria-hidden
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
