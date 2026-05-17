"use client"

import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
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
import type { TeamMember, WorkspaceEntity } from "@/lib/boards/types"
import { cn } from "@/lib/utils"

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
}

function MembersListSkeleton() {
  return (
    <ul className="space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex animate-pulse items-center gap-3 rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5"
        >
          <div className="size-9 shrink-0 rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-28 rounded bg-muted" />
            <div className="h-2.5 w-36 rounded bg-muted/80" />
          </div>
          <div className="h-5 w-14 rounded-full bg-muted" />
        </li>
      ))}
    </ul>
  )
}

export function BoardMembersDialog({
  workspace,
  boardName,
  members,
  isLoading,
  loadError,
  open,
  onOpenChange,
}: {
  workspace: WorkspaceEntity
  boardName: string
  members: TeamMember[]
  isLoading: boolean
  loadError?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const showEmpty = !isLoading && !loadError && members.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b border-border/60 px-6 py-5 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="size-5 text-primary" aria-hidden />
            Board members
            {!isLoading && members.length > 0 ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {members.length}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Everyone on <span className="font-medium text-foreground">{workspace.name}</span> can
            access <span className="font-medium text-foreground">{boardName}</span>. Members are
            synced from this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(50vh,360px)] overflow-y-auto px-6 py-4">
          {isLoading ? (
            <MembersListSkeleton />
          ) : loadError ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-4 py-6 text-center text-sm text-rose-700 dark:text-rose-300">
              {loadError}
            </p>
          ) : showEmpty ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              No workspace members yet. Invite teammates from the workspace page.
            </p>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {members.map((m) => (
                  <motion.li
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
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
                      ) : (
                        <p className="truncate text-xs text-muted-foreground/70">No email on file</p>
                      )}
                    </div>
                    {m.role ? (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                        )}
                      >
                        {m.role === "owner" || m.role === "admin" ? (
                          <ShieldCheck className="size-3" aria-hidden />
                        ) : null}
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    ) : null}
                  </motion.li>
                ))}
              </AnimatePresence>
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
