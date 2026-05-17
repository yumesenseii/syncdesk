"use client"

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  Calendar,
  Clock,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react"

import { BoardTaskDialog } from "@/components/boards/board-task-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BoardTask, KanbanColumnId, TaskPriority } from "@/lib/boards/types"
import {
  formatDueForDisplay,
  groupTasksByColumn,
} from "@/lib/boards/task-utils"
import { UserAvatar } from "@/components/ui/user-avatar"
import { cn } from "@/lib/utils"
import { useBoardTasksRealtime } from "@/hooks/use-board-tasks-realtime"
import { useBoardTasks, useBoardsStore } from "@/stores/boards-store"

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  Low: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
  Medium: "bg-sky-500/10 text-sky-700 border-sky-500/25",
  High: "bg-amber-500/10 text-amber-700 border-amber-500/25",
  Urgent: "bg-rose-500/10 text-rose-700 border-rose-500/25",
}

const COLUMNS: {
  id: KanbanColumnId
  title: string
  accent: string
  dot: string
}[] = [
  { id: "todo", title: "To Do", accent: "from-slate-500/8", dot: "bg-slate-400" },
  { id: "in_progress", title: "In Progress", accent: "from-primary/8", dot: "bg-primary" },
  { id: "review", title: "Review", accent: "from-amber-500/8", dot: "bg-amber-500" },
  { id: "completed", title: "Completed", accent: "from-emerald-500/8", dot: "bg-emerald-500" },
]

function AssigneeStack({ assignees }: { assignees: BoardTask["assignees"] }) {
  if (assignees.length === 0) return null
  return (
    <div className="flex -space-x-1.5">
      {assignees.slice(0, 3).map((a) => (
        <UserAvatar
          key={a.id}
          name={a.name}
          initials={a.initials}
          avatarUrl={a.avatarUrl}
          color={a.color}
          size="xs"
          ringClassName="ring-2 ring-card"
        />
      ))}
      {assignees.length > 3 ? (
        <div
          className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card"
          aria-hidden
        >
          +{assignees.length - 3}
        </div>
      ) : null}
    </div>
  )
}

function TaskCard({
  task,
  boardId,
  onDragStart,
  onDragEnd,
  isDragging,
  dropIndicator,
}: {
  task: BoardTask
  boardId: string
  onDragStart: (taskId: string) => void
  onDragEnd: () => void
  isDragging: boolean
  dropIndicator?: "before" | null
}) {
  const moveTask = useBoardsStore((s) => s.moveTask)
  const [dialogOpen, setDialogOpen] = useState(false)
  const dueLabel = formatDueForDisplay(task.due)
  const checklistDone = (task.checklist ?? []).filter((c) => c.done).length
  const checklistTotal = (task.checklist ?? []).length

  return (
    <>
      {dropIndicator === "before" ? (
        <div className="h-1 rounded-full bg-primary/70 shadow-sm shadow-primary/30" aria-hidden />
      ) : null}
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: isDragging ? 0.55 : 1, y: 0, scale: isDragging ? 0.98 : 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
        draggable
        onDragStart={(event) => {
          const native = event as unknown as DragEvent<HTMLDivElement>
          native.dataTransfer?.setData("text/plain", task.id)
          if (native.dataTransfer) native.dataTransfer.effectAllowed = "move"
          onDragStart(task.id)
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        className={cn(
          "group/task cursor-grab touch-manipulation active:cursor-grabbing",
          isDragging && "ring-2 ring-primary/30"
        )}
      >
        <Card className="border-border/60 bg-card p-0 ring-1 ring-foreground/[0.04] transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-foreground/[0.04]">
          <div className="space-y-2.5 p-3">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setDialogOpen(true)}
              >
                <div className="flex flex-wrap items-center gap-1">
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      PRIORITY_STYLES[task.priority]
                    )}
                  >
                    {task.priority}
                  </span>
                  {task.overdue ? (
                    <span className="rounded-full border border-rose-500/35 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                      Overdue
                    </span>
                  ) : null}
                  {task.columnId === "completed" ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Done
                    </span>
                  ) : null}
                  {task.tags.slice(0, 2).map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                  {task.title}
                </div>
                {task.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {task.description}
                  </p>
                ) : null}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-all duration-200 ease-out hover:bg-muted/60 hover:text-foreground group-hover/task:opacity-100"
                    aria-label="Task actions"
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setDialogOpen(true)}>Edit task</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {COLUMNS.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => moveTask(boardId, task.id, c.id)}
                      disabled={task.columnId === c.id}
                    >
                      Move to {c.title}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-600"
                    onClick={() => useBoardsStore.getState().removeTask(boardId, task.id)}
                  >
                    <Trash2 className="mr-2 size-4" aria-hidden />
                    Delete task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {checklistTotal > 0 ? (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/80">
                  <div
                    className="h-full rounded-full bg-primary/80 transition-[width]"
                    style={{ width: `${Math.round((checklistDone / checklistTotal) * 100)}%` }}
                  />
                </div>
                <span className="tabular-nums">
                  {checklistDone}/{checklistTotal}
                </span>
              </div>
            ) : task.progress > 0 ? (
              <div className="h-1 overflow-hidden rounded-full bg-muted/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary/80 to-sky-500/90 transition-[width] duration-300 ease-out"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium tabular-nums text-muted-foreground">
                {dueLabel ? (
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      task.overdue && "font-semibold text-rose-600"
                    )}
                  >
                    <Calendar className="size-3 shrink-0" aria-hidden />
                    {dueLabel}
                  </span>
                ) : null}
                {typeof task.updatedAt === "number" ? (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3 shrink-0" aria-hidden />
                    updated
                  </span>
                ) : null}
                {(task.taskComments?.length ?? 0) > 0 || task.comments > 0 ? (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3 shrink-0" aria-hidden />
                    {task.taskComments?.length ?? task.comments}
                  </span>
                ) : null}
                {task.attachments > 0 ? (
                  <span className="flex items-center gap-1">
                    <Paperclip className="size-3 shrink-0" aria-hidden />
                    {task.attachments}
                  </span>
                ) : null}
              </div>
              <AssigneeStack assignees={task.assignees} />
            </div>
          </div>
        </Card>
      </motion.div>

      <BoardTaskDialog
        boardId={boardId}
        task={task}
        mode="edit"
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}

