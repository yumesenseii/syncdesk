"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { toast } from "sonner"

import { getAuthErrorMessage } from "@/lib/auth-errors"
import { getOptionalSupabaseClient } from "@/lib/supabase"

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const client = getOptionalSupabaseClient()
    if (!client) {
      toast.error("Supabase is not configured.")
      router.replace("/login")
      return
    }

    const code = searchParams.get("code")
    if (!code) {
      toast.error("Missing authorization code.")
      router.replace("/login")
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const { error } = await client.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (error) {
          toast.error(error.message)
          router.replace("/login")
          return
        }
        toast.success("Signed in with Google.")
        router.replace("/dashboard")
        router.refresh()
      } catch (error) {
        if (cancelled) return
        toast.error(getAuthErrorMessage(error))
        router.replace("/login")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
