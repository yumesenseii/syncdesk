"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  Bell,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  CornerDownLeft,
  Hash,
  Link2,
  ListChecks,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Tag,
  Timer,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { TaskAssigneePicker } from "@/components/boards/task-assignee-picker"
import { UserAvatar } from "@/components/ui/user-avatar"
import { useAuth } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { useWorkspaceMembersList } from "@/hooks/use-workspace-members"
import type { TeamMember } from "@/lib/boards/types"
import { buildTaskTimeline } from "@/lib/activity/task-timeline"
import { DEFAULT_BOARD_SETTINGS } from "@/lib/boards/seed"
import {
  computeOverdue,
  formatDueForDisplay,
  formatDueForStorage,
} from "@/lib/boards/task-utils"
import type {
  BoardSettings,
  BoardTask,
  KanbanColumnId,
  TaskChecklistItem,
  TaskComment,
  TaskPriority,
} from "@/lib/boards/types"
import { getFullNameFromMetadata } from "@/lib/user-profile"
import { cn } from "@/lib/utils"
import { useBoardsStore } from "@/stores/boards-store"

const PRIORITIES: { id: TaskPriority; tone: string; dot: string }[] = [
  { id: "Low", tone: "bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" },
  { id: "Medium", tone: "bg-sky-500/10 text-sky-700", dot: "bg-sky-500" },
  { id: "High", tone: "bg-amber-500/10 text-amber-700", dot: "bg-amber-500" },
  { id: "Urgent", tone: "bg-rose-500/10 text-rose-700", dot: "bg-rose-500" },
]

const COLUMNS: { id: KanbanColumnId; label: string; tone: string }[] = [
  { id: "todo", label: "To Do", tone: "text-slate-700 data-[active=true]:bg-slate-500/12" },
  { id: "in_progress", label: "In Progress", tone: "text-primary data-[active=true]:bg-primary/12" },
  { id: "review", label: "Review", tone: "text-amber-700 data-[active=true]:bg-amber-500/12" },
  { id: "completed", label: "Completed", tone: "text-emerald-700 data-[active=true]:bg-emerald-500/12" },
]

interface CommentEntry {
  id: string
  author: string
  initials: string
  color: string
  avatarUrl?: string
  text: string
  at: string
}

