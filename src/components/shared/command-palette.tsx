"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  CalendarDays,
  Settings,
  Home,
  Search,
  FileText,
  Zap,
  Megaphone,
} from "lucide-react"

const pages = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Forms", href: "/forms", icon: FileText },
  { name: "Automations", href: "/automations", icon: Zap },
  { name: "Broadcasts", href: "/broadcasts", icon: Megaphone },
  { name: "Agency Home", href: "/agency", icon: Home },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, contacts, deals..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <CommandItem
              key={page.href}
              onSelect={() => navigate(page.href)}
              className="gap-2"
            >
              <page.icon className="size-4" />
              <span>{page.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
