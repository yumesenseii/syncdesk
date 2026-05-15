import type { KanbanColumnId } from "@/lib/boards/types"

export const KANBAN_COLUMN_LABEL: Record<KanbanColumnId, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
}

export function columnLabel(columnId: string): string {
  if (columnId in KANBAN_COLUMN_LABEL) {
    return KANBAN_COLUMN_LABEL[columnId as KanbanColumnId]
  }
  return columnId
}
