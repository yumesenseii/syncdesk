const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return ""
  const diff = now - ts
  if (diff < MINUTE) return "just now"
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE)
    return `${m}m ago`
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR)
    return `${h}h ago`
  }
  if (diff < 7 * DAY) {
    const d = Math.floor(diff / DAY)
    return `${d}d ago`
  }
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}
