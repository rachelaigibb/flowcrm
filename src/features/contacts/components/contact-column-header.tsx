"use client"

import { useRef } from "react"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"

export const CONTACT_COLUMNS = [
  { key: "name", label: "Name", width: 220 },
  { key: "email", label: "Email", width: 260 },
  { key: "phone", label: "Phone", width: 160 },
  { key: "company", label: "Company", width: 180 },
  { key: "source", label: "Source", width: 160 },
  { key: "tags", label: "Tags", width: 220 },
  { key: "last_contact", label: "Last contact", width: 160 },
  { key: "created_at", label: "Created", width: 160 },
] as const
export type ContactSortField = (typeof CONTACT_COLUMNS)[number]["key"]
export const MIN_COLUMN_WIDTH = 100
export const MAX_COLUMN_WIDTH = 800

export function ContactColumnHeader({ label, width, sort, onSort, onWidth }: {
  label: string
  width: number
  sort: "asc" | "desc" | null
  onSort: () => void
  onWidth: (width: number) => void
}) {
  const drag = useRef<{ x: number; width: number; pointerId: number } | null>(null)
  function resize(value: number) {
    onWidth(Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, value)))
  }
  return (
    <TableHead className="relative pr-4" aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none"}>
      <button type="button" className="flex w-full min-w-0 items-center gap-1 hover:text-foreground" onClick={onSort}
        title={`${label}: ${sort === "asc" ? "ascending; click for descending" : sort === "desc" ? "descending; click to turn sorting off" : "click for ascending"}`}>
        <span className="truncate">{label}</span>
        {sort === "asc" ? <ChevronUp className="size-3.5 shrink-0" /> : sort === "desc" ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />}
      </button>
      <div role="separator" aria-label={`Resize ${label} column`} aria-orientation="vertical" tabIndex={0}
        aria-valuemin={MIN_COLUMN_WIDTH} aria-valuemax={MAX_COLUMN_WIDTH} aria-valuenow={width}
        className="absolute inset-y-0 right-0 z-10 w-3 cursor-col-resize touch-none select-none border-r border-border hover:bg-primary/15 focus-visible:bg-primary/15 focus-visible:outline-2 focus-visible:outline-ring"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => {
          if (e.button !== 0) return
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { x: e.clientX, width, pointerId: e.pointerId }
        }}
        onPointerMove={e => {
          if (drag.current && drag.current.pointerId === e.pointerId) resize(drag.current.width + e.clientX - drag.current.x)
        }}
        onPointerUp={e => {
          if (!drag.current || drag.current.pointerId !== e.pointerId) return
          drag.current = null
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
        onPointerCancel={() => { drag.current = null }}
        onLostPointerCapture={() => { drag.current = null }}
        onKeyDown={e => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault()
            resize(width + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 50 : 10))
          }
        }}
      />
    </TableHead>
  )
}
