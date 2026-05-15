"use client"

import { useMemo, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowUpRight,
  BarChart3,
  Copy,
  Crown,
  Globe,
  LineChart,
  Link2,
  Lock,
  Pencil,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DEFAULT_BOARD_SETTINGS } from "@/lib/boards/seed"
import type { BoardMeta, TeamMember, WorkspaceEntity } from "@/lib/boards/types"
import { cn } from "@/lib/utils"
import {
  getBoardHealth,
  getWorkspaceMembers,
  useBoardTasks,
  useBoardsStore,
} from "@/stores/boards-store"

const VISIBILITY_META: Record<
  NonNullable<BoardMeta["settings"]>["visibility"],
  { label: string; icon: typeof Lock; tone: string }
> = {
  private: {
    label: "Private workspace",
    icon: Lock,
    tone: "bg-slate-500/10 text-slate-700",
  },
  team: { label: "Team workspace", icon: Users, tone: "bg-primary/10 text-primary" },
  public: { label: "Public link", icon: Globe, tone: "bg-emerald-500/10 text-emerald-700" },
}

interface BoardActionsMenuProps {
  board: BoardMeta
  workspace: WorkspaceEntity
  onMembers: () => void
  onShare: () => void
  onRename: () => void
  onSettings: () => void
  onDelete: () => void
  trigger: ReactNode
}

function MenuItemRow({
  icon: Icon,
  label,
  description,
  onSelect,
  shortcut,
  variant = "default",
}: {
  icon: typeof Settings
  label: string
  description?: string
  onSelect: () => void
  shortcut?: string
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault()
        onSelect()
      }}
      variant={variant}
      className={cn(
        "h-auto items-start gap-2.5 rounded-lg px-2 py-2 transition-colors",
        variant === "default" && "focus:bg-muted/60"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
          variant === "destructive"
            ? "bg-rose-500/10 text-rose-600"
            : "bg-muted/60 text-muted-foreground group-focus/dropdown-menu-item:bg-muted"
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium leading-tight">{label}</span>
          {shortcut ? (
            <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
              {shortcut}
            </span>
          ) : null}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </DropdownMenuItem>
  )
}

