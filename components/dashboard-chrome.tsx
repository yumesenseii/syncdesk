"use client"

import type { ReactNode } from "react"

import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { CreateWorkspaceModalProvider } from "@/components/workspaces/create-workspace-modal"

export function DashboardChrome({
  userName,
  userEmail,
  onLogout,
  header,
  children,
}: {
  userName: string | null
  userEmail: string
  onLogout: () => void
  header?: ReactNode
  children: ReactNode
}) {
  return (
    <CreateWorkspaceModalProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <DashboardSidebar userName={userName} userEmail={userEmail} onLogout={onLogout} />

        <div className="flex min-w-0 flex-1 flex-col">
          {header ? (
            <div className="sticky top-0 z-50 shrink-0 border-b border-border/60 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/55">
              <div className="mx-auto w-full max-w-[92rem] px-4 py-3 sm:px-6 lg:px-8">
                {header}
              </div>
            </div>
          ) : null}

          <main className="dashboard-scroll flex-1 overflow-y-auto overflow-x-hidden">
            <div className="mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </CreateWorkspaceModalProvider>
  )
}
