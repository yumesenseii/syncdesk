"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  CalendarDays,
  KanbanSquare,
  LayoutGrid,
  LineChart,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  User2,
} from "lucide-react"

import { LogoMark } from "@/components/logo-mark"
import { LogoutConfirmationModal } from "@/components/profile/logout-confirmation-modal"
import { useOpenCreateWorkspaceModal } from "@/components/workspaces/create-workspace-modal"
import { Button } from "@/components/ui/button"
import { APP_NAME } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useBoardsStore } from "@/stores/boards-store"

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/boards", label: "Boards", icon: KanbanSquare },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/analytics", label: "Analytics", icon: LineChart },
  { href: "/dashboard/activity", label: "Activity", icon: Activity },
] as const

export function DashboardSidebar({
  userName,
  userEmail,
  onLogout,
}: {
  userName: string | null
  userEmail: string
  onLogout: () => void
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const workspaces = useBoardsStore((s) => s.workspaces)
  const tasksByBoardId = useBoardsStore((s) => s.tasksByBoardId)
  const openCreateWorkspace = useOpenCreateWorkspaceModal()

  /**
   * Show the first few workspaces in the sidebar with real task counts.
   * Previously this section rendered a static demo list (Cloth / Flower Shop
   * / Gamer Boy). Now the section disappears entirely for accounts with
   * zero workspaces and is replaced by a "Create workspace" call-to-action.
   */
  const workspaceShortcuts = useMemo(
    () =>
      workspaces.slice(0, 6).map((ws) => {
        const taskCount = ws.boardIds.reduce(
          (acc, bid) => acc + (tasksByBoardId[bid]?.length ?? 0),
          0
        )
        return {
          id: ws.id,
          slug: ws.slug,
          name: ws.name,
          icon: ws.icon || "📂",
          tasks: taskCount,
          firstBoardId: ws.boardIds[0],
        }
      }),
    [workspaces, tasksByBoardId]
  )

  const displayName = useMemo(
    () => (userName && userName.trim().length > 0 ? userName : null),
    [userName]
  )
  const displayLabel = displayName ?? userEmail.split("@")[0] ?? "You"

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await onLogout()
    } finally {
      setLoggingOut(false)
      setLogoutOpen(false)
    }
  }

  const isNavActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const labelHidden = collapsed
    ? "pointer-events-none max-w-0 translate-x-1 overflow-hidden opacity-0"
    : "max-w-[10rem] translate-x-0 opacity-100"

  return (
    <aside
      className={cn(
        "relative hidden h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-card/40 backdrop-blur-xl supports-[backdrop-filter]:bg-card/30 sm:flex",
        "transition-[width] duration-300 ease-in-out will-change-[width]",
        collapsed ? "w-16" : "w-60"
      )}
      aria-label="Primary"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div
          className={cn(
            "flex shrink-0 border-b border-border/50 transition-all duration-300 ease-in-out",
            collapsed
              ? "flex-col items-center gap-3 px-2 py-3"
              : "flex-row items-center justify-between gap-2 px-3 py-3"
          )}
        >
          <Link
            href="/"
            className={cn(
              "flex min-w-0 items-center transition-all duration-300 ease-in-out",
              collapsed ? "justify-center" : "gap-2"
            )}
          >
            <LogoMark size={30} className="shrink-0 shadow-sm shadow-primary/10" />
            <span
              className={cn(
                "whitespace-nowrap text-sm font-semibold tracking-tight transition-all duration-300 ease-in-out",
                labelHidden
              )}
              aria-hidden={collapsed}
            >
              {APP_NAME}
            </span>
          </Link>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-lg text-muted-foreground transition-colors duration-300 ease-in-out hover:bg-muted/60 hover:text-foreground"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden />
            )}
          </Button>
        </div>

        <nav
          className={cn(
            "dashboard-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden py-4",
            collapsed ? "px-2" : "px-2.5"
          )}
        >
          <div className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isNavActive(item.href)
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center rounded-lg py-1.5 text-sm transition-all duration-300 ease-in-out",
                    collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Icon
                    className="size-[17px] shrink-0 transition-transform duration-300 ease-in-out group-hover:scale-[1.04]"
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "min-w-0 truncate font-medium transition-all duration-300 ease-in-out",
                      labelHidden
                    )}
                    aria-hidden={collapsed}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>

          <div className="flex flex-col gap-2">
            <div
              className={cn(
                "flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground transition-all duration-300 ease-in-out",
                collapsed
                  ? "pointer-events-none max-h-0 overflow-hidden opacity-0"
                  : "max-h-6 opacity-100"
              )}
              aria-hidden={collapsed}
            >
              <span>Workspaces</span>
              <Link
                href="/dashboard/boards"
                className="text-[10px] font-medium normal-case text-primary/80 hover:text-primary"
              >
                Manage
              </Link>
            </div>

            <div className="flex flex-col gap-1.5">
              {workspaceShortcuts.length === 0 ? (
                <button
                  type="button"
                  onClick={() => openCreateWorkspace()}
                  className={cn(
                    "flex w-full items-center rounded-lg border border-dashed border-border/60 bg-card/40 text-left text-xs text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground",
                    collapsed ? "justify-center px-0 py-2" : "gap-2 px-2 py-2"
                  )}
                  aria-label="Create your first workspace"
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                    )}
                    aria-hidden
                  >
                    <Plus className="size-3.5" />
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 transition-all duration-300 ease-in-out",
                      collapsed
                        ? "pointer-events-none max-w-0 overflow-hidden opacity-0"
                        : "opacity-100"
                    )}
                    aria-hidden={collapsed}
                  >
                    Create a workspace
                  </span>
                </button>
              ) : (
                workspaceShortcuts.map((w) => {
                  const href = w.firstBoardId
                    ? `/dashboard/boards/${w.slug}/${w.firstBoardId}`
                    : `/dashboard/workspaces/${w.slug}`
                  return (
                    <Link
                      key={w.id}
                      href={href}
                      className={cn(
                        "flex items-center rounded-lg border border-border/60 bg-card/60 transition-all duration-300 ease-in-out",
                        "hover:border-border hover:bg-card/80",
                        collapsed ? "justify-center px-0 py-1.5" : "gap-2 px-2 py-1.5"
                      )}
                    >
                      <div
                        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/70 text-[13px]"
                        aria-hidden
                      >
                        {w.icon}
                      </div>
                      <div
                        className={cn(
                          "min-w-0 flex-1 transition-all duration-300 ease-in-out",
                          collapsed
                            ? "pointer-events-none max-w-0 overflow-hidden opacity-0"
                            : "opacity-100"
                        )}
                        aria-hidden={collapsed}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-medium leading-tight text-foreground">
                              {w.name}
                            </div>
                            <div className="text-[10.5px] leading-tight text-muted-foreground">
                              {w.tasks === 0
                                ? "No tasks yet"
                                : `${w.tasks} task${w.tasks === 1 ? "" : "s"}`}
                            </div>
                          </div>
                          {w.tasks > 0 ? (
                            <div
                              className="size-1.5 shrink-0 rounded-full bg-primary"
                              aria-hidden
                            />
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-2 border-t border-border/50 pt-3">
            <div
              className={cn(
                "rounded-lg border border-border/60 bg-card/60 transition-all duration-300 ease-in-out",
                collapsed ? "p-1.5" : "p-2"
              )}
            >
              <Link
                href="/dashboard/profile"
                aria-current={isNavActive("/dashboard/profile") ? "page" : undefined}
                className={cn(
                  "group flex items-center rounded-md transition-colors duration-200 ease-out hover:bg-muted/50",
                  collapsed ? "flex-col items-center gap-2 p-1" : "flex-row items-center gap-2 p-1",
                  isNavActive("/dashboard/profile") && "bg-primary/10"
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <User2 className="size-[17px]" aria-hidden />
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1 overflow-hidden transition-all duration-300 ease-in-out",
                    collapsed ? "max-h-0 max-w-0 opacity-0" : "max-h-20 max-w-full opacity-100"
                  )}
                  aria-hidden={collapsed}
                >
                  <div className="truncate text-[13px] font-semibold leading-tight">
                    {displayLabel}
                  </div>
                  <div className="truncate text-[10.5px] leading-tight text-muted-foreground">
                    {userEmail}
                  </div>
                </div>
              </Link>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "border-border/80 bg-background/60 text-xs font-medium transition-all duration-300 ease-in-out hover:bg-muted/40",
                  collapsed ? "mx-auto mt-2 size-8 p-0" : "mt-2 h-7 w-full justify-center gap-1.5 px-2"
                )}
                onClick={() => setLogoutOpen(true)}
                aria-label="Logout"
              >
                <LogOut className="size-3.5 shrink-0" aria-hidden />
                <span
                  className={cn(
                    "truncate transition-all duration-300 ease-in-out",
                    collapsed ? "sr-only" : "inline"
                  )}
                >
                  Logout
                </span>
              </Button>
            </div>
          </div>
        </nav>
      </div>

      <LogoutConfirmationModal
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={handleLogout}
        loading={loggingOut}
      />
    </aside>
  )
}
