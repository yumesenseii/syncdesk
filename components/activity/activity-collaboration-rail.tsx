"use client"

import Link from "next/link"
import { Inbox, UserPlus2, UsersRound } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useActivityInboxQuery } from "@/hooks/use-activity-events"
import { formatRelativeTime } from "@/lib/activity/events"
import { UserAvatar } from "@/components/ui/user-avatar"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { useBoardsStore } from "@/stores/boards-store"
import { cn } from "@/lib/utils"

/**
 * Sidebar rail next to the activity feed. This component used to render a
 * "Live presence" panel with online/focus/away dots cycled from the member
 * list index — purely fabricated. It now shows only data we can verify:
 *
 *   • A teammate roster sourced from `useBoardsStore().teamMembers` (the
 *     same list backing real workspace member ids).
 *   • Assignment events from the activity feed (task_assigned where you are assignee).
 *   • Static workspace shortcuts.
 *
 * When the user has no teammates yet the panel guides them to invite — no
 * placeholder avatars or status dots are inserted.
 */
export function ActivityCollaborationRail({ userId }: { userId: string | null }) {
  const teamMembers = useBoardsStore((s) => s.teamMembers)
  const { items: inbox, isLoading: inboxLoading } = useActivityInboxQuery(userId)

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
        <CardHeader className="px-5 pb-2 pt-5">
          <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <UsersRound className="size-4 text-primary" aria-hidden />
            Teammates
          </CardTitle>
          <CardDescription>People you collaborate with across workspaces.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-1">
          {teamMembers.length === 0 ? (
            <div className="space-y-2 rounded-xl border border-dashed border-border/60 bg-muted/15 px-3 py-5 text-center">
              <p className="text-sm font-medium text-foreground">No teammates yet</p>
              <p className="text-xs text-muted-foreground">
                Invite a teammate to start tracking shared contributions.
              </p>
              <Link
                href="/dashboard/boards"
                className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
              >
                <UserPlus2 className="size-3.5" aria-hidden />
                Invite teammates
              </Link>
            </div>
          ) : (
            <ul className="space-y-2.5" role="list">
              {teamMembers.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2"
                >
                  <UserAvatar
                    name={member.name}
                    initials={member.initials}
                    avatarUrl={member.avatarUrl}
                    color={member.color}
                    size="md"
                    rounded="2xl"
                    ringClassName=""
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card shadow-sm shadow-black/[0.04]">
        <CardHeader className="px-5 pb-2 pt-5">
          <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Inbox className="size-4 text-primary" aria-hidden />
            Inbox
            {inbox.length > 0 ? (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {inbox.length}
              </span>
            ) : null}
          </CardTitle>
          <CardDescription>Tasks assigned to you across workspaces.</CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-3 pt-1">
          {inboxLoading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading inbox…</p>
          ) : inbox.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {getOptionalSupabaseClient()
                ? "No assignments yet. When someone assigns you a task, it will show here."
                : "Connect Supabase to receive assignment updates."}
            </p>
          ) : (
            <ul className="space-y-0.5" role="list">
              {inbox.map((event) => {
                const href =
                  event.boardId && event.workspaceSlug
                    ? `/dashboard/boards/${event.workspaceSlug}/${event.boardId}`
                    : "/dashboard/activity"
                return (
                  <li key={event.id}>
                    <Link
                      href={href}
                      className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                    >
                      <span className="font-medium text-foreground">
                        {event.actorLabel} {event.summary}
                      </span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {event.targetTitle}
                        {event.boardName ? ` · ${event.boardName}` : ""}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelativeTime(event.timestamp)}
                      </span>
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
          <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <UsersRound className="size-4 text-primary" aria-hidden />
            Workspace shortcuts
          </CardTitle>
          <CardDescription>Jump into the right context fast.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-1">
          <ul className="space-y-1.5 text-sm">
            <li>
              <Link
                href="/dashboard/boards"
                className="block rounded-lg border border-border/60 bg-background/50 px-3 py-2 hover:bg-muted/40"
              >
                Open Boards
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/calendar"
                className="block rounded-lg border border-border/60 bg-background/50 px-3 py-2 hover:bg-muted/40"
              >
                Open Calendar
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/analytics"
                className="block rounded-lg border border-border/60 bg-background/50 px-3 py-2 hover:bg-muted/40"
              >
                Open Analytics
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
