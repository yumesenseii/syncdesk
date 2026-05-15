import type { Metadata } from "next"
import { Suspense } from "react"

import { RegisterPageContent } from "@/components/register/register-page-content"
import { APP_NAME } from "@/lib/constants"

export const metadata: Metadata = {
  title: "Register",
  description: `Create your ${APP_NAME} account.`,
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  )
}
