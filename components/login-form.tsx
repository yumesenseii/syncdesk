"use client"

import type { FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  extractInviteTokenFromPath,
  isInvitePath,
  persistAuthNextPath,
  persistInviteToken,
  safeInternalPath,
} from "@/lib/invite"
import { getOptionalSupabaseClient, setRememberMePreference } from "@/lib/supabase"
import { getAuthErrorMessage } from "@/lib/auth-errors"
import { validateLogin } from "@/lib/auth-validation"
import type { FieldErrors, LoginFormValues } from "@/types/auth"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = safeInternalPath(searchParams?.get("next") ?? null)

  useEffect(() => {
    persistAuthNextPath(nextPath)
    if (isInvitePath(nextPath)) {
      const token = extractInviteTokenFromPath(nextPath)
      if (token) persistInviteToken(token)
    }
  }, [nextPath])
  const [values, setValues] = useState<LoginFormValues>({
    email: "",
    password: "",
    rememberMe: true,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotLoading, setForgotLoading] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const nextErrors = validateLogin(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields.")
      return
    }

    setLoading(true)
    setRememberMePreference(values.rememberMe)
    try {
      const client = getOptionalSupabaseClient()
      if (!client) {
        toast.error(
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
        )
        return
      }
      const { error } = await client.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success("Welcome back!")
      setRedirecting(true)
      setTimeout(() => {
        router.push(nextPath)
        router.refresh()
      }, 650)
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    setRememberMePreference(values.rememberMe)
    try {
      const client = getOptionalSupabaseClient()
      if (!client) {
        toast.error(
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
        )
        return
      }
      persistAuthNextPath(nextPath)
      const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
        },
      })
      if (error) {
        toast.error(error.message)
      }
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    }
  }

  return (
    <form className="relative flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@university.edu"
          className="h-10"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="h-10"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          aria-invalid={Boolean(errors.password)}
        />
        {errors.password ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.password}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="remember-me"
            checked={values.rememberMe}
            onCheckedChange={(v) => setValues((prev) => ({ ...prev, rememberMe: Boolean(v) }))}
          />
          <Label htmlFor="remember-me" className="text-sm">
            Remember me
          </Label>
        </div>

        <button
          type="button"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => {
            setForgotEmail(values.email)
            setForgotOpen(true)
          }}
        >
          Forgot password?
        </button>
      </div>

      <Button
        type="submit"
        className="mt-1 w-full gap-2 shadow-md shadow-primary/20"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Signing in…
          </>
        ) : (
          "Login"
        )}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 transition-transform hover:scale-[1.01]"
        onClick={signInWithGoogle}
      >
        <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Google
      </Button>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => toast.message("GitHub login is coming soon.")}
        >
          <span className="inline-block size-4 rounded border border-border bg-background" aria-hidden />
          GitHub
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => toast.message("LinkedIn login is coming soon.")}
        >
          <span className="inline-block size-4 rounded border border-border bg-background" aria-hidden />
          LinkedIn
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link
          href={
            nextPath !== "/dashboard"
              ? `/register?next=${encodeURIComponent(nextPath)}`
              : "/register"
          }
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Register
        </Link>
      </p>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter your email and we’ll send a reset link using Supabase auth.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="you@university.edu"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={async () => {
                const email = forgotEmail.trim()
                if (!email) {
                  toast.error("Please enter your email.")
                  return
                }

                setForgotLoading(true)
                try {
                  const client = getOptionalSupabaseClient()
                  if (!client) {
                    toast.error(
                      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
                    )
                    return
                  }
                  // Supabase will email the user a reset link.
                  const { error } = await client.auth.resetPasswordForEmail(email, {
                    redirectTo:
                      typeof window !== "undefined"
                        ? `${window.location.origin}/login`
                        : undefined,
                  })
                  if (error) {
                    toast.error(error.message)
                    return
                  }
                  toast.success("Check your inbox for the reset link.")
                  setForgotOpen(false)
                } catch (error) {
                  toast.error(getAuthErrorMessage(error))
                } finally {
                  setForgotLoading(false)
                }
              }}
              disabled={forgotLoading}
            >
              {forgotLoading ? "Sending…" : "Send reset link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {redirecting ? (
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-background/40 opacity-100 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card/80 px-6 py-4 shadow-sm">
              <div className="text-sm font-medium text-foreground">Redirecting…</div>
              <div className="text-xs text-muted-foreground">Preparing your dashboard</div>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  )
}
