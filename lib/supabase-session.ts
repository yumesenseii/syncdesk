import type { Session, SupabaseClient } from "@supabase/supabase-js"

import { resetSupabaseClients } from "@/lib/supabase"

const AUTH_STORAGE_PREFIX = "sb-"

/** Stale or revoked session in browser storage (common after env/project changes). */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : ""
  return (
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token") ||
    message.includes("refresh_token_not_found")
  )
}

export function isAuthNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : ""
  return message.includes("failed to fetch") || message.includes("network")
}

/** Remove Supabase auth tokens from both persistence buckets (remember-me toggles). */
export function clearSupabaseAuthStorageKeys(): void {
  if (typeof window === "undefined") return
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key?.startsWith(AUTH_STORAGE_PREFIX) && key.includes("auth-token")) {
        keys.push(key)
      }
    }
    for (const key of keys) {
      storage.removeItem(key)
    }
  }
  resetSupabaseClients()
}

/** Clear local session without requiring a valid refresh token on the server. */
export async function clearSupabaseAuth(client: SupabaseClient): Promise<void> {
  try {
    await client.auth.signOut({ scope: "local" })
  } catch {
    // Refresh may already be invalid — still wipe storage below.
  }
  clearSupabaseAuthStorageKeys()
}

/**
 * Reads the client session and recovers from invalid refresh tokens instead of
 * leaving the Supabase client in a retry loop (console AuthApiError / Failed to fetch).
 */
export async function resolveClientSession(
  client: SupabaseClient
): Promise<{ session: Session | null }> {
  try {
    const { data, error } = await client.auth.getSession()
    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearSupabaseAuth(client)
      }
      return { session: null }
    }
    return { session: data.session ?? null }
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearSupabaseAuth(client)
    }
    return { session: null }
  }
}

export async function signOutSupabase(client: SupabaseClient | null): Promise<void> {
  if (!client) {
    clearSupabaseAuthStorageKeys()
    return
  }
  try {
    const { error } = await client.auth.signOut()
    if (error && isInvalidRefreshTokenError(error)) {
      await clearSupabaseAuth(client)
      return
    }
    if (error) throw error
  } catch (error) {
    if (isInvalidRefreshTokenError(error) || isAuthNetworkError(error)) {
      await clearSupabaseAuth(client)
      return
    }
    throw error
  }
  clearSupabaseAuthStorageKeys()
}