function shortId(value: string) {
  if (!value) return "—"
  return value.split("-").pop()?.slice(0, 6).toUpperCase() ?? "—"
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}-${Date.now().toString(36)}`
}

function emptyTask(column: KanbanColumnId, settings: BoardSettings): Omit<BoardTask, "id"> {
  return {
    title: "",
    description: "",
    columnId: column,
    tags: [],
    priority: settings.defaultPriority,
    due: "",
    overdue: false,
    comments: 0,
    attachments: 0,
    assignees: [],
    progress: 0,
  }
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Bell
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="size-3" aria-hidden />
      {children}
    </div>
  )
}

function SidebarRow({
  label,
  control,
  hint,
}: {
  label: string
  control: React.ReactNode
  hint?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg px-1 py-1.5 transition-colors hover:bg-muted/30">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function BoardTaskDialog({
  boardId,
  task,
  mode,
  defaultColumn = "todo",
  open,
  onOpenChange,
}: {
  boardId: string
  task: BoardTask | null
  mode: "create" | "edit"
  defaultColumn?: KanbanColumnId
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <BoardTaskDialogBody
          boardId={boardId}
          task={task}
          mode={mode}
          defaultColumn={defaultColumn}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  )
}

function BoardTaskDialogBody({
  boardId,
  task,
  mode,
  defaultColumn,
  onOpenChange,
}: {
  boardId: string
  task: BoardTask | null
  mode: "create" | "edit"
  defaultColumn: KanbanColumnId
  onOpenChange: (open: boolean) => void
}) {
  const teamMembers = useBoardsStore((s) => s.teamMembers)
  const board = useBoardsStore((s) => s.boardsById[boardId])
  const workspaceId = board?.workspaceId ?? null
  const {
    members: workspaceMembers,
    isLoading: membersLoading,
    isFetching: membersFetching,
  } = useWorkspaceMembersList(workspaceId)
  const assigneesLoading = membersLoading || (membersFetching && workspaceMembers.length === 0)
  const addTask = useBoardsStore((s) => s.addTask)
  const updateTask = useBoardsStore((s) => s.updateTask)
  const removeTask = useBoardsStore((s) => s.removeTask)
  const { user } = useAuth()
  const { data: myProfile } = useProfile(user?.id)

  const settings = board?.settings ?? DEFAULT_BOARD_SETTINGS
  const teamById = useMemo(() => {
    const map = new Map(teamMembers.map((m) => [m.id, m]))
    for (const m of workspaceMembers) map.set(m.id, m)
    if (task) {
      for (const a of task.assignees) {
        if (!map.has(a.id)) {
          map.set(a.id, {
            id: a.id,
            userId: a.id,
            name: a.name,
            initials: a.initials,
            color: a.color,
            avatarUrl: a.avatarUrl,
          })
        }
      }
    }
    return map
  }, [teamMembers, workspaceMembers, task])

  const seed = useMemo(() => {
    if (mode === "edit" && task) {
      const storedComments: CommentEntry[] = (task.taskComments ?? []).map((c) => ({
        id: c.id,
        author: c.authorName,
        initials: c.initials,
        color: c.color,
        avatarUrl: c.avatarUrl,
        text: c.text,
        at: new Date(c.createdAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      }))
      return {
        title: task.title,
        description: task.description,
        priority: task.priority,
        columnId: task.columnId,
        due: formatDueForStorage(task.due),
        overdue: task.overdue,
        tags: task.tags,
        progress: task.progress,
        assigneeIds: task.assignees.map((a) => a.id),
        comments: storedComments,
        checklist: task.checklist ?? [],
      }
    }
    const base = emptyTask(defaultColumn, settings)
    return {
      title: base.title,
      description: base.description,
      priority: base.priority,
      columnId: defaultColumn,
      due: base.due,
      overdue: base.overdue,
      tags: [] as string[],
      progress: base.progress,
      assigneeIds: [] as string[],
      comments: [] as CommentEntry[],
      checklist: [] as TaskChecklistItem[],
    }
    // Intentionally compute once per mount; the dialog body remounts each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [title, setTitle] = useState(seed.title)
  const [description, setDescription] = useState(seed.description)
  const [priority, setPriority] = useState<TaskPriority>(seed.priority)
  const [columnId, setColumnId] = useState<KanbanColumnId>(seed.columnId)
  const [due, setDue] = useState(seed.due)
  const [overdue, setOverdue] = useState(seed.overdue)
  const [tags, setTags] = useState<string[]>(seed.tags)
  const [tagDraft, setTagDraft] = useState("")
  const [progress, setProgress] = useState(seed.progress)
  const [assigneeIds, setAssigneeIds] = useState<string[]>(seed.assigneeIds)
  const [assigneeQuery, setAssigneeQuery] = useState("")

  const [commentDraft, setCommentDraft] = useState("")
  const [comments, setComments] = useState<CommentEntry[]>(seed.comments)
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>(
    "checklist" in seed ? seed.checklist : []
  )
  const [checklistDraft, setChecklistDraft] = useState("")

  // Inherited from board settings, locally editable for this task only
  const [notifyAssignees, setNotifyAssignees] = useState(
    settings.notifications.inApp || settings.notifications.email
  )
  const [notifyOnDue, setNotifyOnDue] = useState(settings.automation.notifyOnDue)
  const [autoMoveOverdue, setAutoMoveOverdue] = useState(settings.automation.autoMoveOverdue)
  const [autoComplete, setAutoComplete] = useState(settings.automation.autoArchiveCompleted)

  const commentComposerAvatar = useMemo(() => {
    const me =
      workspaceMembers.find((m) => m.id === user?.id) ??
      teamMembers.find((m) => m.id === user?.id)
    const name =
      me?.name ??
      getFullNameFromMetadata(user?.user_metadata) ??
      user?.email?.split("@")[0] ??
      "You"
    return {
      name,
      initials: me?.initials ?? name.slice(0, 2).toUpperCase(),
      color: me?.color ?? "bg-primary/15 text-primary",
      avatarUrl: me?.avatarUrl ?? myProfile?.avatar_url ?? undefined,
    }
  }, [workspaceMembers, teamMembers, user, myProfile?.avatar_url])

  const assigneeOptions = useMemo(() => {
    const map = new Map(workspaceMembers.map((m) => [m.id, m]))
    if (mode === "edit" && task) {
      for (const a of task.assignees) {
        if (!map.has(a.id)) {
          map.set(a.id, {
            id: a.id,
            userId: a.id,
            name: a.name,
            initials: a.initials,
            color: a.color,
            avatarUrl: a.avatarUrl,
          })
        }
      }
    }
    return [...map.values()]
  }, [workspaceMembers, mode, task])

  const assigneesPayload = useMemo(() => {
    return assigneeIds
      .map((id) => teamById.get(id))
      .filter((m): m is TeamMember => Boolean(m))
      .map((m) => ({
        id: m.id,
        name: m.name,
        initials: m.initials,
        color: m.color,
        avatarUrl: m.avatarUrl,
      }))
  }, [assigneeIds, teamById])

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const addTag = () => {
    const t = tagDraft.trim()
    if (!t) return
    if (tags.includes(t)) {
      setTagDraft("")
      return
    }
    setTags((prev) => [...prev, t])
    setTagDraft("")
  }

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t))

  const postComment = () => {
    const text = commentDraft.trim()
    if (!text) return
    const me =
      workspaceMembers.find((m) => m.id === user?.id) ??
      teamMembers.find((m) => m.id === user?.id)
    const entry: CommentEntry = {
      id: makeId("c"),
      author:
        me?.name ??
        getFullNameFromMetadata(user?.user_metadata) ??
        user?.email?.split("@")[0] ??
        "You",
      initials: me?.initials ?? "YO",
      color: me?.color ?? "bg-primary/15 text-primary",
      avatarUrl: me?.avatarUrl,
      text,
      at: "just now",
    }
    setComments((prev) => [entry, ...prev])
    setCommentDraft("")
  }

  const addChecklistItem = () => {
    const text = checklistDraft.trim()
    if (!text) return
    setChecklist((prev) => [...prev, { id: makeId("cl"), text, done: false }])
    setChecklistDraft("")
  }

  const toggleChecklistItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    )
  }

  const removeChecklistItem = (id: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== id))
  }

  const save = () => {
    const trimmed = title.trim()
    if (!trimmed) {
      toast.error("Add a task title to continue.")
      return
    }
    const dueStored = formatDueForStorage(due)
    const overdueComputed = computeOverdue(dueStored)
    const taskComments: TaskComment[] = comments.map((c) => ({
      id: c.id,
      authorId: user?.id ?? "local",
      authorName: c.author,
      initials: c.initials,
      color: c.color,
      avatarUrl: c.avatarUrl,
      text: c.text,
      createdAt: Date.now(),
    }))
    const checklistDone = checklist.filter((c) => c.done).length
    const progressFromChecklist =
      checklist.length > 0 ? Math.round((checklistDone / checklist.length) * 100) : progress

    const payload: Omit<BoardTask, "id"> = {
      title: trimmed,
      description: description.trim(),
      columnId,
      tags,
      priority,
      due: dueStored,
      overdue: overdueComputed,
      comments: taskComments.length,
      attachments: task?.attachments ?? 0,
      assignees: assigneesPayload,
      progress: Math.min(100, Math.max(0, progressFromChecklist)),
      checklist,
      taskComments,
    }
    if (mode === "create") {
      addTask(boardId, payload)
      toast.success("Task created")
    } else if (task) {
      updateTask(boardId, task.id, payload)
      toast.success("Task updated")
    }
    onOpenChange(false)
  }

  const handleDelete = () => {
    if (!task) return
    removeTask(boardId, task.id)
    toast.success("Task deleted")
    onOpenChange(false)
  }

  const activePriority = PRIORITIES.find((p) => p.id === priority) ?? PRIORITIES[1]
  const activeColumn = COLUMNS.find((c) => c.id === columnId)?.label ?? columnId

  const activity = useMemo(() => {
    if (mode === "create" || !task) return []
    return buildTaskTimeline(
      {
        ...task,
        title: title.trim() || task.title,
        description: description.trim(),
        columnId,
        priority,
        due: formatDueForStorage(due),
        overdue: computeOverdue(formatDueForStorage(due)),
        assignees: assigneesPayload,
        checklist,
        taskComments: comments.map((c) => ({
          id: c.id,
          authorId: user?.id ?? "local",
          authorName: c.author,
          initials: c.initials,
          color: c.color,
          text: c.text,
          createdAt: Date.now(),
        })),
      },
      teamById
    )
  }, [
    mode,
    task,
    title,
    description,
    columnId,
    priority,
    due,
    assigneesPayload,
    checklist,
    comments,
    teamById,
    user?.id,
  ])

  return (
    <DialogContent
      showCloseButton={false}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 flex h-[100dvh] w-full max-w-none -translate-x-1/2 -translate-y-1/2",
        "flex-col gap-0 overflow-hidden rounded-none bg-card p-0 text-foreground shadow-2xl ring-1 ring-foreground/10",
        "sm:h-auto sm:max-h-[85vh] sm:max-w-[1100px] sm:rounded-2xl"
      )}
    >
        <DialogTitle className="sr-only">
          {mode === "create" ? "Create new task" : `Edit task ${task?.title ?? ""}`}
        </DialogTitle>
        <DialogDescription className="sr-only">
          A workspace panel to edit a task&apos;s details, assignees, status, and collaboration
          preferences.
        </DialogDescription>

        <header className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-card/95 px-4 py-3 sm:px-6">
          <span className="hidden items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline-flex">
            <Hash className="size-3" aria-hidden />
            {task ? shortId(task.id) : "NEW"}
          </span>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === "create" ? "Untitled task" : "Task title"}
              className="block w-full bg-transparent text-lg font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60 focus:placeholder:text-muted-foreground/40 sm:text-xl"
              aria-label="Task title"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 rounded-full"
            onClick={save}
          >
            <Check className="size-4" aria-hidden />
            <span className="hidden sm:inline">
              {mode === "create" ? "Create" : "Save"}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_340px]">
          <div className="flex min-h-0 flex-col overflow-y-auto bg-card px-4 py-5 sm:px-6 lg:border-r lg:border-border/60">
            <div className="space-y-6">
              <section className="space-y-2">
                <SectionLabel icon={Sparkles}>Description</SectionLabel>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does done look like? Add context, links, or acceptance criteria."
                  rows={5}
                  className="block w-full resize-y rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                />
              </section>

              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <SectionLabel icon={ListChecks}>Checklist</SectionLabel>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {checklist.filter((c) => c.done).length}/{checklist.length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {checklist.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-2 py-1.5"
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleChecklistItem(item.id)}
                        className="size-3.5 rounded border-border accent-primary"
                        aria-label={`Mark "${item.text}" done`}
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 text-sm",
                          item.done && "text-muted-foreground line-through"
                        )}
                      >
                        {item.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(item.id)}
                        className="rounded p-0.5 text-muted-foreground hover:text-rose-600"
                        aria-label="Remove checklist item"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input
                    value={checklistDraft}
                    onChange={(e) => setChecklistDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addChecklistItem()
                      }
                    }}
                    placeholder="Add checklist item"
                    className="h-8 flex-1 rounded-lg text-sm"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addChecklistItem}>
                    Add
                  </Button>
                </div>
              </section>

              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <SectionLabel icon={Tag}>Labels</SectionLabel>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {tags.length} attached
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="group inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground/80 shadow-sm transition-colors hover:border-rose-400/40 hover:text-rose-600"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100"
                        aria-label={`Remove ${t}`}
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addTag()
                        }
                      }}
                      placeholder="Add label"
                      className="h-7 w-32 rounded-full border-dashed text-[11px]"
                    />
                    {settings.labels.length > 0 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 rounded-full border-dashed px-2 text-[11px]"
                          >
                            <Plus className="mr-0.5 size-3" aria-hidden />
                            Pick
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {settings.labels.map((l) => (
                            <DropdownMenuItem
                              key={l.id}
                              onClick={() => {
                                if (!tags.includes(l.name)) setTags((p) => [...p, l.name])
                              }}
                            >
                              <span
                                className={cn(
                                  "mr-2 inline-block size-2 rounded-full",
                                  l.color.split(" ")[0]
                                )}
                                aria-hidden
                              />
                              {l.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <SectionLabel icon={Timer}>Progress</SectionLabel>
                  <span className="text-xs tabular-nums text-foreground">{progress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="w-full accent-primary"
                  aria-label="Progress"
                />
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-sky-500 transition-[width] duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <SectionLabel icon={MessageSquare}>Comments &amp; activity</SectionLabel>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {comments.length} comment{comments.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-background px-3 py-2.5">
                  <UserAvatar
                    name={commentComposerAvatar.name}
                    initials={commentComposerAvatar.initials}
                    avatarUrl={commentComposerAvatar.avatarUrl}
                    color={commentComposerAvatar.color}
                    size="sm"
                    className="mt-0.5"
                    ringClassName=""
                  />
                  <div className="min-w-0 flex-1">
                    <textarea
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          postComment()
                        }
                      }}
                      placeholder="Leave a comment, @mention a teammate…"
                      rows={2}
                      className="block w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70"
                    />
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        <CornerDownLeft className="mr-0.5 inline size-2.5" aria-hidden />
                        <kbd className="font-sans">⌘</kbd> + <kbd className="font-sans">Enter</kbd> to post
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 gap-1 rounded-full text-xs"
                        disabled={!commentDraft.trim()}
                        onClick={postComment}
                      >
                        <Send className="size-3" aria-hidden />
                        Comment
                      </Button>
                    </div>
                  </div>
                </div>

                <ul className="space-y-2.5">
                  {comments.map((c) => (
                    <li key={c.id} className="flex items-start gap-2.5">
                      <UserAvatar
                        name={c.author}
                        initials={c.initials}
                        avatarUrl={c.avatarUrl}
                        color={c.color}
                        size="sm"
                        className="mt-0.5"
                        ringClassName=""
                      />
                      <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {c.author}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {c.at}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm leading-relaxed text-foreground/90">{c.text}</p>
                      </div>
                    </li>
                  ))}
                  {comments.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-3 py-4 text-center text-xs text-muted-foreground">
                      No comments yet. Drop the first note above.
                    </li>
                  ) : null}
                </ul>

                {activity.length > 0 ? (
                  <div className="rounded-xl border border-border/60 bg-card/60 px-3 py-2.5">
                    <SectionLabel icon={Timer}>Activity</SectionLabel>
                    <ul className="mt-2 space-y-1.5">
                      {activity.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs">
                          <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", a.dot)} aria-hidden />
                          <span className="min-w-0 flex-1 leading-relaxed">
                            <span className="font-medium text-foreground">{a.label}</span>{" "}
                            <span className="text-muted-foreground">{a.detail}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{a.when}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <section className="space-y-2 rounded-xl border border-border/60 bg-card px-3 py-2.5">
                  <SectionLabel icon={Paperclip}>Attachments</SectionLabel>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/25"
                    onClick={() => toast.message("File picker is coming soon")}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Drop files or click to upload
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/25"
                    onClick={() => toast.message("Linked records are coming soon")}
                  >
                    <Link2 className="size-3.5" aria-hidden />
                    Link a related task or doc
                  </button>
              </section>
            </div>
          </div>

          <aside className="flex min-h-0 flex-col overflow-y-auto bg-muted/[0.18] px-4 py-5 sm:px-5">
            <div className="space-y-5">
              <section className="space-y-2">
                <SectionLabel icon={Bell}>Status</SectionLabel>
                <div
                  role="radiogroup"
                  aria-label="Task status"
                  className="grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-card/80 p-1"
                >
                  {COLUMNS.map((c) => {
                    const active = columnId === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        data-active={active}
                        onClick={() => setColumnId(c.id)}
                        className={cn(
                          "rounded-lg px-2 py-1.5 text-xs font-semibold transition-all duration-200",
                          c.tone,
                          active
                            ? "shadow-sm ring-1 ring-foreground/[0.06]"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <SectionLabel icon={AlertTriangle}>Priority</SectionLabel>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-full justify-between rounded-lg border-border/70 bg-card font-normal"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn("size-2 shrink-0 rounded-full", activePriority.dot)}
                          aria-hidden
                        />
                        {activePriority.id}
                      </span>
                      <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {PRIORITIES.map((p) => (
                      <DropdownMenuItem key={p.id} onClick={() => setPriority(p.id)}>
                        <span className={cn("mr-2 size-2 rounded-full", p.dot)} aria-hidden />
                        {p.id}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </section>

              <section className="space-y-2">
                <SectionLabel icon={Calendar}>Deadline</SectionLabel>
                <div className="relative">
                  <Calendar
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    type="date"
                    value={due}
                    onChange={(e) => {
                      setDue(e.target.value)
                      setOverdue(computeOverdue(e.target.value))
                    }}
                    className="h-9 rounded-lg border-border/70 bg-card pl-8"
                    aria-label="Due date"
                  />
                </div>
                {due ? (
                  <p
                    className={cn(
                      "text-xs",
                      overdue ? "font-medium text-rose-600" : "text-muted-foreground"
                    )}
                  >
                    {overdue ? "Overdue — " : "Due "}
                    {formatDueForDisplay(due)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">No due date set</p>
                )}
              </section>

              <TaskAssigneePicker
                  members={assigneeOptions}
                  isLoading={assigneesLoading}
                  assigneeIds={assigneeIds}
                  assigneeQuery={assigneeQuery}
                  onAssigneeQueryChange={setAssigneeQuery}
                  onToggleAssignee={toggleAssignee}
              />

              <section className="space-y-1.5">
                <SectionLabel icon={Bell}>Notifications</SectionLabel>
                <div className="rounded-xl border border-border/60 bg-card p-1.5">
                  <SidebarRow
                    label="Notify assignees"
                    hint="Ping members on changes."
                    control={
                      <Switch
                        checked={notifyAssignees}
                        onCheckedChange={setNotifyAssignees}
                        label="Notify assignees"
                      />
                    }
                  />
                  <SidebarRow
                    label="Remind before due"
                    hint="24-hour heads-up."
                    control={
                      <Switch
                        checked={notifyOnDue}
                        onCheckedChange={setNotifyOnDue}
                        label="Remind before due"
                      />
                    }
                  />
                </div>
              </section>

              <section className="space-y-1.5">
                <SectionLabel icon={Bot}>Automation</SectionLabel>
                <div className="rounded-xl border border-border/60 bg-card p-1.5">
                  <SidebarRow
                    label="Auto-move when overdue"
                    hint="Slide into Review at midnight."
                    control={
                      <Switch
                        checked={autoMoveOverdue}
                        onCheckedChange={setAutoMoveOverdue}
                        label="Auto-move when overdue"
                      />
                    }
                  />
                  <SidebarRow
                    label="Auto-complete at 100%"
                    hint="Move to Completed when progress hits 100."
                    control={
                      <Switch
                        checked={autoComplete}
                        onCheckedChange={(v) => {
                          setAutoComplete(v)
                          if (v && progress >= 100) setColumnId("completed")
                        }}
                        label="Auto-complete at 100%"
                      />
                    }
                  />
                </div>
                <p className="px-1 text-[11px] text-muted-foreground">
                  Defaults inherited from board settings.
                </p>
              </section>
            </div>
          </aside>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 bg-card/95 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            {mode === "edit" && task ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 rounded-full text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                onClick={handleDelete}
              >
                <Trash2 className="size-4" aria-hidden />
                <span className="hidden sm:inline">Delete task</span>
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5 rounded-full"
              onClick={save}
            >
              <Check className="size-4" aria-hidden />
              {mode === "create" ? "Create task" : "Save changes"}
            </Button>
          </div>
        </footer>
    </DialogContent>
  )
}
