"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

const sizeClasses = {
  xs: "size-6 text-[10px]",
  sm: "size-7 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-10 text-xs",
  xl: "size-20 text-lg",
} as const

export type UserAvatarSize = keyof typeof sizeClasses

export function UserAvatar({
  name,
  initials,
  avatarUrl,
  color = "bg-primary/15 text-primary",
  size = "md",
  className,
  ringClassName,
  rounded = "full",
}: {
  name: string
  initials: string
  avatarUrl?: string | null
  color?: string
  size?: UserAvatarSize
  className?: string
  ringClassName?: string
  rounded?: "full" | "2xl"
}) {
  const [broken, setBroken] = useState(false)
  const showImage = Boolean(avatarUrl?.trim()) && !broken

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden font-semibold",
        rounded === "2xl" ? "rounded-2xl" : "rounded-full",
        sizeClasses[size],
        !showImage && color,
        ringClassName,
        className
      )}
      title={name}
      aria-label={name}
      role="img"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl!}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </div>
  )
}
