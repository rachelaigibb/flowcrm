"use client"

import { useMemo, useState } from "react"
import { Check, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

export interface TagOption {
  name: string
  color: string
}

interface TagPickerProps {
  value: string[]
  onChange: (tags: string[]) => void
  options: TagOption[]
  className?: string
  size?: "sm" | "md"
}

const FALLBACK = "#64748b"

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "-")
}

/**
 * Tag picker: selected tags as coloured pills (× to remove) plus an "Add tag" popover that
 * lists every tag defined for the workspace and offers to create one that doesn't exist yet.
 * New tags are persisted by the contact save (syncNewTags), which also gives them a colour.
 */
export function TagPicker({ value, onChange, options, className, size = "md" }: TagPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const colorOf = (name: string) =>
    options.find((o) => o.name.toLowerCase() === name.toLowerCase())?.color ?? FALLBACK

  const selected = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value])
  const q = normalize(query)
  const exactExists = q.length > 0 && (options.some((o) => o.name.toLowerCase() === q) || selected.has(q))

  function add(name: string) {
    if (!name || selected.has(name.toLowerCase())) return
    onChange([...value, name])
    setQuery("")
  }
  function remove(name: string) {
    onChange(value.filter((v) => v.toLowerCase() !== name.toLowerCase()))
  }

  const pill = size === "sm" ? "h-6 text-[11px] px-2" : "h-7 text-xs px-2.5"

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {value.map((tag) => {
        const color = colorOf(tag)
        return (
          <span
            key={tag}
            className={cn("inline-flex items-center gap-1 rounded-full border font-medium", pill)}
            style={{ backgroundColor: `${color}20`, color, borderColor: `${color}40` }}
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => remove(tag)}
              className="rounded-full opacity-70 hover:opacity-100 focus:outline-none"
            >
              <X className="size-3" />
            </button>
          </span>
        )
      })}

      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery("") }}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("rounded-full border-dashed", size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs")}
            />
          }
        >
          <Plus className="size-3" data-icon="inline-start" />
          Add tag
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search or type a new tag…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{q ? "No matching tag" : "No tags defined yet"}</CommandEmpty>
              <CommandGroup heading="Tags">
                {options
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((o) => {
                    const isSelected = selected.has(o.name.toLowerCase())
                    return (
                      <CommandItem
                        key={o.name}
                        value={o.name}
                        onSelect={() => (isSelected ? remove(o.name) : add(o.name))}
                        className="gap-2"
                      >
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />
                        <span className="flex-1 truncate">{o.name}</span>
                        {isSelected && <Check className="size-3.5 text-muted-foreground" />}
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
              {q && !exactExists && (
                <CommandGroup heading="New">
                  <CommandItem value={`create ${q}`} onSelect={() => { add(q); setOpen(false) }} className="gap-2">
                    <Plus className="size-3.5" />
                    Create “{q}”
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
