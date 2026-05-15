"use client"

import { useCallback, useId, useRef, useState } from "react"
import { Camera, Loader2, Trash2 } from "lucide-react"

import { UserAvatar } from "@/components/ui/user-avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

export function ProfileAvatarUpload({
  name,
  initials,
  avatarUrl,
  previewUrl,
  uploading,
  onPickFile,
  onRemove,
  disabled,
}: {
  name: string
  initials: string
  avatarUrl: string | null
  previewUrl: string | null
  uploading: boolean
  onPickFile: (file: File) => void
  onRemove: () => void
  disabled?: boolean
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const displayUrl = previewUrl ?? avatarUrl

  const openPicker = useCallback(() => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }, [disabled, uploading])

  const onFileChange = (file: File | null) => {
    if (!file) return
    onPickFile(file)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={disabled || uploading}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (disabled || uploading) return
          const file = e.dataTransfer.files?.[0]
          if (file) onFileChange(file)
        }}
        className={cn(
          "group relative flex size-20 shrink-0 items-center justify-center rounded-2xl outline-none transition-shadow",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          dragOver && "ring-2 ring-primary/40",
          !disabled && !uploading && "cursor-pointer hover:shadow-md"
        )}
        aria-label="Upload profile photo"
      >
        <UserAvatar
          name={name}
          initials={initials}
          avatarUrl={displayUrl}
          size="xl"
          rounded="2xl"
          className="shadow-sm shadow-black/[0.06]"
          color="bg-gradient-to-br from-primary to-sky-500 text-primary-foreground"
        />
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-white opacity-0 transition-opacity",
            "group-hover:opacity-100 group-focus-visible:opacity-100",
            uploading && "opacity-100"
          )}
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin" aria-hidden />
          ) : (
            <Camera className="size-6" aria-hidden />
          )}
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-2">
        <p className="text-sm font-medium text-foreground">Profile photo</p>
        <p className="text-xs text-muted-foreground">
          Click the avatar to upload. JPEG, PNG, WebP or GIF · max 2 MB. Images are compressed
          automatically.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openPicker}
            disabled={disabled || uploading}
          >
            {displayUrl ? "Replace photo" : "Upload photo"}
          </Button>
          {(displayUrl || avatarUrl) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={disabled || uploading}
              className="text-muted-foreground"
            >
              <Trash2 className="mr-1.5 size-3.5" aria-hidden />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}



