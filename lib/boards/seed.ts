import type { BoardSettings } from "@/lib/boards/types"

/**
 * Default settings applied to every board until the user customizes them. This
 * is *not* sample data — it's a configuration template required by the schema
 * (visibility, default priority, label palette, etc.). All other "SEED_*"
 * datasets have been removed so production accounts only ever display data
 * the user (or their teammates) have created.
 */
export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  visibility: "team",
  defaultPriority: "Medium",
  defaultColumn: "todo",
  notifications: {
    email: true,
    inApp: true,
    weeklyDigest: false,
  },
  labels: [
    { id: "l-design", name: "Design", color: "bg-fuchsia-500/15 text-fuchsia-700" },
    { id: "l-api", name: "API", color: "bg-primary/15 text-primary" },
    { id: "l-launch", name: "Launch", color: "bg-emerald-500/15 text-emerald-700" },
    { id: "l-bug", name: "Bug", color: "bg-rose-500/15 text-rose-700" },
  ],
  automation: {
    autoMoveOverdue: false,
    autoArchiveCompleted: false,
    notifyOnAssign: true,
    notifyOnDue: true,
  },
}
