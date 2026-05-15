"use client"

import Link from "next/link"

import { AuthRedirectIfAuthenticated } from "@/components/auth-redirect"
import { Navbar } from "@/components/navbar"
import { RegisterForm } from "@/components/register-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { APP_NAME } from "@/lib/constants"

/**
 * Client shell for /register. Auth redirect (useSearchParams) lives in
 * AuthRedirectIfAuthenticated, which is wrapped in Suspense there and on the page.
 */
export function RegisterPageContent() {
  return (
    <AuthRedirectIfAuthenticated redirectTo="/dashboard">
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
    </AuthRedirectIfAuthenticated>
  )
}
