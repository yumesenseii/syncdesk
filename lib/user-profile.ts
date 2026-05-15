export type StudentMetadata = Record<string, unknown>

export function getFullNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null
  const m = metadata as StudentMetadata
  const fullName = m.full_name
  return typeof fullName === "string" && fullName.trim() ? fullName : null
}
