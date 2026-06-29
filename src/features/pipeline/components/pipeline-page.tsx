"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StageColumn } from "./stage-column"
import { DealCard } from "./deal-card"
import { DealDetailSheet } from "./deal-detail-sheet"
import { CreateDealDialog } from "./create-deal-dialog"
import { moveDeal } from "../actions"
import { Plus, Search, Filter } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { DealWithContact, StageWithDeals } from "../types"
import type { PipelineStage, DealPriority, DealStatus } from "@/types/database"

interface PipelinePageProps {
  stages: PipelineStage[]
  deals: DealWithContact[]
}

export function PipelinePage({ stages, deals: initialDeals }: PipelinePageProps) {
  const router = useRouter()
  const [deals, setDeals] = useState<DealWithContact[]>(initialDeals)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [priorityFilter, setPriorityFilter] = useState<DealPriority | "all">("all")
  const [statusFilter, setStatusFilter] = useState<DealStatus | "all">("all")
  const [selectedDeal, setSelectedDeal] = useState<DealWithContact | null>(null)
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Filter deals
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      if (
        searchQuery &&
        !deal.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false
      }
      if (priorityFilter !== "all" && deal.priority !== priorityFilter) {
        return false
      }
      if (statusFilter !== "all" && deal.status !== statusFilter) {
        return false
      }
      return true
    })
  }, [deals, searchQuery, priorityFilter, statusFilter])

  // Group deals by stage
  const stagesWithDeals: StageWithDeals[] = useMemo(() => {
    return stages.map((stage) => ({
      ...stage,
      deals: filteredDeals.filter((d) => d.stage_id === stage.id),
    }))
  }, [stages, filteredDeals])

  const activeDeal = useMemo(
    () => deals.find((d) => d.id === activeId) ?? null,
    [deals, activeId]
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    if (!activeData) return

    // Determine the target stage
    let targetStageId: string | null = null

    if (overData?.type === "stage") {
      targetStageId = overData.stageId as string
    } else if (overData?.type === "deal") {
      targetStageId = overData.stageId as string
    }

    if (!targetStageId) return

    const activeDealId = active.id as string
    const currentDeal = deals.find((d) => d.id === activeDealId)

    if (currentDeal && currentDeal.stage_id !== targetStageId) {
      // Optimistic update: move deal to new stage
      setDeals((prev) =>
        prev.map((d) =>
          d.id === activeDealId ? { ...d, stage_id: targetStageId } : d
        )
      )
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeDealId = active.id as string
    const overData = over.data.current

    let targetStageId: string | null = null

    if (overData?.type === "stage") {
      targetStageId = overData.stageId as string
    } else if (overData?.type === "deal") {
      targetStageId = overData.stageId as string
    }

    if (!targetStageId) return

    // Check if the deal's stage actually changed from the initial data
    const originalDeal = initialDeals.find((d) => d.id === activeDealId)
    if (originalDeal && originalDeal.stage_id !== targetStageId) {
      try {
        await moveDeal(activeDealId, targetStageId)
      } catch (err) {
        // Revert on error
        setDeals(initialDeals)
        toast.error(
          err instanceof Error ? err.message : "Failed to move deal"
        )
      }
    }
  }

  const handleDealClick = useCallback((deal: DealWithContact) => {
    setSelectedDeal(deal)
    setDetailSheetOpen(true)
  }, [])

  function handleDealUpdated() {
    router.refresh()
  }

  // Sync deals when initialDeals changes from server refresh
  useEffect(() => {
    setDeals(initialDeals)
  }, [initialDeals])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {deals.length} deal{deals.length !== 1 ? "s" : ""} &middot;{" "}
            {stages.length} stage{stages.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="size-4" data-icon="inline-start" />
          Add Deal
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-48 pl-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="size-3.5 text-muted-foreground" />
          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter((v ?? "all") as DealPriority | "all")}
          >
            <SelectTrigger size="sm" className="w-auto gap-1">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter((v ?? "all") as DealStatus | "all")}
          >
            <SelectTrigger size="sm" className="w-auto gap-1">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full gap-4 p-4">
            {stagesWithDeals.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={stage.deals}
                onDealClick={handleDealClick}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal ? (
              <div className="w-72 rotate-2 opacity-90">
                <DealCard
                  deal={activeDeal}
                  onClick={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Detail sheet */}
      <DealDetailSheet
        deal={selectedDeal}
        stages={stages}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onDealUpdated={handleDealUpdated}
      />

      {/* Create dialog */}
      <CreateDealDialog
        stages={stages}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onDealCreated={handleDealUpdated}
      />
    </div>
  )
}
