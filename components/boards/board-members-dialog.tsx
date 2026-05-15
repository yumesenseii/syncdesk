"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Settings, ShieldCheck, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/ui/user-avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { WorkspaceEntity } from "@/lib/boards/types"
import { cn } from "@/lib/utils"
import { getWorkspaceMembers, useBoardsStore } from "@/stores/boards-store"

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
}

export function BoardMembersDialog({
  workspace,
  boardName,
  open,
  onOpenChange,
}: {
  workspace: WorkspaceEntity
  boardName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const teamMembers = useBoardsStore((s) => s.teamMembers)
  const members = useMemo(
    () => getWorkspaceMembers(workspace, teamMembers),
    [workspace, teamMembers]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b border-border/60 px-6 py-5 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="size-5 text-primary" aria-hidden />
            Board members
          </DialogTitle>
          <DialogDescription>
            Everyone on <span className="font-medium text-foreground">{workspace.name}</span> can
            access <span className="font-medium text-foreground">{boardName}</span>. Invite or manage
            people from the workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(50vh,360px)] overflow-y-auto px-6 py-4">
          {members.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              No workspace members yet. Invite teammates from the workspace page.
            </p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-3 py-2.5"
                >
                  <UserAvatar
                    name={m.name}
                    initials={m.initials}
                    avatarUrl={m.avatarUrl}
                    color={m.color}
                    size="md"
                    ringClassName=""
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                    {m.email ? (
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    ) : null}
                  </div>
                  {m.role ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {m.role === "owner" || m.role === "admin" ? (
                        <ShieldCheck className="size-3" aria-hidden />
                      ) : null}
                      {ROLE_LABEL[m.role] ?? m.role}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="rounded-full" asChild>
            <Link href={`/dashboard/workspaces/${workspace.slug}`}>Manage access</Link>
          </Button>
          <Button type="button" className="gap-1.5 rounded-full" asChild>
            <Link href={`/dashboard/workspaces/${workspace.slug}`}>
              <Settings className="size-4" aria-hidden />
              Workspace settings
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
