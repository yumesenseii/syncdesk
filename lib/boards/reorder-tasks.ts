import type { BoardTask, KanbanColumnId } from "@/lib/boards/types"
import { sortTasksForColumn } from "@/lib/boards/task-utils"

/**
 * Move a task to `targetColumn`, optionally before `beforeTaskId` (end if omitted).
 * Returns a new board task list with contiguous sortOrder per column.
 */
export function applyTaskMove(
  tasks: BoardTask[],
  taskId: string,
  targetColumn: KanbanColumnId,
  beforeTaskId?: string | null
): BoardTask[] {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return tasks

  const without = tasks.filter((t) => t.id !== taskId)
  const colTasks = sortTasksForColumn(without.filter((t) => t.columnId === targetColumn))
  const moved: BoardTask = { ...task, columnId: targetColumn }

  let insertAt = colTasks.length
  if (beforeTaskId) {
    const idx = colTasks.findIndex((t) => t.id === beforeTaskId)
    if (idx >= 0) insertAt = idx
  }
  colTasks.splice(insertAt, 0, moved)

  const renumberedCol = colTasks.map((t, i) => ({ ...t, sortOrder: i }))
  const other = without.filter((t) => t.columnId !== targetColumn)
  return [...other, ...renumberedCol]
}
