import type { InsertActivityEventInput } from "@/lib/syncdesk/activity-remote"
import { insertActivityEvent } from "@/lib/syncdesk/activity-remote"
import { getBoardsRemoteContext } from "@/lib/syncdesk/boards-sync-context"

import { invalidateActivityFeed } from "./activity-invalidation"

/**
 * Fire-and-forget activity log. Skips when Supabase is offline.
 * Invalidates the activity query cache on success.
 */
export function logActivity(input: InsertActivityEventInput) {
  const { client, userId, userEmail } = getBoardsRemoteContext()
  if (!client || !userId) return

  void insertActivityEvent(client, userId, input, userEmail).then(({ error }) => {
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[activity]", error.message)
      }
      return
    }
    invalidateActivityFeed()
  })
}
