"use client"

import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      const stored = localStorage.getItem("syncdesk-theme")
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      const dark = stored ? stored === "dark" : prefersDark
      document.documentElement.classList.toggle("dark", dark)
      setIsDark(dark)
    })
  }, [])

  const toggle = () => {
    const root = document.documentElement
    const nextDark = !root.classList.contains("dark")
    root.classList.toggle("dark", nextDark)
    localStorage.setItem("syncdesk-theme", nextDark ? "dark" : "light")
    setIsDark(nextDark)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 transition-transform hover:scale-105"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
