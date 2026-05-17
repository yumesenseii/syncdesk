"use client"

import type { ReactNode } from "react"
import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useAuth } from "@/hooks/use-auth"
import { safeInternalPath } from "@/lib/invite"

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
    const nextParam = searchParams.get("next")
    router.replace(nextParam ? safeInternalPath(nextParam) : redirectTo)
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
