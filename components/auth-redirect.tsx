"use client"

import type { ReactNode } from "react"
import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useAuth } from "@/hooks/use-auth"

function safeNextPath(value: string | null): string | null {
  if (!value) return null
  // Only allow internal relative paths to avoid open-redirects.
  if (!value.startsWith("/") || value.startsWith("//")) return null
  return value
}

function AuthRedirectIfAuthenticatedInner({
  redirectTo,
  children,
}: {
  redirectTo: string
  children: ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) return
    const next = safeNextPath(searchParams.get("next"))
    router.replace(next ?? redirectTo)
  }, [loading, redirectTo, router, searchParams, user])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (user) return null

  return <>{children}</>
}

export function AuthRedirectIfAuthenticated({
  redirectTo,
  children,
}: {
  redirectTo: string
  children: ReactNode
}) {
  return (
    <Suspense fallback={null}>
      <AuthRedirectIfAuthenticatedInner redirectTo={redirectTo}>
        {children}
      </AuthRedirectIfAuthenticatedInner>
    </Suspense>
  )
}
