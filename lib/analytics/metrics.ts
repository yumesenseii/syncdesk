import type {
  BoardMeta,
  BoardTask,
  KanbanColumnId,
  TeamMember,
  WorkspaceEntity,
} from "@/lib/boards/types"

export type Range = "7d" | "14d" | "30d" | "semester"

export const RANGE_LABEL: Record<Range, string> = {
  "7d": "Last 7 days",
  "14d": "Last 14 days",
  "30d": "Last 30 days",
  semester: "This semester",
}

export const RANGE_DAYS: Record<Range, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  semester: 90,
}

export interface AnalyticsInputs {
  workspaces: WorkspaceEntity[]
  boardsById: Record<string, BoardMeta>
  tasksByBoardId: Record<string, BoardTask[]>
  teamMembers: TeamMember[]
  workspaceId: string | "all"
}

export interface MemberContribution {
  member: TeamMember
  assigned: number
  completed: number
  share: number
}

export interface WorkspaceHealth {
  workspace: WorkspaceEntity
  total: number
  completed: number
  overdue: number
  completionPct: number
  riskScore: number
  status: "Healthy" | "Active" | "At risk" | "Critical"
}

export interface AnalyticsSummary {
  /** All tasks within the selected workspace scope. */
  tasks: BoardTask[]
  workspaceTitle: string
  totalTasks: number
  completedTasks: number
  overdueTasks: number
  inProgressTasks: number
  reviewTasks: number
  completionPct: number
  productivityScore: number
  teamEfficiency: number
  activeMembers: number
  contributionLeader: MemberContribution | null
  workloadByMember: MemberContribution[]
  workloadByWorkspace: { name: string; pct: number; count: number; workspaceId: string }[]
  byColumn: { name: string; value: number; columnId: KanbanColumnId; color: string }[]
  byPriority: { name: string; value: number }[]
  velocity: { day: string; created: number; completed: number }[]
  heatmap: { week: string; values: number[] }[]
  health: WorkspaceHealth[]
}

