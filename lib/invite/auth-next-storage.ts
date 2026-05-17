const NEXT_KEY = "syncdesk-auth-next-path"

export function persistAuthNextPath(path: string): void {
  if (typeof window === "undefined" || !path.startsWith("/")) return
  try {
    sessionStorage.setItem(NEXT_KEY, path)
  } catch {
    // ignore
  }
}

export function readAuthNextPath(): string | null {
  if (typeof window === "undefined") return null
  try {
    return sessionStorage.getItem(NEXT_KEY)
  } catch {
    return null
  }
}

export function clearAuthNextPath(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(NEXT_KEY)
  } catch {
    // ignore
  }
}

export function safeInternalPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback
  if (!value.startsWith("/") || value.startsWith("//")) return fallback
  return value
}

export function resolvePostAuthPath(): string {
  const next = readAuthNextPath()
  if (next) return safeInternalPath(next)
  return "/dashboard"
}
