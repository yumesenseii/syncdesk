"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bell,
  Bot,
  Globe,
  Lock,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  Tag,
  Trash2,
  Users,
} from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DEFAULT_BOARD_SETTINGS } from "@/lib/boards/seed"
import type {
  BoardLabel,
  BoardMeta,
  BoardSettings,
  BoardVisibility,
  KanbanColumnId,
  TaskPriority,
} from "@/lib/boards/types"
import { cn } from "@/lib/utils"
import { useBoardsStore } from "@/stores/boards-store"

type SectionId = "general" | "collaboration" | "notifications" | "automation" | "labels"

const SECTIONS: { id: SectionId; label: string; icon: typeof SettingsIcon; description: string }[] = [
  {
    id: "general",
    label: "General",
    icon: SettingsIcon,
    description: "Defaults applied when creating new tasks.",
  },
  {
    id: "collaboration",
    label: "Collaboration",
    icon: Users,
    description: "Who can see and act on this board.",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "How updates reach your team.",
  },
  {
    id: "automation",
    label: "Automation",
    icon: Bot,
    description: "Quiet rules that keep the board healthy.",
  },
  {
    id: "labels",
    label: "Labels & Priorities",
    icon: Tag,
    description: "Customize the taxonomy on this board.",
  },
]

const PRIORITIES: TaskPriority[] = ["Low", "Medium", "High", "Urgent"]

const COLUMN_OPTIONS: { id: KanbanColumnId; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "completed", label: "Completed" },
]

const VISIBILITY_OPTIONS: {
  id: BoardVisibility
  label: string
  description: string
  icon: typeof Lock
}[] = [
  { id: "private", label: "Private", description: "Only invited members.", icon: Lock },
  { id: "team", label: "Team", description: "Anyone in the workspace.", icon: Users },
  { id: "public", label: "Public link", description: "Read-only via shared link.", icon: Globe },
]

const LABEL_COLORS = [
  "bg-primary/15 text-primary",
  "bg-fuchsia-500/15 text-fuchsia-700",
  "bg-emerald-500/15 text-emerald-700",
  "bg-amber-500/15 text-amber-700",
  "bg-rose-500/15 text-rose-700",
  "bg-sky-500/15 text-sky-700",
] as const

function newLabelId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `lbl-${crypto.randomUUID().slice(0, 8)}`
  }
  return `lbl-${Date.now().toString(36)}`
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string
  description?: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-card/60 px-3.5 py-3 transition-colors hover:bg-card">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

function MiniSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel: string
}) {
  const active = options.find((o) => o.id === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 min-w-32 justify-between gap-2 font-normal"
          aria-label={ariaLabel}
        >
          {active?.label ?? value}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {options.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => onChange(o.id)}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function BoardSettingsDialog({
  board,
  open,
  onOpenChange,
}: {
  board: BoardMeta
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const updateBoardMeta = useBoardsStore((s) => s.updateBoardMeta)
  const updateBoardSettings = useBoardsStore((s) => s.updateBoardSettings)

  const [active, setActive] = useState<SectionId>("general")
  const [name, setName] = useState(board.name)
  const [description, setDescription] = useState(board.description ?? "")
  const [settings, setSettings] = useState<BoardSettings>(
    board.settings ?? DEFAULT_BOARD_SETTINGS
  )
  const [newLabelName, setNewLabelName] = useState("")
  const [newLabelColor, setNewLabelColor] = useState<string>(LABEL_COLORS[0])

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      setActive("general")
      setName(board.name)
      setDescription(board.description ?? "")
      setSettings(board.settings ?? DEFAULT_BOARD_SETTINGS)
      setNewLabelName("")
      setNewLabelColor(LABEL_COLORS[0])
    })
    return () => cancelAnimationFrame(id)
  }, [open, board])

  const activeSection = useMemo(() => SECTIONS.find((s) => s.id === active)!, [active])

  type SettingsPatch = Partial<Omit<BoardSettings, "notifications" | "automation">> & {
    notifications?: Partial<BoardSettings["notifications"]>
    automation?: Partial<BoardSettings["automation"]>
  }
  const updateSettings = (patch: SettingsPatch) =>
    setSettings((prev) => ({
      ...prev,
      ...patch,
      notifications: { ...prev.notifications, ...(patch.notifications ?? {}) },
      automation: { ...prev.automation, ...(patch.automation ?? {}) },
      labels: patch.labels ?? prev.labels,
    }))

  const addLabel = () => {
    const trimmed = newLabelName.trim()
    if (!trimmed) return
    const next: BoardLabel = {
      id: newLabelId(),
      name: trimmed,
      color: newLabelColor,
    }
    updateSettings({ labels: [...settings.labels, next] })
    setNewLabelName("")
  }

  const removeLabel = (id: string) =>
    updateSettings({ labels: settings.labels.filter((l) => l.id !== id) })

  const save = () => {
    updateBoardMeta(board.id, { name, description })
    updateBoardSettings(board.id, settings)
    toast.success("Board settings saved")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b border-border/60 px-5 py-4">
            <DialogTitle className="flex items-center gap-2">
              <SettingsIcon className="size-5 text-primary" aria-hidden />
              Board settings
            </DialogTitle>
            <DialogDescription>{activeSection.description}</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            <nav
              aria-label="Settings sections"
              className="shrink-0 border-b border-border/60 bg-muted/15 px-2 py-2 sm:w-52 sm:border-b-0 sm:border-r sm:py-4"
            >
              <ul className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
                {SECTIONS.map((s) => {
                  const Icon = s.icon
                  const isActive = s.id === active
                  return (
                    <li key={s.id} className="shrink-0 sm:shrink">
                      <button
                        type="button"
                        onClick={() => setActive(s.id)}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground"
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{s.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-5 py-5">
                {active === "general" ? (
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="set-name">Board name</Label>
                      <Input
                        id="set-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="set-desc">Description</Label>
                      <Input
                        id="set-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Short summary for teammates"
                      />
                    </div>
                    <SettingRow
                      title="Default task priority"
                      description="Pre-filled when a teammate creates a new task."
                      control={
                        <MiniSelect
                          value={settings.defaultPriority}
                          options={PRIORITIES.map((p) => ({ id: p, label: p }))}
                          onChange={(v) => updateSettings({ defaultPriority: v })}
                          ariaLabel="Default task priority"
                        />
                      }
                    />
                    <SettingRow
                      title="Default task column"
                      description="Where new tasks land before being triaged."
                      control={
                        <MiniSelect
                          value={settings.defaultColumn}
                          options={COLUMN_OPTIONS}
                          onChange={(v) => updateSettings({ defaultColumn: v })}
                          ariaLabel="Default task column"
                        />
                      }
                    />
                  </div>
                ) : null}

                {active === "collaboration" ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Board visibility
                      </Label>
                      <div role="radiogroup" className="mt-2 grid gap-2">
                        {VISIBILITY_OPTIONS.map((v) => {
                          const Icon = v.icon
                          const isActive = settings.visibility === v.id
                          return (
                            <button
                              key={v.id}
                              type="button"
                              role="radio"
                              aria-checked={isActive}
                              onClick={() => updateSettings({ visibility: v.id })}
                              className={cn(
                                "flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                                isActive
                                  ? "border-primary/40 bg-primary/[0.06] ring-1 ring-primary/20"
                                  : "border-border/60 hover:border-border hover:bg-muted/30"
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                                  isActive
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted/60 text-muted-foreground"
                                )}
                                aria-hidden
                              >
                                <Icon className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold">{v.label}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {v.description}
                                </span>
                              </span>
                              <span
                                aria-hidden
                                className={cn(
                                  "mt-1 size-3.5 shrink-0 rounded-full border-2 transition-colors",
                                  isActive ? "border-primary bg-primary" : "border-border"
                                )}
                              />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {active === "notifications" ? (
                  <div className="space-y-2.5">
                    <SettingRow
                      title="Email notifications"
                      description="Daily roll-up of mentions, due dates, and reviews."
                      control={
                        <Switch
                          checked={settings.notifications.email}
                          onCheckedChange={(v) =>
                            updateSettings({ notifications: { email: v } })
                          }
                          label="Email notifications"
                        />
                      }
                    />
                    <SettingRow
                      title="In-app notifications"
                      description="Toast and badge updates inside SyncDesk."
                      control={
                        <Switch
                          checked={settings.notifications.inApp}
                          onCheckedChange={(v) =>
                            updateSettings({ notifications: { inApp: v } })
                          }
                          label="In-app notifications"
                        />
                      }
                    />
                    <SettingRow
                      title="Weekly digest"
                      description="A short Monday brief summarizing board momentum."
                      control={
                        <Switch
                          checked={settings.notifications.weeklyDigest}
                          onCheckedChange={(v) =>
                            updateSettings({ notifications: { weeklyDigest: v } })
                          }
                          label="Weekly digest"
                        />
                      }
                    />
                  </div>
                ) : null}

                {active === "automation" ? (
                  <div className="space-y-2.5">
                    <SettingRow
                      title="Auto-move overdue tasks"
                      description="Slide overdue tasks into Review at midnight."
                      control={
                        <Switch
                          checked={settings.automation.autoMoveOverdue}
                          onCheckedChange={(v) =>
                            updateSettings({ automation: { autoMoveOverdue: v } })
                          }
                          label="Auto-move overdue tasks"
                        />
                      }
                    />
                    <SettingRow
                      title="Auto-archive completed"
                      description="Archive tasks 14 days after they hit Completed."
                      control={
                        <Switch
                          checked={settings.automation.autoArchiveCompleted}
                          onCheckedChange={(v) =>
                            updateSettings({ automation: { autoArchiveCompleted: v } })
                          }
                          label="Auto-archive completed"
                        />
                      }
                    />
                    <SettingRow
                      title="Notify assignees on assignment"
                      description="Ping members when they get tagged on a task."
                      control={
                        <Switch
                          checked={settings.automation.notifyOnAssign}
                          onCheckedChange={(v) =>
                            updateSettings({ automation: { notifyOnAssign: v } })
                          }
                          label="Notify on assignment"
                        />
                      }
                    />
                    <SettingRow
                      title="Notify on upcoming due dates"
                      description="24-hour heads-up before a task is due."
                      control={
                        <Switch
                          checked={settings.automation.notifyOnDue}
                          onCheckedChange={(v) =>
                            updateSettings({ automation: { notifyOnDue: v } })
                          }
                          label="Notify on upcoming due dates"
                        />
                      }
                    />
                  </div>
                ) : null}

                {active === "labels" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Current labels
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {settings.labels.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No labels yet. Add one below.
                          </p>
                        ) : (
                          settings.labels.map((l) => (
                            <span
                              key={l.id}
                              className={cn(
                                "group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                                l.color
                              )}
                            >
                              {l.name}
                              <button
                                type="button"
                                onClick={() => removeLabel(l.id)}
                                className="rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100"
                                aria-label={`Remove ${l.name}`}
                              >
                                <Trash2 className="size-3" aria-hidden />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/15 p-3">
                      <Label htmlFor="new-label" className="text-xs uppercase tracking-wider">
                        Add label
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        <Input
                          id="new-label"
                          value={newLabelName}
                          onChange={(e) => setNewLabelName(e.target.value)}
                          placeholder="e.g. Discovery"
                          className="h-9 min-w-40 flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 gap-1"
                          onClick={addLabel}
                          disabled={!newLabelName.trim()}
                        >
                          <Plus className="size-4" aria-hidden />
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Color
                        </span>
                        {LABEL_COLORS.map((c) => {
                          const isActive = newLabelColor === c
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setNewLabelColor(c)}
                              aria-label={`Color ${c}`}
                              className={cn(
                                "size-5 rounded-full ring-2 transition-all",
                                c,
                                isActive
                                  ? "ring-foreground/40 ring-offset-2 ring-offset-background"
                                  : "ring-transparent hover:ring-foreground/15"
                              )}
                            />
                          )
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Sparkles className="size-3.5 text-primary" aria-hidden />
                        Priorities are platform-wide
                      </p>
                      <p className="mt-1">
                        Custom priorities are coming soon. For now, set the board default in the
                        General tab.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="gap-2 border-t border-border/60 px-5 py-3 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={save}>
                  Save changes
                </Button>
              </DialogFooter>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
