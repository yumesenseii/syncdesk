"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Bell, Check, Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/ui/user-avatar"
import type { TeamMember } from "@/lib/boards/types"
import { cn } from "@/lib/utils"

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Bell
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="size-3" aria-hidden />
      {children}
    </div>
  )
}

export function TaskAssigneePicker({
  members,
  isLoading,
  assigneeIds,
  assigneeQuery,
  onAssigneeQueryChange,
  onToggleAssignee,
}: {
  members: TeamMember[]
  isLoading: boolean
  assigneeIds: string[]
  assigneeQuery: string
  onAssigneeQueryChange: (value: string) => void
  onToggleAssignee: (id: string) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const [focusIndex, setFocusIndex] = useState(0)

  const filteredMembers = useMemo(() => {
    const q = assigneeQuery.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.initials.toLowerCase().includes(q) ||
        (m.email?.toLowerCase().includes(q) ?? false)
    )
  }, [members, assigneeQuery])

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  const selectedMembers = useMemo(
    () =>
      assigneeIds
        .map((id) => membersById.get(id))
        .filter((m): m is TeamMember => Boolean(m)),
    [assigneeIds, membersById]
  )

  useEffect(() => {
    setFocusIndex(0)
  }, [assigneeQuery, members.length])

  const focusOption = useCallback((index: number) => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-assignee-index="${index}"]`
    )
    el?.focus()
  }, [])

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (filteredMembers.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = (focusIndex + 1) % filteredMembers.length
      setFocusIndex(next)
      focusOption(next)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      const next = (focusIndex - 1 + filteredMembers.length) % filteredMembers.length
      setFocusIndex(next)
      focusOption(next)
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      const m = filteredMembers[focusIndex]
      if (m) onToggleAssignee(m.id)
    }
  }

  const emptyWorkspace = !isLoading && members.length === 0
  const noSearchMatches = !isLoading && members.length > 0 && filteredMembers.length === 0

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel icon={Bell}>Assignees</SectionLabel>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {assigneeIds.length} selected
        </span>
      </div>

      {selectedMembers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {selectedMembers.map((m) => (
              <motion.button
                key={m.id}
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.14 }}
                onClick={() => onToggleAssignee(m.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 py-0.5 pl-0.5 pr-2 text-xs font-medium text-foreground transition-colors hover:bg-primary/15"
                aria-label={`Remove ${m.name}`}
              >
                <UserAvatar
                  name={m.name}
                  initials={m.initials}
                  avatarUrl={m.avatarUrl}
                  color={m.color}
                  size="sm"
                  ringClassName=""
                />
                <span className="max-w-[8rem] truncate">{m.name}</span>
                <X className="size-3 text-muted-foreground" aria-hidden />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      ) : null}

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={assigneeQuery}
          onChange={(e) => onAssigneeQueryChange(e.target.value)}
          placeholder="Search by name or email"
          className="h-9 rounded-lg border-border/70 bg-card pl-8"
          aria-label="Search assignees"
          disabled={emptyWorkspace}
        />
      </div>

      <ul
        ref={listRef}
        role="listbox"
        aria-label="Workspace members"
        aria-multiselectable="true"
        onKeyDown={handleListKeyDown}
        className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-card p-1"
      >
        {isLoading ? (
          <>
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="flex animate-pulse items-center gap-2 rounded-md px-2 py-2"
                aria-hidden
              >
                <motion.div className="size-7 shrink-0 rounded-full bg-muted" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="h-3 w-24 rounded bg-muted" />
                  <div className="h-2.5 w-32 rounded bg-muted/80" />
                </div>
              </li>
            ))}
          </>
        ) : emptyWorkspace ? (
          <li className="px-2 py-4 text-center text-xs text-muted-foreground">
            No workspace members yet. Invite teammates from the workspace page.
          </li>
        ) : noSearchMatches ? (
          <li className="px-2 py-3 text-center text-xs text-muted-foreground">
            No matches for &ldquo;{assigneeQuery.trim()}&rdquo;
          </li>
        ) : (
          <AnimatePresence initial={false}>
            {filteredMembers.map((m, index) => {
              const selected = assigneeIds.includes(m.id)
              return (
                <motion.li
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                >
                  <button
                    type="button"
                    data-assignee-index={index}
                    onClick={() => onToggleAssignee(m.id)}
                    onFocus={() => setFocusIndex(index)}
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                      selected
                        ? "bg-primary/[0.08] text-foreground"
                        : "hover:bg-muted/40"
                    )}
                  >
                    <UserAvatar
                      name={m.name}
                      initials={m.initials}
                      avatarUrl={m.avatarUrl}
                      color={m.color}
                      size="sm"
                      ringClassName=""
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      {m.email ? (
                        <p className="truncate text-[11px] text-muted-foreground">{m.email}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {m.role ? (
                        <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {ROLE_LABEL[m.role] ?? m.role}
                        </span>
                      ) : null}
                      {selected ? (
                        <Check className="size-4 text-primary" aria-hidden />
                      ) : null}
                    </div>
                  </button>
                </motion.li>
              )
            })}
          </AnimatePresence>
        )}
      </ul>
    </section>
  )
}
