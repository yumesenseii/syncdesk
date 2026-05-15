import type {
  BoardMeta,
  BoardTask,
  TeamMember,
  WorkspaceEntity,
} from "@/lib/boards/types"

export type ActivityType =
  | "all"
  | "created"
  | "completed"
  | "assigned"
  | "comment"
  | "updated"
  | "deadline"

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  all: "All activity",
  created: "Created",
  completed: "Completed",
  assigned: "Assigned",
  comment: "Comments",
  updated: "Updates",
  deadline: "Deadlines",
}

export const ACTIVITY_TYPES: ActivityType[] = [
  "all",
  "created",
  "completed",
  "assigned",
  "comment",
  "updated",
  "deadline",
]

export type ActivityDateRange = "today" | "7d" | "30d" | "all"

export const ACTIVITY_DATE_LABEL: Record<ActivityDateRange, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
}

export const ACTIVITY_DATE_RANGES: ActivityDateRange[] = ["today", "7d", "30d", "all"]

export interface ActivityEvent {
  id: string
  kind: ActivityType
  /** Raw persisted event type when loaded from Supabase */
  eventType?: string
  actor: TeamMember | null
  actorLabel: string
  summary: string
  targetTitle: string
  boardId?: string
  boardName?: string
  workspaceId?: string
  workspaceSlug?: string
  workspaceName?: string
  meetingId?: string
  timestamp: number
  priority?: BoardTask["priority"]
  meta?: string
}

interface DeriveInput {
  workspaces: WorkspaceEntity[]
  boardsById: Record<string, BoardMeta>
  tasksByBoardId: Record<string, BoardTask[]>
  teamMembers: TeamMember[]
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

function pickAssignee(task: BoardTask, teamById: Map<string, TeamMember>) {
  const first = task.assignees[0]
  if (!first) return null
  return teamById.get(first.id) ?? null
}

function parseDueDate(due: string): Date | null {
  if (!due) return null
  const ms = Date.parse(due)
  if (Number.isFinite(ms)) return new Date(ms)
  return null
}

/**
 * @deprecated Offline fallback only. The Activity page reads `activity_events` from Supabase.
 */
export function deriveActivityEvents(input: DeriveInput, now: number = Date.now()): ActivityEvent[] {
  const teamById = new Map(input.teamMembers.map((m) => [m.id, m]))
  const events: ActivityEvent[] = []

  for (const [boardId, tasks] of Object.entries(input.tasksByBoardId)) {
    const board = input.boardsById[boardId]
    if (!board) continue
    const workspace = input.workspaces.find((w) => w.id === board.workspaceId)
    const workspaceContext = {
      boardId,
      boardName: board.name,
      workspaceId: workspace?.id,
      workspaceSlug: workspace?.slug,
      workspaceName: workspace?.name,
    }

    for (const task of tasks) {
      const actor = pickAssignee(task, teamById)
      const actorLabel = actor?.name ?? "Workspace"

      if (typeof task.createdAt === "number" && Number.isFinite(task.createdAt)) {
        events.push({
          id: `${task.id}-created`,
          kind: "created",
          actor,
          actorLabel,
          summary: "created task",
          targetTitle: task.title,
          ...workspaceContext,
          timestamp: task.createdAt,
          priority: task.priority,
        })
      }

      if (
        task.columnId === "completed" &&
        typeof task.completedAt === "number" &&
        Number.isFinite(task.completedAt)
      ) {
        events.push({
          id: `${task.id}-completed`,
          kind: "completed",
          actor,
          actorLabel,
          summary: "marked as completed",
          targetTitle: task.title,
          ...workspaceContext,
          timestamp: task.completedAt,
          priority: task.priority,
        })
      }

      if (task.overdue) {
        const dueDate = parseDueDate(task.due)
        // Only surface a deadline event when both the `overdue` flag and a
        // parseable due date agree. Tasks marked overdue without a parseable
        // date are skipped so we don't fabricate "5 hr ago" times.
        if (dueDate && dueDate.getTime() <= now) {
          events.push({
            id: `${task.id}-deadline`,
            kind: "deadline",
            actor,
            actorLabel,
            summary: "is overdue —",
            targetTitle: task.title,
            ...workspaceContext,
            timestamp: dueDate.getTime(),
            priority: task.priority,
            meta: `due ${task.due}`,
          })
        }
      }
    }
  }

  events.sort((a, b) => b.timestamp - a.timestamp)
  return events
}

export function formatRelativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts)
  if (diff < 60 * 1000) return "just now"
  if (diff < HOUR_MS) {
    const m = Math.round(diff / (60 * 1000))
    return `${m} min ago`
  }
  if (diff < DAY_MS) {
    const h = Math.round(diff / HOUR_MS)
    return `${h} hr ago`
  }
  const d = Math.round(diff / DAY_MS)
  if (d <= 7) return `${d} day${d === 1 ? "" : "s"} ago`
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function filterByDateRange(events: ActivityEvent[], range: ActivityDateRange): ActivityEvent[] {
  if (range === "all") return events
  const now = Date.now()
  const cutoff =
    range === "today"
      ? new Date().setHours(0, 0, 0, 0)
      : range === "7d"
        ? now - 7 * DAY_MS
        : now - 30 * DAY_MS
  return events.filter((e) => e.timestamp >= cutoff)
}
