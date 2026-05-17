"use client"

import { useParams } from "next/navigation"

import { InviteOnboardingFlow } from "@/components/invite/invite-onboarding-flow"
import { persistInviteToken } from "@/lib/invite"
import { useEffect } from "react"

export function InvitePageClient() {
  const params = useParams<{ token: string }>()
  const raw = params?.token ?? ""
  let token = raw
  try {
    token = decodeURIComponent(raw)
  } catch {
    token = raw
  }

  useEffect(() => {
    if (token) persistInviteToken(token)
  }, [token])

  return <InviteOnboardingFlow token={token} />
}
