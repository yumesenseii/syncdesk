import type {
  BoardMeta,
  BoardTask,
  KanbanColumnId,
  TeamMember,
  WorkspaceEntity,
} from "@/lib/boards/types"

/** Resolve workspace roster from member user ids (workspace_members). */
function rosterForWorkspace(workspace: WorkspaceEntity, teamMembers: TeamMember[]): TeamMember[] {
  const byId = new Map(teamMembers.map((m) => [m.id, m]))
  return workspace.memberIds.map((id) => byId.get(id)).filter((m): m is TeamMember => Boolean(m))
}

export type WorkspaceHealthStatus =
  | "Healthy"
  | "At Risk"
  | "Behind Schedule"
  | "Overloaded"

export interface BoardSummary {
  board: BoardMeta
  total: number
  completed: number
  overdue: number
  inProgress: number
  review: number
  completionPct: number
  members: TeamMember[]
  health: WorkspaceHealthStatus
}

export interface WorkspaceMemberStat {
  member: TeamMember
  assigned: number
  completed: number
  overdue: number
  share: number
  completionRate: number
}

export interface WorkspaceMetrics {
  workspace: WorkspaceEntity
  totalTasks: number
  completedTasks: number
  overdueTasks: number
  inProgressTasks: number
  reviewTasks: number
  todoTasks: number
  completionPct: number
  velocityScore: number
  participationScore: number
  workloadBalanceScore: number
  health: WorkspaceHealthStatus
  members: TeamMember[]
  contributors: WorkspaceMemberStat[]
  topContributor: WorkspaceMemberStat | null
  leastActiveMember: WorkspaceMemberStat | null
  boards: BoardSummary[]
  byColumn: { id: KanbanColumnId; name: string; value: number; color: string }[]
  velocity: { day: string; created: number; completed: number }[]
  heatmap: { week: string; values: number[] }[]
}

