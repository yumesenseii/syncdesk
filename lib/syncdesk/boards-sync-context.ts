import type { SupabaseClient } from "@supabase/supabase-js"

export type BoardsRemoteContext = {
  client: SupabaseClient | null
  userId: string | null
  userEmail?: string | null
}

let resolveCtx: () => BoardsRemoteContext = () => ({ client: null, userId: null })

export function setBoardsRemoteContextResolver(fn: () => BoardsRemoteContext) {
  resolveCtx = fn
}

export function getBoardsRemoteContext(): BoardsRemoteContext {
  return resolveCtx()
}
