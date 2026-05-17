/** Case-insensitive email comparison for invite acceptance. */
export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function formatInviteRole(role: string): string {
  if (role === "admin") return "Admin"
  if (role === "viewer") return "Viewer"
  return "Member"
}
