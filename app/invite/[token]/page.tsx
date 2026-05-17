import { Suspense } from "react"

import { InvitePageClient } from "@/components/invite/invite-page-client"

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-card px-4">
          <p className="text-sm text-muted-foreground">Loading invitation…</p>
        </div>
      }
    >
      <InvitePageClient />
    </Suspense>
  )
}
