"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

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
import { useBoardsStore } from "@/stores/boards-store"

export function CreateBoardDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  workspaceSlug,
  navigateToBoard = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  /** When true, navigate to the new board after creation. */
  navigateToBoard?: boolean
}) {
  const router = useRouter()
  const createBoard = useBoardsStore((s) => s.createBoard)
  const [boardName, setBoardName] = useState("")

  async function handleCreate() {
    const trimmed = boardName.trim()
    if (!trimmed) {
      toast.error("Give the board a name first.")
      return
    }
    const boardId = await createBoard(workspaceId, trimmed)
    if (!boardId) return
    toast.success(`Board “${trimmed}” created.`)
    setBoardName("")
    onOpenChange(false)
    if (navigateToBoard) {
      router.push(`/dashboard/boards/${workspaceSlug}/${boardId}`)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setBoardName("")
      }}
    >
      <DialogContent className="max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>New board</DialogTitle>
          <DialogDescription>
            Add a Kanban board to <span className="font-medium text-foreground">{workspaceName}</span>.
            Tasks are created inside boards, not at the workspace level.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="create-board-name">Board name</Label>
          <Input
            id="create-board-name"
            autoFocus
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            placeholder="e.g. Sprint 14"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void handleCreate()
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleCreate()}>
            Create board
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
