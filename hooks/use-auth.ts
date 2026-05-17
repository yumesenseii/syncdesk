"use client"

import { useEffect, useMemo, useState } from "react"
import type { Session } from "@supabase/supabase-js"

import { resolveClientSession } from "@/lib/supabase-session"
import { getOptionalSupabaseClient } from "@/lib/supabase"

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let subscription: { unsubscribe: () => void } | null = null
    const client = getOptionalSupabaseClient()

    if (!client) {
      queueMicrotask(() => {
        setSession(null)
        setLoading(false)
      })
      return () => {
        isMounted = false
      }
    }

    const syncSession = async () => {
      const { session: nextSession } = await resolveClientSession(client)
      if (!isMounted) return
      setSession(nextSession)
      setLoading(false)
    }

    void syncSession()

    const { data } = client.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return

      if (event === "SIGNED_OUT") {
        setSession(null)
        setLoading(false)
        return
      }

      if (newSession) {
        setSession(newSession)
        setLoading(false)
        return
      }

      // Refresh may have failed — re-resolve (clears invalid tokens if needed).
      void syncSession()
    })

    subscription = data.subscription

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const user = useMemo(() => session?.user ?? null, [session])

  return { session, user, loading }
}
