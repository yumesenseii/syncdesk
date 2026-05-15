"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ChevronRight,
  FolderKanban,
  Layers,
  Plus,
  Search,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useOpenCreateWorkspaceModal } from "@/components/workspaces/create-workspace-modal"
import { useBoardsStore, getWorkspaceStats } from "@/stores/boards-store"

export function WorkspaceSettingsList() {
  const workspaces = useBoardsStore((s) => s.workspaces)
  const tasksByBoardId = useBoardsStore((s) => s.tasksByBoardId)
  const teamMembers = useBoardsStore((s) => s.teamMembers)
  const openCreateWorkspace = useOpenCreateWorkspaceModal()

  const [query, setQuery] = useState("")

  const teamById = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return workspaces
    return workspaces.filter((w) => w.name.toLowerCase().includes(q))
  }, [query, workspaces])

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Settings
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Workspace settings
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Manage every workspace you own — rename, change the icon, manage members and delete.
          Choose a workspace below to drill in.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces…"
            className="h-10 border-border/80 bg-background/80 pl-9 shadow-sm"
            aria-label="Search workspaces"
          />
        </div>
        <Button type="button" onClick={() => openCreateWorkspace()} className="gap-1.5">
          <Plus className="size-4" aria-hidden />
          New workspace
        </Button>
      </div>

      <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
        <CardHeader className="px-5 pb-2 pt-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="size-4" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">Workspaces</CardTitle>
              <CardDescription>
                {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"} · click to manage.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            workspaces.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Layers className="size-5" aria-hidden />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Create your first workspace
                  </p>
                  <p className="max-w-md text-xs text-muted-foreground">
                    Workspaces hold boards, tasks and the teammates you collaborate with.
                  </p>
                </div>
                <Button type="button" onClick={() => openCreateWorkspace()} className="gap-1.5">
                  <Plus className="size-4" aria-hidden />
                  New workspace
                </Button>
              </div>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                No workspaces match &ldquo;{query}&rdquo;.
              </p>
            )
          ) : (
            <ul className="divide-y divide-border/60" role="list">
              {filtered.map((ws) => {
                const stats = getWorkspaceStats(ws, tasksByBoardId, teamById)
                return (
                  <li key={ws.id}>
                    <Link
                      href={`/dashboard/settings/workspace/${ws.slug}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"
                    >
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-base"
                        aria-hidden
                      >
                        {ws.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{ws.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {stats.boardCount} board{stats.boardCount === 1 ? "" : "s"} ·{" "}
                          {stats.totalTasks} task{stats.totalTasks === 1 ? "" : "s"}
                          {stats.overdueTasks > 0 ? (
                            <span className="ml-1 text-rose-600">
                              · {stats.overdueTasks} overdue
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="hidden w-32 shrink-0 sm:block">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-sky-500"
                            style={{ width: `${stats.progressPct}%` }}
                          />
                        </div>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
        <CardHeader className="px-5 pb-2 pt-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
              <FolderKanban className="size-4" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Need to manage boards inside a workspace?
              </CardTitle>
              <CardDescription>
                Use the Boards page for inline rename, duplicate and delete actions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/boards">Open Boards</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