export function BoardActionsMenu({
  board,
  workspace,
  onMembers,
  onShare,
  onRename,
  onSettings,
  onDelete,
  trigger,
}: BoardActionsMenuProps) {
  const router = useRouter()
  const teamMembers = useBoardsStore((s) => s.teamMembers)
  const tasks = useBoardTasks(board.id)
  const duplicateBoard = useBoardsStore((s) => s.duplicateBoard)

  const teamById = useMemo(
    () => new Map(teamMembers.map((m) => [m.id, m])),
    [teamMembers]
  )
  const members = useMemo(
    () => getWorkspaceMembers(workspace, teamMembers),
    [workspace, teamMembers]
  )

  const health = useMemo(() => getBoardHealth(tasks, teamById), [tasks, teamById])
  const visibility = board.settings?.visibility ?? DEFAULT_BOARD_SETTINGS.visibility
  const visMeta = VISIBILITY_META[visibility]

  const copyLink = async () => {
    try {
      if (typeof window === "undefined") return
      const url = window.location.href
      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(url)
      }
      toast.success("Board link copied", { description: url })
    } catch {
      toast.error("Could not copy", { description: "Copy the link manually." })
    }
  }

  const openAnalytics = (view: string, friendly: string) => {
    router.push(`/dashboard/analytics#${view}`)
    toast.success(`Opening ${friendly}`, {
      description: `Scoped to ${board.name}.`,
    })
  }

  const archive = () =>
    toast.message("Archive isn't available yet", {
      description: `${board.name} will stay visible until we ship board archiving.`,
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border/60 bg-popover p-0 shadow-xl ring-1 ring-foreground/[0.06]"
      >
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/[0.06] via-card to-card px-3.5 py-3.5">
          <div
            className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-primary/[0.08] blur-3xl"
            aria-hidden
          />
          <div className="relative flex items-start gap-2.5">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-sky-500/15 text-xl"
              aria-hidden
            >
              {workspace.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {board.name}
                </h3>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {board.description ?? "No description yet."}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    visMeta.tone
                  )}
                >
                  <visMeta.icon className="size-2.5" aria-hidden />
                  {visMeta.label}
                </span>
                <div className="flex -space-x-1.5">
                  {members.slice(0, 3).map((m) => (
                    <span
                      key={m.id}
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full text-[9px] font-semibold ring-2 ring-card",
                        m.color
                      )}
                      title={m.name}
                    >
                      {m.initials}
                    </span>
                  ))}
                  {members.length > 3 ? (
                    <span
                      className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-card"
                      aria-label={`${members.length - 3} more`}
                    >
                      +{members.length - 3}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="rounded-lg border border-border/60 bg-card/80 px-2 py-1.5">
              <div className="flex items-baseline gap-0.5">
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {health.completionPct}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">%</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Completion
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-sky-500"
                  style={{ width: `${health.completionPct}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/80 px-2 py-1.5">
              <div
                className={cn(
                  "text-base font-semibold tabular-nums",
                  health.overdue > 0 ? "text-rose-600" : "text-foreground"
                )}
              >
                {health.overdue}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Overdue
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                of {health.total} tasks
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/80 px-2 py-1.5">
              <div className="flex items-center gap-1">
                {health.mostActive ? (
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md text-[9px] font-semibold",
                      health.mostActive.color
                    )}
                    aria-hidden
                  >
                    {health.mostActive.initials}
                  </span>
                ) : (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                    <Crown className="size-3" aria-hidden />
                  </span>
                )}
                <span className="truncate text-xs font-semibold text-foreground">
                  {health.mostActive ? health.mostActive.name.split(" ")[0] : "—"}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Most active
              </div>
              <div className="text-[10px] text-muted-foreground">
                {health.mostActiveCount > 0
                  ? `${health.mostActiveCount} task${health.mostActiveCount === 1 ? "" : "s"}`
                  : "No assignees"}
              </div>
            </div>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          <DropdownMenuLabel className="px-2 pt-1 text-[10px] uppercase tracking-wider">
            Collaboration
          </DropdownMenuLabel>
          <MenuItemRow
            icon={Users}
            label="Members"
            description="View workspace members with access to this board."
            onSelect={onMembers}
          />
          <MenuItemRow
            icon={Share2}
            label="Share board"
            description="Visibility, link sharing, and export."
            onSelect={onShare}
          />
          <MenuItemRow
            icon={Link2}
            label="Copy board link"
            description="Quick link to this Kanban view."
            shortcut="⌘ C"
            onSelect={copyLink}
          />

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="px-2 pt-1 text-[10px] uppercase tracking-wider">
            Board management
          </DropdownMenuLabel>
          <MenuItemRow
            icon={Pencil}
            label="Rename board"
            description="Update the name and description."
            onSelect={onRename}
          />
          <MenuItemRow
            icon={Copy}
            label="Duplicate board"
            description="Clone columns, labels, and tasks."
            onSelect={async () => {
              const id = await duplicateBoard(board.id)
              if (id) {
                toast.success("Board duplicated", { description: `${board.name} (copy)` })
                router.push(`/dashboard/boards/${workspace.slug}/${id}`)
              }
            }}
          />
          <MenuItemRow
            icon={Archive}
            label="Archive board"
            description="Hide without losing history."
            onSelect={archive}
          />
          <MenuItemRow
            icon={Settings}
            label="Board settings"
            description="Defaults, automation, labels, more."
            onSelect={onSettings}
          />

          <DropdownMenuSeparator />

          <div className="rounded-xl bg-gradient-to-br from-primary/[0.06] via-fuchsia-500/[0.04] to-sky-500/[0.05] p-1.5 ring-1 ring-primary/15">
            <DropdownMenuLabel className="flex items-center gap-1.5 px-1.5 pt-0.5 text-[10px] uppercase tracking-wider text-foreground/80">
              <Sparkles className="size-3 text-primary" aria-hidden />
              Workspace intelligence
            </DropdownMenuLabel>
            <MenuItemRow
              icon={BarChart3}
              label="Contribution analytics"
              description="Who is shipping what, where."
              onSelect={() => openAnalytics("contributions", "Contribution Analytics")}
            />
            <MenuItemRow
              icon={Activity}
              label="Team activity insights"
              description="Cadence, momentum, collaboration."
              onSelect={() => openAnalytics("activity", "Team Activity Insights")}
            />
            <MenuItemRow
              icon={LineChart}
              label="Productivity report"
              description="Throughput vs. target by sprint."
              onSelect={() => openAnalytics("productivity", "Productivity Report")}
            />
            <MenuItemRow
              icon={AlertTriangle}
              label="Delayed task monitor"
              description="Risk register for slipping work."
              onSelect={() => openAnalytics("delayed", "Delayed Task Monitor")}
            />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                router.push("/dashboard/analytics")
              }}
              className="mt-1 justify-end rounded-lg px-2 py-1 text-[11px] font-semibold text-primary focus:bg-primary/10 focus:text-primary"
            >
              Open analytics workspace
              <ArrowUpRight className="size-3.5" aria-hidden />
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator className="my-2" />

          <div className="rounded-xl bg-rose-500/[0.04] p-1.5 ring-1 ring-rose-500/15">
            <DropdownMenuLabel className="px-2 pt-0.5 text-[10px] uppercase tracking-wider text-rose-700">
              Danger zone
            </DropdownMenuLabel>
            <MenuItemRow
              icon={Trash2}
              label="Delete board"
              description="Permanently remove this board and its tasks."
              variant="destructive"
              onSelect={onDelete}
            />
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
