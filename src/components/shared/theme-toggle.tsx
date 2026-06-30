"use client"

import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

/**
 * Compact theme toggle for the header bar.
 * Cycles: dark → light → system → dark
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  function cycleTheme() {
    if (theme === "dark") setTheme("light")
    else if (theme === "light") setTheme("system")
    else setTheme("dark")
  }

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor
  const label = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System"

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={cycleTheme}
      title={`Theme: ${label}. Click to change.`}
      className="text-muted-foreground hover:text-foreground"
    >
      <Icon className="size-4" />
    </Button>
  )
}