export function BoardKanban({
  boardId,
  boardTitle,
}: {
  boardId: string
  boardTitle: string
}) {
  const tasks = useBoardTasks(boardId)
  useBoardTasksRealtime(boardId)
  const moveTask = useBoardsStore((s) => s.moveTask)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const deepTaskId = searchParams.get("task")
  const [deepLinkTask, setDeepLinkTask] = useState<BoardTask | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverColumn, setHoverColumn] = useState<KanbanColumnId | null>(null)
  const [dropBeforeId, setDropBeforeId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createColumn, setCreateColumn] = useState<KanbanColumnId>("todo")

  const tasksByColumn = useMemo(() => groupTasksByColumn(tasks), [tasks])

  useEffect(() => {
    if (!deepTaskId) {
      setDeepLinkTask(null)
      return
    }
    const match = tasks.find((t) => t.id === deepTaskId)
    if (match) setDeepLinkTask(match)
  }, [deepTaskId, tasks])

  const clearDeepLink = useCallback(() => {
    setDeepLinkTask(null)
    if (!deepTaskId) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete("task")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [deepTaskId, pathname, router, searchParams])

  const openCreate = (col: KanbanColumnId) => {
    setCreateColumn(col)
    setCreateOpen(true)
  }

  const onDropTo = useCallback(
    (columnId: KanbanColumnId) => (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const id = event.dataTransfer.getData("text/plain")
      if (id) moveTask(boardId, id, columnId, dropBeforeId)
      setDraggingId(null)
      setHoverColumn(null)
      setDropBeforeId(null)
    },
    [boardId, dropBeforeId, moveTask]
  )

  return (
    <section aria-label={`Kanban for ${boardTitle}`} className="space-y-3">
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="grid min-w-[min(100%,72rem)] gap-3 px-1 sm:min-w-[48rem] lg:grid-cols-4 lg:min-w-0 xl:gap-3">
          {COLUMNS.map((col) => {
            const colTasks = tasksByColumn[col.id]
            const isHover = hoverColumn === col.id
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
                  if (hoverColumn !== col.id) setHoverColumn(col.id)
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return
                  setHoverColumn((c) => (c === col.id ? null : c))
                  setDropBeforeId(null)
                }}
                onDrop={onDropTo(col.id)}
                className={cn(
                  "relative flex min-h-[18rem] flex-col rounded-2xl border bg-card/40 p-2.5 ring-1 ring-foreground/[0.03] transition-[border-color,background-color,box-shadow] duration-200 ease-out",
                  isHover
                    ? "border-primary/40 bg-card/80 shadow-md shadow-primary/5 ring-primary/20"
                    : "border-border/60 hover:bg-card/55"
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-x-0 top-0 h-14 rounded-t-2xl bg-gradient-to-b to-transparent",
                    col.accent
                  )}
                  aria-hidden
                />

                <div className="relative mb-2 flex items-center justify-between gap-2 px-0.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", col.dot)} aria-hidden />
                    <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                      {col.title}
                    </h2>
                    <span className="shrink-0 rounded-md bg-muted/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                      {colTasks.length}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={`Add task to ${col.title}`}
                    onClick={() => openCreate(col.id)}
                  >
                    <Plus className="size-4" aria-hidden />
                  </Button>
                </div>

                <div className="relative flex min-h-[8rem] flex-1 flex-col gap-2">
                  <AnimatePresence mode="popLayout">
                    {colTasks.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border/60 bg-background/40 px-3 py-8 text-center"
                      >
                        <p className="text-xs font-medium text-muted-foreground">
                          Drop tasks here
                        </p>
                        <p className="text-[10px] text-muted-foreground/80">
                          or tap + to add
                        </p>
                      </motion.div>
                    ) : (
                      colTasks.map((task) => (
                        <div
                          key={task.id}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (draggingId && draggingId !== task.id) {
                              setDropBeforeId(task.id)
                              setHoverColumn(col.id)
                            }
                          }}
                        >
                          <TaskCard
                            task={task}
                            boardId={boardId}
                            onDragStart={(id) => setDraggingId(id)}
                            onDragEnd={() => {
                              setDraggingId(null)
                              setHoverColumn(null)
                              setDropBeforeId(null)
                            }}
                            isDragging={draggingId === task.id}
                            dropIndicator={
                              dropBeforeId === task.id && draggingId !== task.id
                                ? "before"
                                : null
                            }
                          />
                        </div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <BoardTaskDialog
        boardId={boardId}
        task={null}
        mode="create"
        defaultColumn={createColumn}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {deepLinkTask ? (
        <BoardTaskDialog
          boardId={boardId}
          task={deepLinkTask}
          mode="edit"
          defaultColumn={deepLinkTask.columnId}
          open
          onOpenChange={(open) => {
            if (!open) clearDeepLink()
          }}
        />
      ) : null}
    </section>
  )
}