const COLUMN_NAMES: Record<KanbanColumnId, { label: string; color: string }> = {
  todo: { label: "To Do", color: "#94a3b8" },
  in_progress: { label: "In Progress", color: "#2563eb" },
  review: { label: "Review", color: "#a855f7" },
  completed: { label: "Completed", color: "#059669" },
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Mon=0, Tue=1, …, Sun=6 — same ordering as WEEKDAYS. */
function weekdayIndex(ms: number): number {
  const d = new Date(ms).getDay() // Sun=0..Sat=6
  return (d + 6) % 7
}

export function computeAnalyticsSummary(input: AnalyticsInputs, range: Range): AnalyticsSummary {
  const { workspaces, tasksByBoardId, teamMembers, workspaceId } = input

  const visibleWorkspaces =
    workspaceId === "all" ? workspaces : workspaces.filter((w) => w.id === workspaceId)
  const workspaceTitle =
    workspaceId === "all"
      ? "All workspaces"
      : workspaces.find((w) => w.id === workspaceId)?.name ?? "Workspace"

  const tasks: BoardTask[] = []
  for (const w of visibleWorkspaces) {
    for (const bid of w.boardIds) {
      const list = tasksByBoardId[bid]
      if (list) tasks.push(...list)
    }
  }

  const completedTasks = tasks.filter((t) => t.columnId === "completed").length
  const overdueTasks = tasks.filter((t) => t.overdue).length
  const inProgressTasks = tasks.filter((t) => t.columnId === "in_progress").length
  const reviewTasks = tasks.filter((t) => t.columnId === "review").length
  const completionPct =
    tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100)

  const contributionMap = new Map<string, { assigned: number; completed: number }>()
  for (const t of tasks) {
    for (const a of t.assignees) {
      const slot = contributionMap.get(a.id) ?? { assigned: 0, completed: 0 }
      slot.assigned += 1
      if (t.columnId === "completed") slot.completed += 1
      contributionMap.set(a.id, slot)
    }
  }
  const totalAssigned = Array.from(contributionMap.values()).reduce(
    (acc, v) => acc + v.assigned,
    0
  )

  const scopedMemberIds =
    workspaceId === "all"
      ? null
      : new Set(visibleWorkspaces.flatMap((w) => w.memberIds))
  const scopedTeamMembers =
    scopedMemberIds === null
      ? teamMembers
      : teamMembers.filter((m) => scopedMemberIds.has(m.id))

  const workloadByMember: MemberContribution[] = scopedTeamMembers
    .map((m) => {
      const slot = contributionMap.get(m.id) ?? { assigned: 0, completed: 0 }
      const share = totalAssigned === 0 ? 0 : Math.round((slot.assigned / totalAssigned) * 100)
      return {
        member: m,
        assigned: slot.assigned,
        completed: slot.completed,
        share,
      }
    })
    .sort((a, b) => b.assigned - a.assigned)

  const contributionLeader = workloadByMember.find((m) => m.assigned > 0) ?? null
  const activeMembers = workloadByMember.filter((m) => m.assigned > 0).length

  const workloadByWorkspace = visibleWorkspaces.map((w) => {
    let count = 0
    for (const bid of w.boardIds) {
      count += tasksByBoardId[bid]?.length ?? 0
    }
    return { workspaceId: w.id, name: w.name, count, pct: 0 }
  })
  const totalAcrossWs = workloadByWorkspace.reduce((acc, w) => acc + w.count, 0)
  for (const w of workloadByWorkspace) {
    w.pct = totalAcrossWs === 0 ? 0 : Math.round((w.count / totalAcrossWs) * 100)
  }

  const byColumnCounts: Record<KanbanColumnId, number> = {
    todo: 0,
    in_progress: 0,
    review: 0,
    completed: 0,
  }
  for (const t of tasks) byColumnCounts[t.columnId] += 1
  const byColumn = (Object.keys(byColumnCounts) as KanbanColumnId[]).map((id) => ({
    columnId: id,
    name: COLUMN_NAMES[id].label,
    value: byColumnCounts[id],
    color: COLUMN_NAMES[id].color,
  }))

  const priorityCounts = { Low: 0, Medium: 0, High: 0, Urgent: 0 }
  for (const t of tasks) priorityCounts[t.priority] += 1
  const byPriority = Object.entries(priorityCounts).map(([k, v]) => ({ name: k, value: v }))

  // Velocity is bucketed by day for the most recent `velocityLen` days using
  // real `createdAt` and `completedAt` timestamps on tasks. If *no* task in
  // scope carries either timestamp the array stays empty so the UI shows an
  // explicit empty state instead of a flat zero line. This is the contract
  // the chart components rely on for graceful zero-data rendering.
  const days = RANGE_DAYS[range]
  const velocityLen = Math.min(14, days)
  const today = startOfDay(Date.now())
  const velocityStart = today - (velocityLen - 1) * DAY_MS

  const hasAnyTimestamps = tasks.some(
    (t) =>
      (typeof t.createdAt === "number" && t.createdAt >= velocityStart) ||
      (typeof t.completedAt === "number" && t.completedAt >= velocityStart)
  )

  let velocity: AnalyticsSummary["velocity"] = []
  if (hasAnyTimestamps) {
    const buckets: { day: string; created: number; completed: number }[] = []
    for (let i = 0; i < velocityLen; i++) {
      const dayStart = velocityStart + i * DAY_MS
      buckets.push({
        day: new Date(dayStart).toLocaleDateString(undefined, { weekday: "short" }),
        created: 0,
        completed: 0,
      })
    }
    for (const t of tasks) {
      if (typeof t.createdAt === "number") {
        const offset = Math.floor((startOfDay(t.createdAt) - velocityStart) / DAY_MS)
        if (offset >= 0 && offset < velocityLen) buckets[offset]!.created += 1
      }
      if (typeof t.completedAt === "number") {
        const offset = Math.floor((startOfDay(t.completedAt) - velocityStart) / DAY_MS)
        if (offset >= 0 && offset < velocityLen) buckets[offset]!.completed += 1
      }
    }
    velocity = buckets
  }

  // Heatmap: real created+completed events bucketed by (week, weekday). Same
  // empty-array contract as velocity — UI must render a "no activity yet"
  // panel when this array is empty.
  const weeks = range === "7d" ? 4 : range === "14d" ? 6 : 8
  const heatmapStart = today - (weeks * 7 - 1) * DAY_MS
  const hasHeatmapEvents = tasks.some(
    (t) =>
      (typeof t.createdAt === "number" && t.createdAt >= heatmapStart) ||
      (typeof t.completedAt === "number" && t.completedAt >= heatmapStart)
  )

  let heatmap: AnalyticsSummary["heatmap"] = []
  if (hasHeatmapEvents) {
    const grid: number[][] = Array.from({ length: weeks }, () => WEEKDAYS.map(() => 0))
    const stamp = (ts: number) => {
      const day = startOfDay(ts)
      if (day < heatmapStart) return
      const weekOffset = Math.floor((day - heatmapStart) / (7 * DAY_MS))
      if (weekOffset < 0 || weekOffset >= weeks) return
      const wd = weekdayIndex(ts)
      grid[weekOffset]![wd]! += 1
    }
    for (const t of tasks) {
      if (typeof t.createdAt === "number") stamp(t.createdAt)
      if (typeof t.completedAt === "number") stamp(t.completedAt)
    }
    heatmap = grid.map((values, idx) => ({
      week: `W${weeks - idx}`,
      values,
    }))
  }

  // Productivity & efficiency are exposed as numbers so the dashboard KPI
  // cards can render `—` (no data) instead of a meaningless 0 score. Both
  // values stay strictly in [0, 100] when computed.
  const productivityScore =
    tasks.length === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            completionPct * 0.55 +
              Math.min(40, tasks.length) * 0.6 +
              Math.min(20, activeMembers * 5) -
              Math.min(25, overdueTasks * 3)
          )
        )
  const totalAssignedShare = workloadByMember.reduce((acc, m) => acc + m.assigned, 0)
  const teamEfficiency =
    totalAssignedShare === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (workloadByMember.reduce(
              (acc, m) => acc + (m.assigned === 0 ? 0 : m.completed / m.assigned),
              0
            ) /
              workloadByMember.filter((m) => m.assigned > 0).length) *
              100
          )
        )

  const health: WorkspaceHealth[] = workspaces.map((ws) => {
    let total = 0
    let completed = 0
    let overdue = 0
    for (const bid of ws.boardIds) {
      const list = tasksByBoardId[bid] ?? []
      total += list.length
      for (const t of list) {
        if (t.columnId === "completed") completed += 1
        if (t.overdue) overdue += 1
      }
    }
    const compPct = total === 0 ? 0 : Math.round((completed / total) * 100)
    const riskScore = Math.min(100, overdue * 8 + Math.max(0, 100 - compPct))
    let status: WorkspaceHealth["status"] = "Healthy"
    if (total === 0) status = "Healthy"
    else if (overdue >= 4 || compPct < 25) status = "Critical"
    else if (overdue >= 1 || compPct < 60) status = "At risk"
    else status = "Healthy"
    if (status === "Healthy" && total >= 5 && compPct < 80) status = "Active"
    return {
      workspace: ws,
      total,
      completed,
      overdue,
      completionPct: compPct,
      riskScore,
      status,
    }
  })

  return {
    tasks,
    workspaceTitle,
    totalTasks: tasks.length,
    completedTasks,
    overdueTasks,
    inProgressTasks,
    reviewTasks,
    completionPct,
    productivityScore,
    teamEfficiency,
    activeMembers,
    contributionLeader,
    workloadByMember,
    workloadByWorkspace,
    byColumn,
    byPriority,
    velocity,
    heatmap,
    health,
  }
}

export function describeMember(m: TeamMember | null | undefined): string {
  return m?.name ?? "—"
}

export { WEEKDAYS }
