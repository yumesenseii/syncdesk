"use client"

import Image from "next/image"

import { APP_NAME } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface LogoMarkProps {
  /** Pixel width/height of the logo image (square). */
  size?: number
  className?: string
  priority?: boolean
}

/**
 * Brand mark for SyncDesk (image: `Gemini_Generated_Image_df200udf200udf20-removebg-preview.png` → `/public/logo.png`).
 */
export function LogoMark({ size = 36, className, priority }: LogoMarkProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background shadow-sm ring-1 ring-border/60 dark:bg-muted/30",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo.png"
        alt={`${APP_NAME} logo`}
        width={size}
        height={size}
        className="object-contain p-0.5"
        priority={priority}
        sizes={`${size}px`}
      />
    </span>
  )
}
