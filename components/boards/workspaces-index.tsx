"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import {
  ChevronRight,
  ExternalLink,
  FolderOpen,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"

import { useOpenCreateWorkspaceModal } from "@/components/workspaces/create-workspace-modal"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/ui/user-avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { BoardMeta, BoardTask, TeamMember, WorkspaceEntity } from "@/lib/boards/types"
import { cn } from "@/lib/utils"
import { getWorkspaceStats, useBoardsStore } from "@/stores/boards-store"

function WorkspacePanel({
  workspace,
  boardsById,
  tasksByBoardId,
  teamById,
  query,
}: {
  workspace: WorkspaceEntity
  boardsById: Record<string, BoardMeta>
  tasksByBoardId: Record<string, BoardTask[]>
  teamById: Map<string, TeamMember>
  query: string
}) {
  const toggleExpanded = useBoardsStore((s) => s.toggleWorkspaceExpanded)
  const renameWorkspace = useBoardsStore((s) => s.renameWorkspace)
  const deleteWorkspace = useBoardsStore((s) => s.deleteWorkspace)
  const renameBoard = useBoardsStore((s) => s.renameBoard)
  const deleteBoard = useBoardsStore((s) => s.deleteBoard)

  const [renameWsOpen, setRenameWsOpen] = useState(false)
  const [renameWsValue, setRenameWsValue] = useState(workspace.name)
  const [deleteWsOpen, setDeleteWsOpen] = useState(false)
  const [renameBoardOpen, setRenameBoardOpen] = useState<string | null>(null)
  const [renameBoardValue, setRenameBoardValue] = useState("")

  const stats = useMemo(
    () => getWorkspaceStats(workspace, tasksByBoardId, teamById),
    [workspace, tasksByBoardId, teamById]
  )

  const boards = useMemo(
    () =>
      workspace.boardIds.map((id) => boardsById[id]).filter(Boolean) as BoardMeta[],
    [workspace.boardIds, boardsById]
  )

  const q = query.trim().toLowerCase()
  const showBoards = useMemo(() => {
    if (!q) return boards
    if (workspace.name.toLowerCase().includes(q)) return boards
    return boards.filter((b) => b.name.toLowerCase().includes(q))
  }, [boards, q, workspace.name])

  return (
    <motion.article
      layout
      className="overflow-hidden rounded-2xl border border-border/60 bg-card ring-1 ring-foreground/[0.04] transition-[box-shadow,border-color] duration-200 ease-out hover:border-border hover:shadow-md hover:shadow-foreground/[0.03]"
    >
      <div className="group/header relative flex items-stretch border-b border-border/50 bg-muted/[0.15] transition-colors hover:bg-muted/[0.22]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggleExpanded(workspace.id)
          }}
          className="my-3 ml-3 flex size-8 shrink-0 items-center justify-center self-start rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground sm:ml-4"
          aria-expanded={workspace.expanded}
          aria-label={workspace.expanded ? "Collapse boards" : "Expand boards"}
        >
          <motion.span
            animate={{ rotate: workspace.expanded ? 90 : 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <ChevronRight className="size-4" aria-hidden />
          </motion.span>
        </button>

        <Link
          href={`/dashboard/workspaces/${workspace.slug}`}
          aria-label={`Open ${workspace.name} workspace overview`}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-xl" aria-hidden>
                {workspace.icon}
              </span>
              <div className="min-w-0">
                <h2 className="flex min-w-0 items-center gap-1.5 text-base font-semibold tracking-tight text-foreground">
                  <span className="truncate">{workspace.name}</span>
                  <ExternalLink
                    className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/header:opacity-100"
                    aria-hidden
                  />
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">{stats.boardCount}</span> boards
                  </span>
                  <span>
                    <span className="font-medium text-foreground">{stats.totalTasks}</span> tasks
                  </span>
                  {stats.overdueTasks > 0 ? (
                    <span className="font-medium text-rose-600">{stats.overdueTasks} overdue</span>
                  ) : (
                    <span>No overdue</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1">
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                  {stats.progressPct}%
                </span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:w-24">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-sky-500"
                    style={{ width: `${stats.progressPct}%` }}
                  />
                </div>
              </div>
              <div className="flex -space-x-1.5">
                {stats.members.slice(0, 4).map((m) => (
                  <UserAvatar
                    key={m.id}
                    name={m.name}
                    initials={m.initials}
                    avatarUrl={m.avatarUrl}
                    color={m.color}
                    size="sm"
                    className="ring-2 ring-card"
                    ringClassName=""
                  />
                ))}
              </div>
            </div>
          </div>
        </Link>

        <div
          className="my-3 mr-3 flex shrink-0 items-center self-start sm:mr-4"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label="Workspace actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => {
                  setRenameWsValue(workspace.name)
                  setRenameWsOpen(true)
                }}
              >
                <Pencil className="mr-2 size-4" aria-hidden />
                Rename workspace
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-600 focus:text-rose-600"
                onClick={() => setDeleteWsOpen(true)}
              >
                <Trash2 className="mr-2 size-4" aria-hidden />
                Delete workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {workspace.expanded ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <ul className="divide-y divide-border/50 px-2 py-1 sm:px-3">
              {showBoards.map((board) => (
                <li key={board.id}>
                  <div className="group flex items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-muted/30">
                    <FolderOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <Link
                      href={`/dashboard/boards/${workspace.slug}/${board.id}`}
                      className="min-w-0 flex-1 py-0.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
                    >
                      <span className="block truncate">{board.name}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {(tasksByBoardId[board.id] ?? []).length} tasks
                      </span>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label={`Actions for ${board.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => {
                            setRenameBoardOpen(board.id)
                            setRenameBoardValue(board.name)
                          }}
                        >
                          Rename board
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-rose-600 focus:text-rose-600"
                          onClick={() => deleteBoard(board.id)}
                        >
                          Delete board
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <LayoutGrid className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                  </div>
                </li>
              ))}
              {showBoards.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No boards yet — create one with the button above.
                </li>
              ) : null}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Dialog open={renameWsOpen} onOpenChange={setRenameWsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
            <DialogDescription>Update how this folder appears on the Boards page.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="ws-name">Name</Label>
            <Input
              id="ws-name"
              value={renameWsValue}
              onChange={(e) => setRenameWsValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameWsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                renameWorkspace(workspace.id, renameWsValue)
                setRenameWsOpen(false)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteWsOpen} onOpenChange={setDeleteWsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workspace?</DialogTitle>
            <DialogDescription>
              This removes &quot;{workspace.name}&quot; and all boards and tasks inside it. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteWsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                deleteWorkspace(workspace.id)
                setDeleteWsOpen(false)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameBoardOpen)} onOpenChange={(o) => !o && setRenameBoardOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename board</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="board-name">Name</Label>
            <Input
              id="board-name"
              value={renameBoardValue}
              onChange={(e) => setRenameBoardValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameBoardOpen(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (renameBoardOpen) renameBoard(renameBoardOpen, renameBoardValue)
                setRenameBoardOpen(null)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.article>
  )
}

export function WorkspacesIndex() {
  const workspaces = useBoardsStore((s) => s.workspaces)
  const boardsById = useBoardsStore((s) => s.boardsById)
  const tasksByBoardId = useBoardsStore((s) => s.tasksByBoardId)
  const teamMembers = useBoardsStore((s) => s.teamMembers)
  const createBoard = useBoardsStore((s) => s.createBoard)
  const openCreateWorkspace = useOpenCreateWorkspaceModal()

  const [query, setQuery] = useState("")
  const [boardDialog, setBoardDialog] = useState(false)
  const [newBoardName, setNewBoardName] = useState("")
  const [newBoardWsId, setNewBoardWsId] = useState(workspaces[0]?.id ?? "")

  const teamById = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers])

  const orderedWorkspaces = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return workspaces
    return workspaces.filter((ws) => {
      if (ws.name.toLowerCase().includes(q)) return true
      return ws.boardIds.some((id) => (boardsById[id]?.name ?? "").toLowerCase().includes(q))
    })
  }, [workspaces, boardsById, query])

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Workspace intelligence</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Boards</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Organize work into folders and dedicated Kanban boards. Open any board for full task
            management.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:justify-end">
          <div className="relative min-w-0 flex-1 sm:max-w-xs lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workspaces and boards…"
              className="h-10 rounded-full border-border/70 bg-background/80 pl-9 shadow-sm"
              aria-label="Search boards"
            />
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-border/70"
              onClick={() => openCreateWorkspace()}
            >
              <Plus className="mr-1.5 size-4" aria-hidden />
              Workspace
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full"
              onClick={() => {
                setNewBoardName("")
                setNewBoardWsId(workspaces[0]?.id ?? "")
                setBoardDialog(true)
              }}
              disabled={workspaces.length === 0}
            >
              <Plus className="mr-1.5 size-4" aria-hidden />
              Board
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {orderedWorkspaces.length === 0 ? (
          workspaces.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/10 px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <LayoutGrid className="size-6" aria-hidden />
              </div>
              <p className="text-base font-semibold text-foreground">No workspaces yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Create your first workspace to start organizing boards, tasks and your team. Everything below — analytics, activity, calendar — populates from your real work.
              </p>
              <Button
                type="button"
                className="mt-1 h-9 rounded-full"
                onClick={() => openCreateWorkspace()}
              >
                <Plus className="mr-1.5 size-4" aria-hidden />
                Create workspace
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 px-6 py-16 text-center">
              <p className="text-sm font-medium text-foreground">No workspaces match your search.</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another query or clear the search field.</p>
            </div>
          )
        ) : (
          orderedWorkspaces.map((ws) => (
            <WorkspacePanel
              key={ws.id}
              workspace={ws}
              boardsById={boardsById}
              tasksByBoardId={tasksByBoardId}
              teamById={teamById}
              query={query}
            />
          ))
        )}
      </div>

      <Dialog open={boardDialog} onOpenChange={setBoardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New board</DialogTitle>
            <DialogDescription>Add a Kanban board inside a workspace.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="nb-ws">Workspace</Label>
              <select
                id="nb-ws"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                value={
                  workspaces.some((w) => w.id === newBoardWsId)
                    ? newBoardWsId
                    : (workspaces[0]?.id ?? "")
                }
                onChange={(e) => setNewBoardWsId(e.target.value)}
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.icon} {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nb-name">Board name</Label>
              <Input
                id="nb-name"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="e.g. UI/UX Board"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBoardDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const wsId = workspaces.some((w) => w.id === newBoardWsId)
                  ? newBoardWsId
                  : (workspaces[0]?.id ?? "")
                if (wsId) void createBoard(wsId, newBoardName)
                setBoardDialog(false)
              }}
            >
              Create board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
