"use client"

import { useEffect, useMemo, useState } from "react"
import type { Session } from "@supabase/supabase-js"

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

    const init = async () => {
      try {
        const { data } = await client.auth.getSession()
        if (!isMounted) return
        queueMicrotask(() => {
          setSession(data.session ?? null)
          setLoading(false)
        })
      } catch {
        if (!isMounted) return
        queueMicrotask(() => {
          setSession(null)
          setLoading(false)
        })
      }
    }

    void init()

    const { data } = client.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return
      queueMicrotask(() => {
        setSession(newSession ?? null)
      })
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
