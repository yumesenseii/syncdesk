"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"

import { Navbar } from "@/components/navbar"
import { RegisterForm } from "@/components/register-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { APP_NAME } from "@/lib/constants"

function safeNextPath(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith("/") || value.startsWith("//")) return null
  return value
}

/**
 * All client hooks for /register live here. The server page wraps this
 * component in <Suspense> so useSearchParams is valid during prerender.
 */
export function RegisterPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) return
    const next = safeNextPath(searchParams.get("next"))
    router.replace(next ?? "/dashboard")
  }, [loading, router, searchParams, user])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (user) return null

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-xl shadow-black/10 dark:shadow-black/40">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Create your account
            </CardTitle>
            <CardDescription>
              Join {APP_NAME} and start organizing academic work with your team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>
      </main>
      <p className="pb-6 text-center text-xs text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          ← Back to home
        </Link>
      </p>
    </div>
  )
}
