import type { Metadata } from "next"
import { Suspense } from "react"

import { RegisterPageClient } from "@/components/auth/register-page-client"
import { APP_NAME } from "@/lib/constants"

export const metadata: Metadata = {
  title: "Register",
  description: `Create your ${APP_NAME} account.`,
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageClient />
    </Suspense>
  )
}
