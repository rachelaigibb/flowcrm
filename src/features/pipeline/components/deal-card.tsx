"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { formatCurrencyCompact } from "@/lib/utils/currency"
import { formatDateShort } from "@/lib/utils/dates"
import { GripVertical, Calendar, User } from "lucide-react"
import type { DealWithContact } from "../types"

const PRIORITY_STYLES: Record<string, { variant: "secondary" | "outline" | "destructive"; label: string }> = {
  low: { variant: "secondary", label: "Low" },
  medium: { variant: "outline", label: "Medium" },
  high: { variant: "destructive", label: "High" },
}

interface DealCardProps {
  deal: DealWithContact
  onClick: () => void
}

export function DealCard({ deal, onClick }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal.id,
    data: {
      type: "deal",
      deal,
      stageId: deal.stage_id,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const priorityStyle = PRIORITY_STYLES[deal.priority] ?? PRIORITY_STYLES.low
  const contactName = deal.contact
    ? [deal.contact.first_name, deal.contact.last_name].filter(Boolean).join(" ")
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md cursor-pointer",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/20"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-muted-foreground group-hover:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {deal.title}
            </p>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {formatCurrencyCompact(deal.value, deal.currency)}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={priorityStyle.variant} className="text-[10px] px-1.5 h-4">
              {priorityStyle.label}
            </Badge>
            {deal.status !== "open" && (
              <Badge
                variant={deal.status === "won" ? "default" : "destructive"}
                className="text-[10px] px-1.5 h-4"
              >
                {deal.status === "won" ? "Won" : "Lost"}
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            {contactName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="size-3 shrink-0" />
                <span className="truncate">{contactName}</span>
              </div>
            )}
            {deal.expected_close && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="size-3 shrink-0" />
                <span>{formatDateShort(deal.expected_close)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
