import type { BoardTask, KanbanColumnId } from "@/lib/boards/types"

export const KANBAN_COLUMNS: KanbanColumnId[] = ["todo", "in_progress", "review", "completed"]

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Production `board_tasks.id` is uuid — never use prefixed strings like `task-…`. */
export function newTaskUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return "00000000-0000-4000-8000-000000000000".replace(/0/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  )
}

export function isTaskUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function isKanbanColumnId(value: string): value is KanbanColumnId {
  return (KANBAN_COLUMNS as string[]).includes(value)
}

export function sortTasksForColumn(tasks: BoardTask[]): BoardTask[] {
  return [...tasks].sort((a, b) => {
    const ao = a.sortOrder ?? 0
    const bo = b.sortOrder ?? 0
    if (ao !== bo) return ao - bo
    const at = a.createdAt ?? 0
    const bt = b.createdAt ?? 0
    if (at !== bt) return at - bt
    return a.id.localeCompare(b.id)
  })
}

export function groupTasksByColumn(tasks: BoardTask[]): Record<KanbanColumnId, BoardTask[]> {
  const map: Record<KanbanColumnId, BoardTask[]> = {
    todo: [],
    in_progress: [],
    review: [],
    completed: [],
  }
  for (const t of tasks) {
    const col = isKanbanColumnId(t.columnId) ? t.columnId : "todo"
    map[col].push(t)
  }
  for (const col of KANBAN_COLUMNS) {
    map[col] = sortTasksForColumn(map[col])
  }
  return map
}

export function nextSortOrder(tasks: BoardTask[], columnId: KanbanColumnId): number {
  const inCol = tasks.filter((t) => t.columnId === columnId)
  if (inCol.length === 0) return 0
  return Math.max(...inCol.map((t) => t.sortOrder ?? 0)) + 1
}

/** ISO date (yyyy-mm-dd) or empty */
export function formatDueForStorage(value: string): string {
  const v = value.trim()
  if (!v || v === "—") return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const parsed = Date.parse(v)
  if (!Number.isFinite(parsed)) return v
  return new Date(parsed).toISOString().slice(0, 10)
}

export function formatDueForDisplay(value: string): string {
  const v = value.trim()
  if (!v || v === "—") return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T12:00:00`)
    if (!Number.isFinite(d.getTime())) return v
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  }
  return v
}

export function computeOverdue(due: string): boolean {
  const iso = formatDueForStorage(due)
  if (!iso) return false
  const end = new Date(`${iso}T23:59:59`).getTime()
  return Number.isFinite(end) && end < Date.now()
}

export function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000)
    return `${m}m ago`
  }
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000)
    return `${h}h ago`
  }
  const d = Math.floor(diff / 86_400_000)
  if (d < 14) return `${d}d ago`
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
