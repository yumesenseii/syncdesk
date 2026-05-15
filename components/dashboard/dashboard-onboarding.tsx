"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  KanbanSquare,
  LayoutGrid,
  Sparkles,
  UserPlus2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useOpenCreateWorkspaceModal } from "@/components/workspaces/create-workspace-modal"
import { cn } from "@/lib/utils"

const HIGHLIGHTS: { icon: typeof LayoutGrid; title: string; body: string }[] = [
  {
    icon: KanbanSquare,
    title: "Kanban-ready boards",
    body: "Create boards with To Do, In Progress, Review and Completed columns out of the box.",
  },
  {
    icon: Sparkles,
    title: "Live analytics",
    body: "Velocity, workload distribution and risk metrics computed from your real tasks — no demo data.",
  },
  {
    icon: UserPlus2,
    title: "Invite teammates",
    body: "Send Gmail invitations from any workspace. Contributions flow into the same shared metrics.",
  },
]

/**
 * Onboarding hero rendered on `/dashboard` when the user has zero
 * workspaces. Replaces what used to be the welcome banner + analytics cards
 * with a focused, centred call-to-action that explains what SyncDesk does
 * and offers three real entry points: create a workspace, browse the boards
 * page, or open the invite flow from inside Boards.
 *
 * This component intentionally has no synthetic stats — every action it
 * presents leads to a real, working part of the app.
 */
export function DashboardOnboarding({ displayName }: { displayName: string }) {
  const openCreateWorkspace = useOpenCreateWorkspaceModal()

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-labelledby="dashboard-onboarding-heading"
      className="flex justify-center"
    >
      <Card className="relative w-full max-w-3xl overflow-hidden border-border/70 bg-gradient-to-b from-card via-card to-primary/[0.05] p-0 ring-1 ring-foreground/[0.04]">
        <div
          className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(80%_60%_at_20%_0%,oklch(from_var(--primary)_l_c_h/0.18)_0%,transparent_60%),radial-gradient(60%_50%_at_85%_0%,#38bdf833_0%,transparent_55%)]"
          aria-hidden
        />
        <div className="relative px-6 pt-10 pb-8 sm:px-10">
          <div className="mx-auto max-w-xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="size-3" aria-hidden />
              Welcome to SyncDesk
            </span>
            <h1
              id="dashboard-onboarding-heading"
              className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              Hi {displayName}, let&apos;s set up your first workspace.
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              SyncDesk organises real work into workspaces and Kanban boards. Analytics,
              calendar and activity all populate from the tasks you and your teammates create
              — nothing here is seeded with demo content.
            </p>

            <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Button
                type="button"
                size="lg"
                className="h-11 w-full gap-1.5 px-5 shadow-sm shadow-primary/25 sm:w-auto"
                onClick={() => openCreateWorkspace()}
              >
                Create your first workspace
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 w-full gap-1.5 border-border/70 bg-background/70 px-5 sm:w-auto"
                asChild
              >
                <Link href="/dashboard/boards">Open Boards</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              You can invite teammates from any workspace once it exists.
            </p>
          </div>

          <ul
            role="list"
            className="mx-auto mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-3"
          >
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon
              return (
                <li
                  key={item.title}
                  className={cn(
                    "rounded-2xl border border-border/60 bg-card/60 p-4 text-left shadow-sm shadow-foreground/[0.02]"
                  )}
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      </Card>
    </motion.section>
  )
}
