"use client"

import type { ReactNode } from "react"

import { BoardsStoreHydration } from "@/components/boards/boards-store-hydration"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BoardsStoreHydration />
      {children}
    </>
  )
}
