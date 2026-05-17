"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ChevronRight, MoreHorizontal, Plus, Share2, Users } from "lucide-react"
import { toast } from "sonner"

import { BoardActionsMenu } from "@/components/boards/board-actions-menu"
import { BoardMembersDialog } from "@/components/boards/board-members-dialog"
import { BoardSettingsDialog } from "@/components/boards/board-settings-dialog"
import { BoardShareDialog } from "@/components/boards/board-share-dialog"
import { BoardTaskDialog } from "@/components/boards/board-task-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserAvatar } from "@/components/ui/user-avatar"
import { useWorkspaceMembersList } from "@/hooks/use-workspace-members"
import type { BoardMeta, TeamMember, WorkspaceEntity } from "@/lib/boards/types"
import { cn } from "@/lib/utils"
import { useBoardsStore } from "@/stores/boards-store"

const MAX_AVATARS = 4

function MemberAvatars({ members }: { members: TeamMember[] }) {
  if (members.length === 0) return null
  const visible = members.slice(0, MAX_AVATARS)
  const rest = Math.max(0, members.length - visible.length)
  return (
    <div className="flex items-center" aria-label={`${members.length} active members`}>
      <div className="flex -space-x-1.5">
        {visible.map((m) => (
          <UserAvatar
            key={m.id}
            name={m.name}
            initials={m.initials}
            avatarUrl={m.avatarUrl}
            color={m.color}
            size="sm"
            className="transition-transform duration-200 ease-out hover:z-10 hover:-translate-y-0.5"
            ringClassName="ring-2 ring-card"
          />
        ))}
        {rest > 0 ? (
          <div
            className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card"
            title={`${rest} more member${rest === 1 ? "" : "s"}`}
            aria-label={`${rest} more members`}
          >
            +{rest}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function BoardHeader({
  board,
  workspace,
}: {
  board: BoardMeta
  workspace: WorkspaceEntity
}) {
  const router = useRouter()
  const renameBoard = useBoardsStore((s) => s.renameBoard)
  const updateBoardMeta = useBoardsStore((s) => s.updateBoardMeta)
  const deleteBoard = useBoardsStore((s) => s.deleteBoard)

  const { members, isLoading: membersLoading, isError: membersError, error: membersLoadError } =
    useWorkspaceMembersList(workspace.id)

  const [membersOpen, setMembersOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [newTaskOpen, setNewTaskOpen] = useState(false)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(board.name)
  const [descriptionValue, setDescriptionValue] = useState(board.description ?? "")

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <section
      aria-label={`${board.name} header`}
      className="sticky top-0 z-30 -mx-4 space-y-3 border-b border-border/60 bg-background/85 px-4 pb-4 pt-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 text-[13px]"
      >
        <Link
          href="/dashboard/boards"
          className="font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Boards
        </Link>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
        <span className="max-w-[10rem] truncate text-muted-foreground sm:max-w-xs">
          <span className="mr-1" aria-hidden>
            {workspace.icon}
          </span>
          {workspace.name}
        </span>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
        <span className="max-w-[12rem] truncate font-medium text-foreground sm:max-w-md">
          {board.name}
        </span>
      </nav>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="min-w-0 space-y-2"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {board.name}
            </h1>
            <MemberAvatars members={members} />
          </div>
          {board.description ? (
            <p className="line-clamp-1 text-sm text-muted-foreground">{board.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground/80">No description yet.</p>
          )}
        </motion.div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-nowrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden h-9 gap-1.5 rounded-full border-border/70 bg-background/80 sm:inline-flex"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="size-4" aria-hidden />
            <span className="hidden md:inline">Share</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="hidden h-9 gap-1.5 rounded-full border-primary/30 bg-primary/[0.06] text-primary hover:bg-primary/[0.12] sm:inline-flex"
            onClick={() => setMembersOpen(true)}
          >
            <Users className="size-4" aria-hidden />
            <span className="hidden md:inline">Members</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5 rounded-full"
            onClick={() => setNewTaskOpen(true)}
          >
            <Plus className="size-4" aria-hidden />
            New task
          </Button>

          <BoardActionsMenu
            board={board}
            workspace={workspace}
            onMembers={() => setMembersOpen(true)}
            onShare={() => setShareOpen(true)}
            onRename={() => {
              setRenameValue(board.name)
              setDescriptionValue(board.description ?? "")
              setRenameOpen(true)
            }}
            onSettings={() => setSettingsOpen(true)}
            onDelete={() => setDeleteOpen(true)}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-full text-muted-foreground hover:text-foreground"
                aria-label="More board actions"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            }
          />
        </div>
      </div>

      <BoardMembersDialog
        workspace={workspace}
        boardName={board.name}
        members={members}
        isLoading={membersLoading}
        loadError={membersError ? membersLoadError?.message : null}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />

      <BoardShareDialog
        boardName={board.name}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />

      <BoardTaskDialog
        boardId={board.id}
        task={null}
        mode="create"
        defaultColumn={board.settings?.defaultColumn ?? "todo"}
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
      />

      <BoardSettingsDialog
        board={board}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename board</DialogTitle>
            <DialogDescription>Update the board name and short description.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="rename-name">Name</Label>
              <Input
                id="rename-name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rename-description">Description</Label>
              <Input
                id="rename-description"
                value={descriptionValue}
                onChange={(e) => setDescriptionValue(e.target.value)}
                placeholder="Short context for the board"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (renameValue.trim()) renameBoard(board.id, renameValue)
                updateBoardMeta(board.id, { description: descriptionValue })
                setRenameOpen(false)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete board?</DialogTitle>
            <DialogDescription>
              This removes &quot;{board.name}&quot; and all of its tasks. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                deleteBoard(board.id)
                setDeleteOpen(false)
                toast.success("Board deleted")
                router.push("/dashboard/boards")
              }}
            >
              Delete board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
