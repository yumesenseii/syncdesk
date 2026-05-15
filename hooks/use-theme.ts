"use client"

import { useEffect, useState } from "react"

type ThemeMode = "light" | "dark"

function readResolved(): ThemeMode {
  if (typeof document === "undefined") return "light"
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

/**
 * Tracks the active `.dark` class on `<html>` for client UI (e.g. toasts).
 */
export function useTheme() {
  const [resolved, setResolved] = useState<ThemeMode>("light")

  useEffect(() => {
    const el = document.documentElement
    queueMicrotask(() => {
      setResolved(readResolved())
    })
    const observer = new MutationObserver(() => {
      setResolved(readResolved())
    })
    observer.observe(el, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return { resolved }
}
