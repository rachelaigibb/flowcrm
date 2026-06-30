"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef } from "react"

interface ThemeSyncerProps {
  subAccountTheme: string | null
}

/**
 * Syncs the next-themes theme with the current sub-account's stored theme preference.
 * When the sub-account changes (page reload on switch), this reads the stored theme
 * and applies it so each sub-account can have its own light/dark/system preference.
 */
export function ThemeSyncer({ subAccountTheme }: ThemeSyncerProps) {
  const { setTheme } = useTheme()
  const hasApplied = useRef(false)

  useEffect(() => {
    if (subAccountTheme && !hasApplied.current) {
      setTheme(subAccountTheme)
      hasApplied.current = true
    }
  }, [subAccountTheme, setTheme])

  return null
}
