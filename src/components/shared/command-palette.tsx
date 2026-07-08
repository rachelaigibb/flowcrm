"use client"

import { useEffect, useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { aiSearch, type AISearchResponse } from "@/features/ai/actions"
import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  CalendarDays,
  Settings,
  Home,
  FileText,
  Zap,
  Megaphone,
  BarChart3,
  Sparkles,
  Loader2,
  ArrowRight,
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
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Agency Home", href: "/agency", icon: Home },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [aiResponse, setAiResponse] = useState<AISearchResponse | null>(null)
  const [isSearching, startSearching] = useTransition()
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
      setQuery("")
      setAiResponse(null)
      router.push(href)
    },
    [router]
  )

  function handleQueryChange(value: string) {
    setQuery(value)
    // A new query invalidates previous AI results
    if (aiResponse) setAiResponse(null)
  }

  function handleAskAI() {
    const q = query.trim()
    if (!q) return
    startSearching(async () => {
      const result = await aiSearch(q)
      if (result.error) {
        setAiResponse({ interpretation: result.error, results: [] })
      } else if (result.data) {
        setAiResponse(result.data)
      }
    })
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search pages, or ask AI anything..."
        value={query}
        onValueChange={handleQueryChange}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {query.trim().length > 2 && (
          <CommandGroup heading="AI Search">
            <CommandItem
              // value includes the live query so cmdk's filter always matches
              value={`ask-ai ${query}`}
              onSelect={handleAskAI}
              disabled={isSearching}
              className="gap-2"
            >
              {isSearching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              <span>
                Ask AI: <span className="font-medium">{query}</span>
              </span>
            </CommandItem>
            {aiResponse && (
              <>
                <CommandItem value={`ai-interpretation ${query}`} disabled className="text-xs">
                  {aiResponse.results.length > 0
                    ? `${aiResponse.interpretation} — ${aiResponse.results.length} result${aiResponse.results.length === 1 ? "" : "s"}`
                    : aiResponse.interpretation}
                </CommandItem>
                {aiResponse.results.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`ai-result ${r.id} ${query}`}
                    onSelect={() => navigate(r.href)}
                    className="gap-2"
                  >
                    <ArrowRight className="size-4" />
                    <div className="flex flex-col">
                      <span>{r.title}</span>
                      {r.subtitle && (
                        <span className="text-xs text-muted-foreground">{r.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </>
            )}
          </CommandGroup>
        )}

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
