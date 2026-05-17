const STORAGE_KEY = "syncdesk-pending-invite-token"

export function persistInviteToken(token: string): void {
  if (typeof window === "undefined" || !token.trim()) return
  try {
    sessionStorage.setItem(STORAGE_KEY, token.trim())
    localStorage.setItem(STORAGE_KEY, token.trim())
  } catch {
    // Private browsing / blocked storage — URL still carries the token.
  }
}

export function readPersistedInviteToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function clearPersistedInviteToken(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function buildInvitePath(token: string): string {
  return `/invite/${encodeURIComponent(token.trim())}`
}

export function isInvitePath(path: string | null | undefined): boolean {
  if (!path) return false
  return /^\/invite\/[^/]+/.test(path)
}

export function extractInviteTokenFromPath(path: string): string | null {
  const match = path.match(/^\/invite\/([^/?#]+)/)
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}
