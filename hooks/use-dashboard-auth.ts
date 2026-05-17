"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { getAuthErrorMessage } from "@/lib/auth-errors"
import { getFullNameFromMetadata } from "@/lib/user-profile"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { signOutSupabase } from "@/lib/supabase-session"
import { useAuth } from "@/hooks/use-auth"

export function useDashboardAuth() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (loading) return
    if (user) return
    router.replace("/login")
  }, [loading, router, user])

  const welcomeName = useMemo(() => {
    if (!user) return null
    const fullName = getFullNameFromMetadata(user.user_metadata)
    return fullName ?? user.email ?? null
  }, [user])

  const fullName = useMemo(() => {
    if (!user) return null
    return getFullNameFromMetadata(user.user_metadata)
  }, [user])

  const onLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      const client = getOptionalSupabaseClient()
      await signOutSupabase(client)
      toast.success("You’ve been signed out.")
      router.replace("/login")
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setLoggingOut(false)
    }
  }, [router])

  return {
    user,
    userId: user?.id ?? null,
    loading,
    loggingOut,
    welcomeName,
    fullName,
    onLogout,
  }
}