const COLUMN_NAMES: Record<KanbanColumnId, { label: string; color: string }> = {
  todo: { label: "To Do", color: "#94a3b8" },
  in_progress: { label: "In Progress", color: "#2563eb" },
  review: { label: "Review", color: "#a855f7" },
  completed: { label: "Completed", color: "#059669" },
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
export { WEEKDAYS as WORKSPACE_WEEKDAYS }

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function weekdayIndex(ms: number): number {
  const d = new Date(ms).getDay()
  return (d + 6) % 7
}

function deriveBoardHealth(total: number, overdue: number, completionPct: number): WorkspaceHealthStatus {
  if (total === 0) return "Healthy"
  if (overdue >= 4 || completionPct < 25) return "Behind Schedule"
  if (overdue >= 2) return "Overloaded"
  if (overdue >= 1 || completionPct < 60) return "At Risk"
  return "Healthy"
}

interface ComputeInput {
  workspace: WorkspaceEntity
  boardsById: Record<string, BoardMeta>
  tasksByBoardId: Record<string, BoardTask[]>
  teamMembers: TeamMember[]
}

export function computeWorkspaceMetrics(input: ComputeInput): WorkspaceMetrics {
  const { workspace, boardsById, tasksByBoardId, teamMembers } = input
  const teamById = new Map(teamMembers.map((m) => [m.id, m]))

  const tasks: BoardTask[] = []
  for (const bid of workspace.boardIds) {
    const list = tasksByBoardId[bid] ?? []
    tasks.push(...list)
  }

  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.columnId === "completed").length
  const overdueTasks = tasks.filter((t) => t.overdue).length
  const inProgressTasks = tasks.filter((t) => t.columnId === "in_progress").length
  const reviewTasks = tasks.filter((t) => t.columnId === "review").length
  const todoTasks = tasks.filter((t) => t.columnId === "todo").length
  const completionPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

  const memberMap = new Map<string, { assigned: number; completed: number; overdue: number }>()
  for (const t of tasks) {
    for (const a of t.assignees) {
      const slot = memberMap.get(a.id) ?? { assigned: 0, completed: 0, overdue: 0 }
      slot.assigned += 1
      if (t.columnId === "completed") slot.completed += 1
      if (t.overdue) slot.overdue += 1
      memberMap.set(a.id, slot)
    }
  }
  const totalAssigned = Array.from(memberMap.values()).reduce((acc, v) => acc + v.assigned, 0)

  const workspaceMemberIds = new Set(workspace.memberIds)
  const consideredIds = new Set<string>([...workspace.memberIds, ...memberMap.keys()])
  const contributors: WorkspaceMemberStat[] = Array.from(consideredIds)
    .map((id) => teamById.get(id))
    .filter((m): m is TeamMember => Boolean(m))
    .map((m) => {
      const slot = memberMap.get(m.id) ?? { assigned: 0, completed: 0, overdue: 0 }
      const share = totalAssigned === 0 ? 0 : Math.round((slot.assigned / totalAssigned) * 100)
      const completionRate = slot.assigned === 0 ? 0 : Math.round((slot.completed / slot.assigned) * 100)
      return {
        member: m,
        assigned: slot.assigned,
        completed: slot.completed,
        overdue: slot.overdue,
        share,
        completionRate,
      }
    })
    .sort((a, b) => b.assigned - a.assigned || b.completed - a.completed)

  const topContributor = contributors.find((c) => c.assigned > 0) ?? null
  const leastActiveMember = (() => {
    const ws = contributors.filter((c) => workspaceMemberIds.has(c.member.id))
    if (ws.length === 0) return null
    return ws.slice().sort((a, b) => a.assigned - b.assigned || a.completed - b.completed)[0] ?? null
  })()

  const members = rosterForWorkspace(workspace, teamMembers)

  const boards: BoardSummary[] = workspace.boardIds
    .map((bid) => boardsById[bid])
    .filter((b): b is BoardMeta => Boolean(b))
    .map((b) => {
      const list = tasksByBoardId[b.id] ?? []
      const total = list.length
      const completed = list.filter((t) => t.columnId === "completed").length
      const overdue = list.filter((t) => t.overdue).length
      const inProgress = list.filter((t) => t.columnId === "in_progress").length
      const review = list.filter((t) => t.columnId === "review").length
      const completionPctB = total === 0 ? 0 : Math.round((completed / total) * 100)
      const memberSet = new Map<string, TeamMember>()
      for (const t of list) for (const a of t.assignees) {
        const tm = teamById.get(a.id)
        if (tm) memberSet.set(tm.id, tm)
      }
      return {
        board: b,
        total,
        completed,
        overdue,
        inProgress,
        review,
        completionPct: completionPctB,
        members: Array.from(memberSet.values()),
        health: deriveBoardHealth(total, overdue, completionPctB),
      }
    })

  const byColumnCounts: Record<KanbanColumnId, number> = {
    todo: todoTasks,
    in_progress: inProgressTasks,
    review: reviewTasks,
    completed: completedTasks,
  }
  const byColumn = (Object.keys(byColumnCounts) as KanbanColumnId[]).map((id) => ({
    id,
    name: COLUMN_NAMES[id].label,
    value: byColumnCounts[id],
    color: COLUMN_NAMES[id].color,
  }))

  // Velocity is bucketed from real `createdAt` / `completedAt` task
  // timestamps. We deliberately return an empty array when no task in the
  // window carries either — the UI then renders an empty state instead of
  // a flat zero line. Same contract applies to the heatmap below.
  const velocityLen = 14
  const today = startOfDay(Date.now())
  const velocityStart = today - (velocityLen - 1) * DAY_MS
  const hasTimestamps = tasks.some(
    (t) =>
      (typeof t.createdAt === "number" && t.createdAt >= velocityStart) ||
      (typeof t.completedAt === "number" && t.completedAt >= velocityStart)
  )

  let velocity: WorkspaceMetrics["velocity"] = []
  if (hasTimestamps) {
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

  const weeks = 6
  const heatmapStart = today - (weeks * 7 - 1) * DAY_MS
  const hasHeatmapEvents = tasks.some(
    (t) =>
      (typeof t.createdAt === "number" && t.createdAt >= heatmapStart) ||
      (typeof t.completedAt === "number" && t.completedAt >= heatmapStart)
  )

  let heatmap: WorkspaceMetrics["heatmap"] = []
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

  const activeContributors = contributors.filter((c) => c.assigned > 0).length
  const participationScore =
    contributors.length === 0
      ? 0
      : Math.round((activeContributors / Math.max(contributors.length, members.length || 1)) * 100)

  const velocityScore = Math.min(
    100,
    Math.round(
      completionPct * 0.6 +
        Math.min(40, totalTasks) * 0.5 +
        Math.min(20, activeContributors * 4) -
        Math.min(25, overdueTasks * 3)
    )
  )

  // Workload balance: 0 means heavily skewed, 100 means perfectly even.
  // When there is nothing to balance yet the metric is undefined; we treat
  // it as "neutral" (100) so the workspace health classifier doesn't flag
  // an empty workspace as `Overloaded`. UIs render this score together
  // with `totalAssigned`, so the empty case can still be displayed as "—"
  // when desired.
  const workloadBalanceScore = (() => {
    if (contributors.length === 0 || totalAssigned === 0) return 100
    const equal = totalAssigned / contributors.length
    const variance =
      contributors.reduce((acc, c) => acc + Math.pow(c.assigned - equal, 2), 0) /
      contributors.length
    const std = Math.sqrt(variance)
    const normalized = Math.min(1, std / Math.max(equal, 1))
    return Math.round((1 - normalized) * 100)
  })()

  let health: WorkspaceHealthStatus = "Healthy"
  if (totalTasks > 0) {
    if (overdueTasks >= 5 || completionPct < 25) health = "Behind Schedule"
    else if (workloadBalanceScore < 35 || (activeContributors > 0 && activeContributors <= 1 && totalTasks > 8)) {
      health = "Overloaded"
    } else if (overdueTasks >= 1 || completionPct < 60 || participationScore < 50) {
      health = "At Risk"
    } else {
      health = "Healthy"
    }
  }

  return {
    workspace,
    totalTasks,
    completedTasks,
    overdueTasks,
    inProgressTasks,
    reviewTasks,
    todoTasks,
    completionPct,
    velocityScore,
    participationScore,
    workloadBalanceScore,
    health,
    members,
    contributors,
    topContributor,
    leastActiveMember,
    boards,
    byColumn,
    velocity,
    heatmap,
  }
}

export function healthAccent(health: WorkspaceHealthStatus): string {
  switch (health) {
    case "Healthy":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/25"
    case "At Risk":
      return "bg-amber-500/10 text-amber-800 border-amber-500/25"
    case "Behind Schedule":
      return "bg-rose-500/10 text-rose-700 border-rose-500/25"
    case "Overloaded":
      return "bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/25"
  }
}
