"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { FileText, KanbanSquare, LayoutGrid, Users } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { cn } from "@/lib/utils"
import { useBoardsStore } from "@/stores/boards-store"

type Hit =
  | { type: "workspace"; id: string; label: string; sub: string; href: string }
  | { type: "board"; id: string; label: string; sub: string; href: string }
  | { type: "task"; id: string; label: string; sub: string; href: string }
  | { type: "member"; id: string; label: string; sub: string }

export function DashboardSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [q, setQ] = useState("")
  const debounced = useDebouncedValue(q, 220)

  const workspaces = useBoardsStore((s) => s.workspaces)
  const boardsById = useBoardsStore((s) => s.boardsById)
  const tasksByBoardId = useBoardsStore((s) => s.tasksByBoardId)
  const teamMembers = useBoardsStore((s) => s.teamMembers)

  const hits = useMemo(() => {
    const term = debounced.trim().toLowerCase()
    const out: Hit[] = []
    if (!term) return out

    const workspaceById = new Map(workspaces.map((w) => [w.id, w] as const))

    for (const w of workspaces) {
      if (w.name.toLowerCase().includes(term)) {
        const first = w.boardIds[0]
        out.push({
          type: "workspace",
          id: w.id,
          label: w.name,
          sub: "Workspace",
          href: first ? `/dashboard/boards/${w.slug}/${first}` : "/dashboard/boards",
        })
      }
    }

    for (const b of Object.values(boardsById)) {
      const ws = workspaceById.get(b.workspaceId)
      if (
        b.name.toLowerCase().includes(term) ||
        (b.description && b.description.toLowerCase().includes(term))
      ) {
        out.push({
          type: "board",
          id: b.id,
          label: b.name,
          sub: ws?.name ?? "Workspace",
          href: ws ? `/dashboard/boards/${ws.slug}/${b.id}` : "/dashboard/boards",
        })
      }
    }

    for (const [boardId, tasks] of Object.entries(tasksByBoardId)) {
      const b = boardsById[boardId]
      if (!b) continue
      const ws = workspaceById.get(b.workspaceId)
      for (const t of tasks) {
        if (
          t.title.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term) ||
          t.tags.some((tag) => tag.toLowerCase().includes(term))
        ) {
          out.push({
            type: "task",
            id: `${boardId}-${t.id}`,
            label: t.title,
            sub: b.name,
            href: ws ? `/dashboard/boards/${ws.slug}/${b.id}` : "/dashboard/boards",
          })
        }
      }
    }

    for (const m of teamMembers) {
      if (m.name.toLowerCase().includes(term) || m.initials.toLowerCase().includes(term)) {
        out.push({
          type: "member",
          id: m.id,
          label: m.name,
          sub: "Team member",
        })
      }
    }

    return out.slice(0, 40)
  }, [boardsById, debounced, tasksByBoardId, teamMembers, workspaces])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton>
        <DialogHeader className="border-b border-border/60 px-4 py-3 text-left">
          <DialogTitle className="text-base">Search SyncDesk</DialogTitle>
          <DialogDescription className="text-xs">
            Tasks, boards, workspaces, and team members.
          </DialogDescription>
        </DialogHeader>
        <div className="px-3 pb-2 pt-3">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type to filter…"
            className="h-10"
            aria-label="Search query"
          />
        </div>
        <div className="max-h-[min(60vh,22rem)] overflow-y-auto px-2 pb-3">
          {!debounced.trim() ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Start typing to find anything in your workspace.
            </p>
          ) : hits.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No matches for &ldquo;{debounced.trim()}&rdquo;.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {hits.map((h) => (
                <li key={`${h.type}-${h.id}`}>
                  {h.type === "member" ? (
                    <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm">
                      <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{h.label}</div>
                        <div className="truncate text-xs text-muted-foreground">{h.sub}</div>
                      </div>
                    </div>
                  ) : (
                    <Link
                      href={h.href}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted/60"
                      )}
                    >
                      {h.type === "workspace" ? (
                        <LayoutGrid className="size-4 shrink-0 text-primary" aria-hidden />
                      ) : h.type === "board" ? (
                        <KanbanSquare className="size-4 shrink-0 text-primary" aria-hidden />
                      ) : (
                        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{h.label}</div>
                        <div className="truncate text-xs text-muted-foreground">{h.sub}</div>
                      </div>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
