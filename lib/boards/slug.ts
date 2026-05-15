/**
 * URL-safe slug helpers for workspaces.
 *
 * Slugs decouple human-readable URLs from the workspace's stable primary key
 * (`workspace.id`, which is a UUID for any workspace created after the
 * slug-aware migration). The URL segment `/dashboard/workspaces/<slug>` is
 * resolved to the workspace entity at the page layer; every Supabase relation
 * and realtime subscription continues to use `workspace.id` internally.
 */

const SLUG_FALLBACK = "workspace"
const MAX_BASE = 48

export function slugifyWorkspaceName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_BASE)
  return base || SLUG_FALLBACK
}

export function ensureUniqueSlug(base: string, existing: Iterable<string>): string {
  const taken = new Set<string>()
  for (const s of existing) {
    if (typeof s === "string" && s.length > 0) taken.add(s.toLowerCase())
  }
  const root = slugifyWorkspaceName(base)
  if (!taken.has(root)) return root
  let i = 2
  while (taken.has(`${root}-${i}`)) i++
  return `${root}-${i}`
}

const UUID_LIKE_RE = /^[a-f0-9-]{8,}$/i

/**
 * Heuristic: true if the value looks like an opaque database id rather than a
 * human-typed slug. Used to upgrade legacy URLs that still embed the raw id.
 */
export function looksLikeOpaqueId(value: string): boolean {
  if (!value) return false
  if (value.includes("-") && UUID_LIKE_RE.test(value) && value.length >= 32) return true
  return false
}
