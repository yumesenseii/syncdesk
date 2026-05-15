"use client"

import { motion } from "framer-motion"
import { ActivityCollaborationRail } from "@/components/activity/activity-collaboration-rail"
import { ActivityFeed } from "@/components/activity/activity-feed"
import type { ActivityDateRange, ActivityType } from "@/lib/activity/events"
import { useActivityEventsQuery } from "@/hooks/use-activity-events"

export function ActivityView({
  userId,
  searchQuery,
  type,
  range,
  workspaceId,
}: {
  userId: string | null
  searchQuery: string
  type: ActivityType
  range: ActivityDateRange
  workspaceId: string | "all"
}) {
  const { events, isLoading } = useActivityEventsQuery(workspaceId)

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="space-y-1"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Workspace timeline
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Activity
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Track recent workspace actions, task updates, assignments, completions, and overdue
          deadlines across your boards in real time.
        </p>
      </motion.header>

      <div className="grid items-start gap-6 xl:grid-cols-12 xl:gap-8">
        <div className="xl:col-span-8">
          <ActivityFeed
            events={events}
            isLoading={isLoading}
            searchQuery={searchQuery}
            type={type}
            range={range}
            workspaceId={workspaceId}
          />
        </div>
        <div className="xl:col-span-4">
          <ActivityCollaborationRail userId={userId} />
        </div>
      </div>
    </div>
  )
}
