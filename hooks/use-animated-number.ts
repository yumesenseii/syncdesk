"use client"

import { useEffect, useState } from "react"
import { animate } from "framer-motion"

/**
 * Smoothly tweens a number from 0 → target for count-up displays.
 * Respects prefers-reduced-motion by collapsing the animation to a single tick.
 */
export function useAnimatedNumber(
  target: number,
  options: { duration?: number; delay?: number } = {}
) {
  const { duration = 1.2, delay = 0 } = options
  const [value, setValue] = useState(0)

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const controls = animate(0, target, {
      duration: reduced ? 0 : duration,
      delay: reduced ? 0 : delay,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: (v) => setValue(v),
    })

    return () => controls.stop()
  }, [target, duration, delay])

  return value
}
