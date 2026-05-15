import type { SupabaseClient } from "@supabase/supabase-js"

export const AVATAR_BUCKET = "avatars"
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const AVATAR_MAX_DIMENSION = 512

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

export function avatarObjectPath(userId: string, ext = "webp"): string {
  return `${userId}/profile.${ext}`
}

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Please choose a JPEG, PNG, WebP, or GIF image."
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return "Image must be 2 MB or smaller."
  }
  return null
}

/** Resize/compress in-browser before upload. */
export async function compressAvatarFile(file: File): Promise<Blob> {
  if (file.type === "image/gif") {
    if (file.size <= AVATAR_MAX_BYTES) return file
    throw new Error("GIF avatars must be 2 MB or smaller.")
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    bitmap.close()
    throw new Error("Could not process image.")
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not compress image."))),
      "image/webp",
      0.85
    )
  })

  if (blob.size > AVATAR_MAX_BYTES) {
    throw new Error("Image is too large after compression. Try a smaller file.")
  }
  return blob
}

export function getPublicAvatarUrl(client: SupabaseClient, path: string): string {
  const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  const base = data.publicUrl
  return `${base}${base.includes("?") ? "&" : "?"}v=${Date.now()}`
}

export async function uploadAvatar(
  client: SupabaseClient,
  userId: string,
  file: File
): Promise<string> {
  const validation = validateAvatarFile(file)
  if (validation) throw new Error(validation)

  const blob = await compressAvatarFile(file)
  const path = avatarObjectPath(userId, "webp")

  const { error } = await client.storage.from(AVATAR_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "image/webp",
    cacheControl: "3600",
  })
  if (error) throw new Error(error.message)

  return getPublicAvatarUrl(client, path)
}

export async function removeAvatarFiles(
  client: SupabaseClient,
  userId: string
): Promise<void> {
  const prefix = `${userId}/`
  const { data, error } = await client.storage.from(AVATAR_BUCKET).list(userId)
  if (error) throw new Error(error.message)
  if (!data?.length) return

  const paths = data.map((o) => `${prefix}${o.name}`)
  const { error: delErr } = await client.storage.from(AVATAR_BUCKET).remove(paths)
  if (delErr) throw new Error(delErr.message)
}
