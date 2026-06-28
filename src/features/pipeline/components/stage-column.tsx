"use client"

import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import { formatCurrencyCompact } from "@/lib/utils/currency"
import { DealCard } from "./deal-card"
import type { DealWithContact } from "../types"
import type { PipelineStage } from "@/types/database"

interface StageColumnProps {
  stage: PipelineStage
  deals: DealWithContact[]
  onDealClick: (deal: DealWithContact) => void
}

export function StageColumn({ stage, deals, onDealClick }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
    data: {
      type: "stage",
      stageId: stage.id,
    },
  })

  const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0)
  // Use the first deal's currency for the total, or default to USD
  const currency = deals[0]?.currency ?? "USD"

  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-lg bg-muted/30">
      {/* Stage header */}
      <div className="flex items-center gap-2 px-3 py-3">
        <div
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <h3 className="truncate text-sm font-medium text-foreground">
          {stage.name}
        </h3>
        <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {deals.length}
        </span>
      </div>
      {deals.length > 0 && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground">
            {formatCurrencyCompact(totalValue, currency)} total
          </p>
        </div>
      )}

      {/* Deals list */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto px-2 pb-2 transition-colors",
          isOver && "bg-primary/5 rounded-b-lg"
        )}
      >
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.length > 0 ? (
            deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onClick={() => onDealClick(deal)}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-xs text-muted-foreground">
                No deals in this stage
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Drag a deal here or create a new one
              </p>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  )
}
