"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  FolderKanban,
  Layers,
  Save,
  Settings as SettingsIcon,
  Trash2,
  Mail,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Switch } from "@/components/ui/switch"
import {
  getWorkspaceByIdOrSlug,
  getWorkspaceMembers,
  getWorkspaceStats,
  useBoardsStore,
} from "@/stores/boards-store"
import { cn } from "@/lib/utils"

const ICON_PRESETS = ["📂", "🚀", "🎓", "🧠", "🎨", "🛠️", "📚", "💡", "📈", "🌐", "🎯", "🌱"] as const

const NOTIFY_KEY = "syncdesk:workspace-notifications"

type WorkspaceNotificationPrefs = Record<
  string,
  { mentions: boolean; assignments: boolean; deadlines: boolean }
>

const DEFAULT_NOTIFY = { mentions: true, assignments: true, deadlines: true }

function readNotificationPrefs(): WorkspaceNotificationPrefs {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(window.localStorage.getItem(NOTIFY_KEY) ?? "{}") as WorkspaceNotificationPrefs
  } catch {
    return {}
  }
}

export function WorkspaceSettingsDetail({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()

  const workspaces = useBoardsStore((s) => s.workspaces)
  const workspace = useMemo(
    () => getWorkspaceByIdOrSlug(workspaces, workspaceId),
    [workspaces, workspaceId]
  )
  const boardsById = useBoardsStore((s) => s.boardsById)
  const tasksByBoardId = useBoardsStore((s) => s.tasksByBoardId)
  const teamMembers = useBoardsStore((s) => s.teamMembers)
  const updateWorkspace = useBoardsStore((s) => s.updateWorkspace)
  const deleteWorkspace = useBoardsStore((s) => s.deleteWorkspace)

  const [name, setName] = useState(workspace?.name ?? "")
  const [icon, setIcon] = useState(workspace?.icon ?? "📂")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notifyPrefs, setNotifyPrefs] = useState(DEFAULT_NOTIFY)
  const [prefsHydrated, setPrefsHydrated] = useState(false)
  const [lastWsId, setLastWsId] = useState(workspace?.id ?? null)
  const [lastNotifyKey, setLastNotifyKey] = useState<string | null>(null)

  if (workspace && workspace.id !== lastWsId) {
    setLastWsId(workspace.id)
    setName(workspace.name)
    setIcon(workspace.icon)
  }

  if (lastNotifyKey !== workspaceId) {
    setLastNotifyKey(workspaceId)
    queueMicrotask(() => {
      const prefs = readNotificationPrefs()
      setNotifyPrefs(prefs[workspaceId] ?? DEFAULT_NOTIFY)
      setPrefsHydrated(true)
    })
  }

  useEffect(() => {
    if (!prefsHydrated) return
    try {
      const stored = readNotificationPrefs()
      stored[workspaceId] = notifyPrefs
      window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(stored))
    } catch {
      /* ignore storage errors */
    }
  }, [notifyPrefs, prefsHydrated, workspaceId])

  const teamById = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers])

  const stats = useMemo(() => {
    if (!workspace) return null
    return getWorkspaceStats(workspace, tasksByBoardId, teamById)
  }, [tasksByBoardId, teamById, workspace])

  const boards = useMemo(() => {
    if (!workspace) return []
    return workspace.boardIds
      .map((id) => boardsById[id])
      .filter((b): b is NonNullable<typeof b> => Boolean(b))
  }, [boardsById, workspace])

  const currentMembers = useMemo(
    () => (workspace ? getWorkspaceMembers(workspace, teamMembers) : []),
    [workspace, teamMembers]
  )

  if (!workspace) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Settings
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Workspace not found
          </h1>
        </header>
        <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
          <CardContent className="space-y-4 px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              This workspace might have been deleted, or the ID is invalid.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/settings/workspace">Back to all workspaces</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const nameDirty = name.trim() !== workspace.name.trim() && name.trim().length > 0
  const iconDirty = icon.trim() !== workspace.icon.trim() && icon.trim().length > 0
  const dirty = nameDirty || iconDirty

  const onSave = () => {
    const patch: { name?: string; icon?: string } = {}
    if (nameDirty) patch.name = name.trim()
    if (iconDirty) patch.icon = icon.trim()
    if (Object.keys(patch).length === 0) return
    updateWorkspace(workspaceId, patch)
    toast.success("Workspace updated.")
  }

  const onReset = () => {
    setName(workspace.name)
    setIcon(workspace.icon)
  }

  const onDelete = () => {
    setDeleting(true)
    try {
      deleteWorkspace(workspaceId)
      toast.success(`“${workspace.name}” deleted.`)
      router.replace("/dashboard/settings/workspace")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link href="/dashboard/settings/workspace" className="hover:text-foreground">
            Workspace settings
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <span className="text-foreground">{workspace.name}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              <span aria-hidden>{workspace.icon}</span> {workspace.name}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {stats?.boardCount ?? 0} board{stats?.boardCount === 1 ? "" : "s"} ·{" "}
              {stats?.totalTasks ?? 0} task{stats?.totalTasks === 1 ? "" : "s"} ·{" "}
              {stats?.progressPct ?? 0}% complete
              {stats && stats.overdueTasks > 0 ? (
                <span className="text-rose-600"> · {stats.overdueTasks} overdue</span>
              ) : null}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/boards">Open boards</Link>
            </Button>
          </div>
        </div>
      </header>

      <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
        <CardHeader className="px-5 pb-2 pt-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SettingsIcon className="size-4" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">General</CardTitle>
              <CardDescription>Rename the workspace and choose a recognizable icon.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-5 pb-5 pt-2">
          <div className="grid gap-2">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ws-icon">Icon</Label>
            <div className="flex items-center gap-3">
              <Input
                id="ws-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                className="w-20 text-center"
              />
              <div className="flex flex-wrap gap-1.5">
                {ICON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setIcon(preset)}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md border border-border/60 text-base transition-colors hover:bg-muted/60",
                      icon === preset && "border-primary bg-primary/10"
                    )}
                    aria-label={`Use ${preset}`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
        <CardHeader className="px-5 pb-2 pt-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
              <Users className="size-4" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">Members</CardTitle>
              <CardDescription>
                Workspace members can access every board. Invite people from the workspace page.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-5 pb-5 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {currentMembers.length === 0 ? (
              <span className="text-xs text-muted-foreground">No members yet.</span>
            ) : null}
            {currentMembers.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2 py-1 text-xs"
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                    m.color
                  )}
                >
                  {m.initials}
                </span>
                {m.name}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            <Button type="button" variant="outline" className="w-full gap-2 sm:w-auto" asChild>
              <Link href={`/dashboard/workspaces/${workspace.slug}`}>
                <Mail className="size-4" aria-hidden />
                Invite by email
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
          <CardHeader className="px-5 pb-2 pt-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700">
                <Bell className="size-4" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">
                  Notifications
                </CardTitle>
                <CardDescription>
                  Preferences for this workspace — saved to this device.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5 pt-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Mentions</p>
                <p className="text-xs text-muted-foreground">Ping me when I’m @-mentioned.</p>
              </div>
              <Switch
                checked={notifyPrefs.mentions}
                onCheckedChange={(v) => setNotifyPrefs((p) => ({ ...p, mentions: v }))}
                label="Mentions"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Assignments</p>
                <p className="text-xs text-muted-foreground">Alert me on new task assignments.</p>
              </div>
              <Switch
                checked={notifyPrefs.assignments}
                onCheckedChange={(v) => setNotifyPrefs((p) => ({ ...p, assignments: v }))}
                label="Assignments"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Deadline alerts</p>
                <p className="text-xs text-muted-foreground">Notify me before deadlines slip.</p>
              </div>
              <Switch
                checked={notifyPrefs.deadlines}
                onCheckedChange={(v) => setNotifyPrefs((p) => ({ ...p, deadlines: v }))}
                label="Deadline alerts"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
          <CardHeader className="px-5 pb-2 pt-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500/10 text-fuchsia-600">
                <FolderKanban className="size-4" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">Boards</CardTitle>
                <CardDescription>
                  Quickly open any board for inline rename, duplicate or delete.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {boards.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                No boards yet — create one from the Boards page.
              </p>
            ) : (
              <ul className="divide-y divide-border/60" role="list">
                {boards.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/dashboard/boards/${workspace.slug}/${b.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                    >
                      <Layers className="size-4 text-muted-foreground" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(tasksByBoardId[b.id] ?? []).length} task
                          {(tasksByBoardId[b.id] ?? []).length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-rose-500/30 bg-card shadow-sm shadow-rose-500/[0.04]">
        <CardHeader className="px-5 pb-2 pt-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <AlertTriangle className="size-4" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight text-rose-700">
                Danger zone
              </CardTitle>
              <CardDescription>
                Deleting a workspace removes every board and task inside it.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5 pt-2">
          <p className="text-sm text-muted-foreground">
            This action is irreversible. Make sure you’ve exported anything important.
          </p>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            className="gap-1.5"
          >
            <Trash2 className="size-4" aria-hidden />
            Delete workspace
          </Button>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border border-border/70 bg-card/95 px-3 py-2 shadow-lg backdrop-blur transition-opacity",
            dirty ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <span className="text-xs font-medium text-muted-foreground">Unsaved changes</span>
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            Reset
          </Button>
          <Button type="button" size="sm" onClick={onSave} className="gap-1.5">
            <Save className="size-3.5" aria-hidden />
            Save
          </Button>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(v) => !deleting && setDeleteOpen(v)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
                <Trash2 className="size-5" aria-hidden />
              </span>
              <div className="space-y-0.5">
                <DialogTitle>Delete “{workspace.name}”?</DialogTitle>
                <DialogDescription>
                  This removes the workspace, every board inside it, and all of its tasks. This
                  cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={deleting}
              autoFocus
            >
              {deleting ? "Deleting…" : "Delete workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
