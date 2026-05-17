import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseEnvOptional } from "@/lib/supabase-config"

const REMEMBER_KEY = "syncdesk-remember-me"

let persistClient: SupabaseClient | null = null
let sessionClient: SupabaseClient | null = null

function isBrowser() {
  return typeof window !== "undefined"
}

function getRememberPref(): boolean {
  if (!isBrowser()) return true
  const v = window.localStorage.getItem(REMEMBER_KEY)
  return v === "false" ? false : true
}

export function setRememberMePreference(rememberMe: boolean) {
  if (!isBrowser()) return
  window.localStorage.setItem(REMEMBER_KEY, rememberMe ? "true" : "false")
}

function createForPersist(
  env: { url: string; anonKey: string },
  persistSession: boolean
) {
  if (persistSession) {
    if (persistClient) return persistClient
    persistClient = createClient(env.url, env.anonKey, {
      auth: {
        persistSession: true,
        storage: isBrowser() ? window.localStorage : undefined,
      },
    })
    return persistClient
  }

  if (sessionClient) return sessionClient
  sessionClient = createClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      storage: isBrowser() ? window.sessionStorage : undefined,
    },
  })
  return sessionClient
}

/** Returns null when public Supabase env vars are not set (local / preview builds). */
export function getOptionalSupabaseClient(): SupabaseClient | null {
  const env = getSupabaseEnvOptional()
  if (!env) return null
  return createForPersist(env, getRememberPref())
}

export function getSupabaseClient(): SupabaseClient {
  const env = getSupabaseEnvOptional()
  if (!env) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local (see Supabase project settings → API)."
    )
  }
  return createForPersist(env, getRememberPref())
}

/** Drop cached clients after clearing auth storage (e.g. invalid refresh token). */
export function resetSupabaseClients(): void {
  persistClient = null
  sessionClient = null
}
