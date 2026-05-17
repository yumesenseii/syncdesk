"use client"



import Link from "next/link"

import { useEffect, useMemo, useState } from "react"

import {

  Bell,

  Check,

  ChevronDown,

  CommandIcon,

  Plus,

  Search,

  Sparkles,

} from "lucide-react"

import { toast } from "sonner"



import { CreateBoardDialog } from "@/components/boards/create-board-dialog"

import { DashboardMobileNav } from "@/components/dashboard/dashboard-mobile-nav"

import { DashboardSearchDialog } from "@/components/dashboard/dashboard-search-dialog"

import { ProfileDropdown } from "@/components/profile/profile-dropdown"

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

  DropdownMenuLabel,

  DropdownMenuSeparator,

  DropdownMenuTrigger,

} from "@/components/ui/dropdown-menu"

import { Input } from "@/components/ui/input"

import { useActiveDashboardWorkspace } from "@/hooks/use-active-dashboard-workspace"

import { NotificationBell } from "@/components/notifications/notification-bell"

import type { BoardTask, TeamMember, WorkspaceEntity } from "@/lib/boards/types"


import { getWorkspaceStats, useBoardsStore } from "@/stores/boards-store"

import { cn } from "@/lib/utils"



function workspaceHealthLabel(

  ws: WorkspaceEntity | undefined,

  tasksByBoardId: Record<string, BoardTask[]>,

  teamMembers: TeamMember[]

) {

  if (!ws) return { label: "—", className: "bg-muted text-muted-foreground" }

  const teamMap = new Map(teamMembers.map((m) => [m.id, m]))

  const s = getWorkspaceStats(ws, tasksByBoardId, teamMap)

  if (s.totalTasks === 0) return { label: "Empty", className: "bg-sky-500/10 text-sky-700" }

  if (s.overdueTasks > 0) return { label: "At risk", className: "bg-amber-500/10 text-amber-800" }

  if (s.progressPct >= 70) return { label: "On track", className: "bg-emerald-500/10 text-emerald-700" }

  return { label: "Active", className: "bg-primary/10 text-primary" }

}



