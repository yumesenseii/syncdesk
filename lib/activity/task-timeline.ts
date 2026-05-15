import type { BoardTask, TeamMember } from "@/lib/boards/types"
import { formatRelativeTime } from "@/lib/boards/task-utils"

export interface TaskTimelineEntry {
  id: string
  label: string
  detail: string
  when: string
  dot: string
  timestamp: number
}

export function buildTaskTimeline(
  task: BoardTask,
  teamById: Map<string, TeamMember>
): TaskTimelineEntry[] {
  const entries: TaskTimelineEntry[] = []
  const assignee = task.assignees[0]
  const actor = assignee ? teamById.get(assignee.id) : null
  const actorName = actor?.name ?? assignee?.name ?? "Someone"

  if (typeof task.createdAt === "number") {
    entries.push({
      id: "created",
      label: "Task created",
      detail: `by ${actorName}`,
      when: formatRelativeTime(task.createdAt),
      dot: "bg-emerald-500",
      timestamp: task.createdAt,
    })
  }

  if (task.assignees.length > 0) {
    const names = task.assignees.map((a) => a.name).join(", ")
    entries.push({
      id: "assigned",
      label: "Assigned",
      detail: names,
      when: task.updatedAt ? formatRelativeTime(task.updatedAt) : "—",
      dot: "bg-violet-500",
      timestamp: task.updatedAt ?? task.createdAt ?? 0,
    })
  }

  if (task.priority) {
    entries.push({
      id: "priority",
      label: "Priority",
      detail: task.priority,
      when: task.updatedAt ? formatRelativeTime(task.updatedAt) : "—",
      dot: "bg-amber-500",
      timestamp: task.updatedAt ?? 0,
    })
  }

  if (task.columnId === "completed" && typeof task.completedAt === "number") {
    entries.push({
      id: "completed",
      label: "Completed",
      detail: "Moved to Done",
      when: formatRelativeTime(task.completedAt),
      dot: "bg-emerald-600",
      timestamp: task.completedAt,
    })
  } else if (task.columnId !== "todo") {
    entries.push({
      id: "status",
      label: "In progress",
      detail: task.columnId.replace("_", " "),
      when: task.updatedAt ? formatRelativeTime(task.updatedAt) : "—",
      dot: "bg-primary",
      timestamp: task.updatedAt ?? 0,
    })
  }

  if (task.overdue && task.due) {
    entries.push({
      id: "overdue",
      label: "Overdue",
      detail: task.due,
      when: "now",
      dot: "bg-rose-500",
      timestamp: Date.now(),
    })
  }

  for (const c of task.taskComments ?? []) {
    entries.push({
      id: `comment-${c.id}`,
      label: "Comment",
      detail: c.text.slice(0, 80),
      when: formatRelativeTime(c.createdAt),
      dot: "bg-sky-500",
      timestamp: c.createdAt,
    })
  }

  return entries
    .filter((e) => e.timestamp > 0 || e.id === "overdue")
    .sort((a, b) => b.timestamp - a.timestamp)
}
