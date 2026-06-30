"use client"

import { useState, useEffect, useTransition, useCallback, useMemo } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils/currency"
import { toDateInputValue } from "@/lib/utils/dates"
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badges"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"
import { NotesSection } from "@/components/shared/notes-section"
import { ActivityLog } from "@/components/shared/activity-log"
import {
  updateDeal,
  updateDealStatus,
  deleteDeal,
  addDealNote,
  fetchDealActivities,
} from "../actions"
import type { DealWithContact, UpdateDealInput } from "../types"
import type { PipelineStage, Activity, DealStatus, DealPriority } from "@/types/database"
import {
  Trophy,
  XCircle,
  Trash2,
  Pencil,
  Save,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface DealDetailSheetProps {
  deal: DealWithContact | null
  stages: PipelineStage[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDealUpdated: () => void
}

export function DealDetailSheet({
  deal,
  stages,
  open,
  onOpenChange,
  onDealUpdated,
}: DealDetailSheetProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<UpdateDealInput>({})
  const [activities, setActivities] = useState<Activity[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()

  const dealId = deal?.id ?? null

  const loadActivities = useCallback(async () => {
    if (!dealId) return
    try {
      const data = await fetchDealActivities(dealId)
      setActivities(data)
    } catch {
      // Silently fail
    }
  }, [dealId])

  useEffect(() => {
    if (deal && open) {
      loadActivities()
      setIsEditing(false)
      setEditData({})
    }
  }, [deal, open, loadActivities])

  // Filter notes and non-note activities
  const notes = useMemo(
    () => activities.filter((a) => a.type === "note"),
    [activities]
  )
  const nonNoteActivities = useMemo(
    () => activities.filter((a) => a.type !== "note"),
    [activities]
  )

  if (!deal) return null

  // After the null check, deal is guaranteed non-null for the rest of this render.
  const currentDeal: DealWithContact = deal

  const contactName = currentDeal.contact
    ? [currentDeal.contact.first_name, currentDeal.contact.last_name].filter(Boolean).join(" ")
    : null

  const stageName = stages.find((s) => s.id === currentDeal.stage_id)?.name ?? "Unknown"

  function startEditing() {
    setIsEditing(true)
    setEditData({
      title: currentDeal.title,
      value: currentDeal.value,
      currency: currentDeal.currency,
      stage_id: currentDeal.stage_id,
      priority: currentDeal.priority,
      expected_close: currentDeal.expected_close,
    })
  }

  function cancelEditing() {
    setIsEditing(false)
    setEditData({})
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateDeal(currentDeal.id, editData)
        toast.success("Deal updated")
        setIsEditing(false)
        onDealUpdated()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update deal")
      }
    })
  }

  function handleStatusChange(status: DealStatus) {
    startTransition(async () => {
      try {
        await updateDealStatus(currentDeal.id, status)
        toast.success(`Deal marked as ${status}`)
        onDealUpdated()
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update status")
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteDeal(currentDeal.id)
        toast.success("Deal deleted")
        onDealUpdated()
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete deal")
      }
    })
  }

  async function handleAddNote(content: string): Promise<{ error?: string }> {
    try {
      await addDealNote(currentDeal.id, content)
      loadActivities()
      return {}
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to add note" }
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-0">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="min-w-0">
                <SheetTitle className="text-lg">{currentDeal.title}</SheetTitle>
                <SheetDescription className="mt-1">
                  {contactName ? (
                    <>
                      <span
                        className="text-primary cursor-pointer hover:underline"
                        onClick={() => {
                          if (currentDeal.contact) {
                            router.push(`/contacts/${currentDeal.contact.id}`)
                          }
                        }}
                      >
                        {contactName}
                      </span>
                      {" "}&middot; {stageName}
                    </>
                  ) : (
                    <>No contact &middot; {stageName}</>
                  )}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 pb-6">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {currentDeal.status === "open" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("won")}
                    disabled={isPending}
                  >
                    <Trophy className="size-3.5" data-icon="inline-start" />
                    Mark as Won
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("lost")}
                    disabled={isPending}
                  >
                    <XCircle className="size-3.5" data-icon="inline-start" />
                    Mark as Lost
                  </Button>
                </>
              )}
              {!isEditing ? (
                <Button variant="ghost" size="sm" onClick={startEditing}>
                  <Pencil className="size-3.5" data-icon="inline-start" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSave}
                    disabled={isPending}
                  >
                    <Save className="size-3.5" data-icon="inline-start" />
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEditing}>
                    <X className="size-3.5" data-icon="inline-start" />
                    Cancel
                  </Button>
                </>
              )}
            </div>

            <Separator />

            {/* Deal details */}
            <div className="grid gap-4">
              {isEditing ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input
                      value={editData.title ?? ""}
                      onChange={(e) =>
                        setEditData((prev) => ({ ...prev, title: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Value</Label>
                      <Input
                        type="number"
                        value={editData.value ?? 0}
                        onChange={(e) =>
                          setEditData((prev) => ({
                            ...prev,
                            value: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Currency</Label>
                      <Select
                        value={editData.currency}
                        onValueChange={(val: string | null) =>
                          setEditData((prev) => ({ ...prev, currency: val ?? undefined }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CAD">CAD</SelectItem>
                          <SelectItem value="AED">AED</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Stage</Label>
                    <Select
                      value={editData.stage_id}
                      onValueChange={(val: string | null) =>
                        setEditData((prev) => ({ ...prev, stage_id: val ?? undefined }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {stages.find((s) => s.id === editData.stage_id)?.name ?? "Select stage"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Priority</Label>
                      <Select
                        value={editData.priority}
                        onValueChange={(val: string | null) =>
                          setEditData((prev) => ({
                            ...prev,
                            priority: (val ?? undefined) as DealPriority | undefined,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Expected Close</Label>
                      <Input
                        type="date"
                        value={toDateInputValue(editData.expected_close)}
                        onChange={(e) =>
                          setEditData((prev) => ({
                            ...prev,
                            expected_close: e.target.value || null,
                          }))
                        }
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Value</p>
                    <p className="font-medium">{formatCurrency(currentDeal.value, currentDeal.currency)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <StatusBadge status={currentDeal.status} className="mt-0.5" />
                  </div>
                  <div>
                    <p className="text-muted-foreground">Priority</p>
                    <PriorityBadge priority={currentDeal.priority} className="mt-0.5" />
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stage</p>
                    <p className="font-medium">{stageName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Contact</p>
                    {contactName && currentDeal.contact ? (
                      <span
                        className="font-medium text-primary cursor-pointer hover:underline"
                        onClick={() => router.push(`/contacts/${currentDeal.contact!.id}`)}
                      >
                        {contactName}
                      </span>
                    ) : (
                      <p className="font-medium">None</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expected Close</p>
                    <p className="font-medium">
                      {currentDeal.expected_close
                        ? new Date(currentDeal.expected_close).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Not set"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Notes section */}
            <NotesSection notes={notes} onAddNote={handleAddNote} />

            <Separator />

            {/* Activity timeline (collapsed by default) */}
            <ActivityLog activities={nonNoteActivities} defaultOpen={false} />

            <Separator />

            {/* Danger zone -- intentionally at the bottom, away from Save */}
            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="size-3.5" data-icon="inline-start" />
                Delete Deal
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Deal"
        description={`Are you sure you want to delete "${currentDeal.title}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        isPending={isPending}
      />
    </>
  )
}