export function DashboardTopBar({

  userId,

  displayName,

  email,

  onLogout,

  loggingOut,

}: {

  userId: string | null

  displayName: string

  email: string

  onLogout: () => void

  loggingOut: boolean

}) {

  const tasksByBoardId = useBoardsStore((s) => s.tasksByBoardId)

  const teamMembers = useBoardsStore((s) => s.teamMembers)

  const { activeWorkspace, setActiveWorkspaceId, workspaces } = useActiveDashboardWorkspace()



  const health = useMemo(

    () => workspaceHealthLabel(activeWorkspace ?? undefined, tasksByBoardId, teamMembers),

    [activeWorkspace, tasksByBoardId, teamMembers]

  )



  const [searchOpen, setSearchOpen] = useState(false)

  const [createBoardOpen, setCreateBoardOpen] = useState(false)

  const [askOpen, setAskOpen] = useState(false)

  const [aiPrompt, setAiPrompt] = useState("")



  useEffect(() => {

    const onKey = (e: KeyboardEvent) => {

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {

        e.preventDefault()

        setSearchOpen((v) => !v)

      }

    }

    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)

  }, [])
  const submitAskAi = () => {

    toast.message("AI assistant is coming soon", {

      description: "We're still wiring it up. In the meantime, Analytics surfaces signals from your real data.",

    })

    setAskOpen(false)

    setAiPrompt("")

  }



  return (

    <>

      <DashboardSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />



      {activeWorkspace ? (

        <CreateBoardDialog

          open={createBoardOpen}

          onOpenChange={setCreateBoardOpen}

          workspaceId={activeWorkspace.id}

          workspaceName={activeWorkspace.name}

          workspaceSlug={activeWorkspace.slug}

        />

      ) : null}



      <Dialog open={askOpen} onOpenChange={setAskOpen}>

        <DialogContent className="sm:max-w-md" showCloseButton>

          <DialogHeader>

            <DialogTitle>Ask AI · coming soon</DialogTitle>

            <DialogDescription>

              The conversational assistant isn&apos;t live yet. Drop a note on what you&apos;d

              like it to do — we&apos;ll prioritise the first prompts when we ship the backend.

            </DialogDescription>

          </DialogHeader>

          <textarea

            className="min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"

            value={aiPrompt}

            onChange={(e) => setAiPrompt(e.target.value)}

            placeholder="What should the assistant do once it's available?"

            aria-label="AI prompt"

          />

          <DialogFooter>

            <Button type="button" variant="outline" onClick={() => setAskOpen(false)}>

              Close

            </Button>

            <Button type="button" onClick={submitAskAi}>

              Save idea

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>



      <div className="flex items-center justify-between gap-2 sm:gap-3">

        <div className="flex min-w-0 items-center gap-2">

          <DashboardMobileNav />

          <DropdownMenu>

            <DropdownMenuTrigger asChild>

              <Button

                type="button"

                variant="outline"

                size="sm"

                className="h-9 max-w-[16rem] gap-2 rounded-full border-border/70 bg-background/70 px-3 shadow-sm transition-all duration-200 ease-out hover:bg-muted/60"

                aria-label="Switch workspace"

              >

                <span

                  className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-sm"

                  aria-hidden

                >

                  {activeWorkspace?.icon ?? "📂"}

                </span>

                <span className="truncate text-sm font-semibold text-foreground">

                  {activeWorkspace?.name ?? "Workspaces"}

                </span>

                <span

                  className={cn(

                    "hidden rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide lg:inline",

                    health.className

                  )}

                >

                  {health.label}

                </span>

                <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />

              </Button>

            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-60">

              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>

              <DropdownMenuSeparator />

              {workspaces.map((w) => {

                const first = w.boardIds[0]

                const href = first

                  ? `/dashboard/boards/${w.slug}/${first}`

                  : `/dashboard/workspaces/${w.slug}`

                return (

                  <DropdownMenuItem key={w.id} asChild className="gap-2">

                    <Link

                      href={href}

                      className="flex w-full cursor-pointer items-center gap-2"

                      onClick={() => setActiveWorkspaceId(w.id)}

                    >

                      <span aria-hidden>{w.icon}</span>

                      <span className="flex-1 truncate">{w.name}</span>

                      {w.id === activeWorkspace?.id ? (

                        <Check className="size-4 text-primary" aria-hidden />

                      ) : null}

                    </Link>

                  </DropdownMenuItem>

                )

              })}

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild className="gap-2 text-primary focus:text-primary">

                <Link href="/dashboard/boards" className="flex cursor-pointer items-center gap-2">

                  <Plus className="size-4" aria-hidden />

                  Manage workspaces

                </Link>

              </DropdownMenuItem>

            </DropdownMenuContent>

          </DropdownMenu>

        </div>



        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 xl:gap-2.5">

          <div className="relative hidden lg:block">

            <Search

              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"

              aria-hidden

            />

            <Input

              type="search"

              readOnly

              onFocus={() => setSearchOpen(true)}

              onClick={() => setSearchOpen(true)}

              placeholder="Search…"

              className="h-9 w-[200px] cursor-pointer rounded-full border-border/70 bg-background/70 pl-9 pr-3 text-sm shadow-sm transition-all duration-200 ease-out placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/30 xl:w-[260px] xl:pr-12 2xl:w-[320px]"

              aria-label="Open search"

            />

            <kbd

              className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 items-center gap-0.5 rounded-md border border-border/70 bg-background/80 px-1.5 text-[10px] font-medium text-muted-foreground xl:inline-flex"

              aria-hidden

            >

              <CommandIcon className="size-3" />K

            </kbd>

          </div>



          <Button

            type="button"

            variant="outline"

            size="icon"

            className="size-9 shrink-0 rounded-full border-border/70 bg-background/70 text-muted-foreground transition-colors duration-200 ease-out hover:bg-muted/60 hover:text-foreground lg:hidden"

            aria-label="Search"

            onClick={() => setSearchOpen(true)}

          >

            <Search className="size-4" aria-hidden />

          </Button>



          <Button

            type="button"

            size="sm"

            className="h-9 gap-1.5 rounded-full px-3 shadow-sm shadow-primary/20 transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-md hover:shadow-primary/25"

            onClick={() => setAskOpen(true)}

          >

            <Sparkles className="size-4" aria-hidden />

            <span className="hidden md:inline">Ask AI</span>

          </Button>



          <Button

            type="button"

            variant="outline"

            size="sm"

            className="h-9 gap-1.5 rounded-full border-border/70 bg-background/70 px-3 shadow-sm transition-colors duration-200 ease-out hover:bg-muted/60 disabled:opacity-60"

            onClick={() => setCreateBoardOpen(true)}

            disabled={!activeWorkspace}

            title={

              activeWorkspace

                ? `Create a board in ${activeWorkspace.name}`

                : "Create a workspace first"

            }

          >

            <Plus className="size-4" aria-hidden />

            <span className="hidden md:inline">New board</span>

          </Button>



          <NotificationBell userId={userId} />

          <ProfileDropdown

            userId={userId}

            displayName={displayName}

            email={email}

            onLogout={onLogout}

            loggingOut={loggingOut}

          />

        </div>

      </div>

    </>

  )

}


