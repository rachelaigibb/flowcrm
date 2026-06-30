"use client"

import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"
import { useEffect, useState } from "react"
import { updateSubAccountTheme } from "@/features/settings/actions"

interface ThemeToggleProps {
  subAccountId?: string
}

export function ThemeToggle({ subAccountId }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  const options = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ] as const

  function handleThemeChange(value: string) {
    setTheme(value)
    if (subAccountId) {
      updateSubAccountTheme(subAccountId, value)
    }
  }

  return (
    <div className="flex items-center rounded-lg border p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => handleThemeChange(opt.value)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            theme === opt.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <opt.icon className="size-4" />
          {opt.label}
        </button>
      ))}
    </div>
  )
}
