"use client"

import type { FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { getAuthErrorMessage } from "@/lib/auth-errors"
import { validateRegister } from "@/lib/auth-validation"
import type { FieldErrors, RegisterFormValues } from "@/types/auth"

export function RegisterForm() {
  const router = useRouter()
  const [values, setValues] = useState<RegisterFormValues>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const nextErrors = validateRegister(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields.")
      return
    }

    setLoading(true)
    try {
      const client = getOptionalSupabaseClient()
      if (!client) {
        toast.error(
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
        )
        return
      }
      const { data, error } = await client.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          data: {
            full_name: values.fullName.trim(),
          },
        },
      })

      if (error) {
        toast.error(error.message)
        return
      }

      const hasSession = Boolean(data.session)
      if (hasSession) {
        toast.success("Account created! Redirecting…")
        setRedirecting(true)
        setTimeout(() => {
          router.push("/dashboard")
          router.refresh()
        }, 650)
        return
      }

      // If email confirmation is enabled, there won't be a session yet.
      toast.success("Check your email to confirm your account.")
      router.push("/login")
      router.refresh()
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="relative flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="register-name">Full name</Label>
        <Input
          id="register-name"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Alex Student"
          className="h-10"
          value={values.fullName}
          onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
          aria-invalid={Boolean(errors.fullName)}
        />
        {errors.fullName ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.fullName}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
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
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
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

      <div className="space-y-2">
        <Label htmlFor="register-confirm">Confirm password</Label>
        <Input
          id="register-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat password"
          className="h-10"
          value={values.confirmPassword}
          onChange={(e) =>
            setValues((v) => ({ ...v, confirmPassword: e.target.value }))
          }
          aria-invalid={Boolean(errors.confirmPassword)}
        />
        {errors.confirmPassword ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.confirmPassword}
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="accept-terms"
          checked={values.acceptTerms}
          onCheckedChange={(v) =>
            setValues((prev) => ({ ...prev, acceptTerms: Boolean(v) }))
          }
        />
        <div className="space-y-1">
          <Label htmlFor="accept-terms" className="text-sm">
            I agree to the Terms of Service and Privacy Policy.
          </Label>
          {errors.acceptTerms ? (
            <p className="text-xs text-destructive" role="alert">
              {errors.acceptTerms}
            </p>
          ) : null}
        </div>
      </div>

      <Button
        type="submit"
        className="mt-1 w-full gap-2 shadow-md shadow-primary/20"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Creating account…
          </>
        ) : (
          "Register"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Login
        </Link>
      </p>

      {redirecting ? (
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-background/40 opacity-100 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card/80 px-6 py-4 shadow-sm">
              <div className="text-sm font-medium text-foreground">Redirecting…</div>
              <div className="text-xs text-muted-foreground">Preparing your workspace</div>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  )
}
