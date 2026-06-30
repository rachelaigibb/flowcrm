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
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badges"
import { StageColumn } from "./stage-column"
import { DealCard } from "./deal-card"
import { DealDetailSheet } from "./deal-detail-sheet"
import { CreateDealDialog } from "./create-deal-dialog"
import { moveDeal } from "../actions"
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/currency"
import { formatDateShort } from "@/lib/utils/dates"
import { Plus, Search, Filter, LayoutGrid, List, Settings, TrendingUp, DollarSign, Trophy } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { DealWithContact, StageWithDeals } from "../types"
import type { PipelineStage, DealPriority, DealStatus } from "@/types/database"

type ViewMode = "kanban" | "list"

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
  const [viewMode, setViewMode] = useState<ViewMode>("kanban")

  // New filter state
  const [excludedStageIds, setExcludedStageIds] = useState<Set<string>>(new Set())
  const [valueMin, setValueMin] = useState("")
  const [valueMax, setValueMax] = useState("")
  const [sourceFilter, setSourceFilter] = useState<string>("all")

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

  // Extract unique sources from deals' contacts
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>()
    for (const deal of deals) {
      if (deal.contact?.source) {
        sources.add(deal.contact.source)
      }
    }
    return Array.from(sources).sort()
  }, [deals])

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
      // Stage filter
      if (excludedStageIds.size > 0 && excludedStageIds.has(deal.stage_id)) {
        return false
      }
      // Value range filter
      const minVal = valueMin ? parseFloat(valueMin) : null
      const maxVal = valueMax ? parseFloat(valueMax) : null
      if (minVal !== null && !isNaN(minVal) && deal.value < minVal) {
        return false
      }
      if (maxVal !== null && !isNaN(maxVal) && deal.value > maxVal) {
        return false
      }
      // Source filter
      if (sourceFilter !== "all") {
        const dealSource = deal.contact?.source ?? null
        if (dealSource !== sourceFilter) {
          return false
        }
      }
      return true
    })
  }, [deals, searchQuery, priorityFilter, statusFilter, excludedStageIds, valueMin, valueMax, sourceFilter])

  // Stats computed from filtered deals
  const stats = useMemo(() => {
    const openDeals = filteredDeals.filter((d) => d.status === "open")
    const wonDeals = filteredDeals.filter((d) => d.status === "won")

    const openCount = openDeals.length
    const openValue = openDeals.reduce((sum, d) => sum + d.value, 0)
    const wonValue = wonDeals.reduce((sum, d) => sum + d.value, 0)

    // Use the first deal's currency for display, fallback to USD
    const currency = filteredDeals[0]?.currency ?? "USD"

    return { openCount, openValue, wonValue, currency }
  }, [filteredDeals])

  // Count active filters (not counting search or defaults)
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (priorityFilter !== "all") count++
    if (statusFilter !== "all") count++
    if (excludedStageIds.size > 0) count++
    if (valueMin || valueMax) count++
    if (sourceFilter !== "all") count++
    return count
  }, [priorityFilter, statusFilter, excludedStageIds, valueMin, valueMax, sourceFilter])

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

  // Stage name lookup for list view
  const stageNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of stages) {
      map[s.id] = s.name
    }
    return map
  }, [stages])

  function toggleStage(stageId: string) {
    setExcludedStageIds((prev) => {
      const next = new Set(prev)
      if (next.has(stageId)) {
        next.delete(stageId)
      } else {
        next.add(stageId)
      }
      return next
    })
  }

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
    <div className="flex h-full flex-col min-w-0">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {deals.length} deal{deals.length !== 1 ? "s" : ""} &middot;{" "}
            {stages.length} stage{stages.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="flex items-center rounded-md border bg-muted p-0.5">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setViewMode("list")}
            >
              <List className="size-3.5" />
            </Button>
          </div>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" data-icon="inline-start" />
            Add Deal
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid shrink-0 grid-cols-3 gap-3 pb-4">
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="size-3.5" />
            Open Deals
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {stats.openCount}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <DollarSign className="size-3.5" />
            Open Pipeline Value
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {formatCurrency(stats.openValue, stats.currency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Trophy className="size-3.5" />
            Won This View
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-green-400">
            {formatCurrency(stats.wonValue, stats.currency)}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex shrink-0 flex-col gap-2.5 border-b pb-3">
        {/* Row 1: Search + dropdowns + filter count badge */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-48 pl-8 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="size-3.5 text-muted-foreground" />
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {activeFilterCount}
              </Badge>
            )}
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
            {/* Source filter */}
            {uniqueSources.length > 0 && (
              <Select
                value={sourceFilter}
                onValueChange={(v) => setSourceFilter(v ?? "all")}
              >
                <SelectTrigger size="sm" className="w-auto gap-1">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {uniqueSources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source.charAt(0).toUpperCase() + source.slice(1).replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* Value range inputs */}
            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="Min $"
                value={valueMin}
                onChange={(e) => setValueMin(e.target.value)}
                className="h-8 w-20 text-sm"
              />
              <span className="text-xs text-muted-foreground">-</span>
              <Input
                type="number"
                placeholder="Max $"
                value={valueMax}
                onChange={(e) => setValueMax(e.target.value)}
                className="h-8 w-20 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Stage toggle chips */}
        {stages.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground mr-1">Stages:</span>
            {stages.map((stage) => {
              const isActive = !excludedStageIds.has(stage.id)
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => toggleStage(stage.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all cursor-pointer",
                    isActive
                      ? "border-transparent text-white"
                      : "border-border bg-transparent text-muted-foreground opacity-50"
                  )}
                  style={isActive ? { backgroundColor: stage.color } : undefined}
                >
                  {!isActive && (
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                  )}
                  {stage.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Empty state when no stages */}
      {stages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <Settings className="size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-foreground">
              No pipeline stages configured
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to Settings to set up your pipeline.
            </p>
          </div>
        </div>
      ) : viewMode === "kanban" ? (
        /* Kanban board */
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full gap-4 pb-4">
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
      ) : (
        /* List view */
        <div className="flex-1 overflow-y-auto pt-3">
          {filteredDeals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No deals match your filters.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Expected Close</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.map((deal) => {
                  const contactName = deal.contact
                    ? [deal.contact.first_name, deal.contact.last_name].filter(Boolean).join(" ")
                    : null
                  return (
                    <TableRow
                      key={deal.id}
                      className="cursor-pointer"
                      onClick={() => handleDealClick(deal)}
                    >
                      <TableCell className="font-medium">{deal.title}</TableCell>
                      <TableCell>{formatCurrencyCompact(deal.value, deal.currency)}</TableCell>
                      <TableCell>{stageNameMap[deal.stage_id] ?? "Unknown"}</TableCell>
                      <TableCell>
                        <PriorityBadge priority={deal.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={deal.status} />
                      </TableCell>
                      <TableCell>
                        {contactName && deal.contact ? (
                          <span
                            className="text-primary cursor-pointer hover:underline"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/contacts/${deal.contact!.id}`)
                            }}
                          >
                            {contactName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.expected_close
                          ? formatDateShort(deal.expected_close)
                          : <span className="text-muted-foreground">--</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

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
