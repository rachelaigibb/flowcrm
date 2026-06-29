"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/currency"
import { formatSmartDate } from "@/lib/utils/dates"
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
  MessageSquarePlus,
  ArrowRight,
  StickyNote,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

interface DealDetailSheetProps {
  deal: DealWithContact | null
  stages: PipelineStage[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDealUpdated: () => void
}

const PRIORITY_STYLES: Record<string, { className: string; label: string }> = {
  low: { className: "bg-muted text-muted-foreground", label: "Low" },
  medium: { className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", label: "Medium" },
  high: { className: "bg-destructive/10 text-destructive", label: "High" },
}

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  open: { className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Open" },
  won: { className: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Won" },
  lost: { className: "bg-destructive/10 text-destructive", label: "Lost" },
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "note":
      return <StickyNote className="size-3.5" />
    case "status_change":
      return <ArrowRight className="size-3.5" />
    default:
      return <Zap className="size-3.5" />
  }
}

export function DealDetailSheet({
  deal,
  stages,
  open,
  onOpenChange,
  onDealUpdated,
}: DealDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<UpdateDealInput>({})
  const [noteContent, setNoteContent] = useState("")
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
      setNoteContent("")
    }
  }, [deal, open, loadActivities])

  if (!deal) return null

  // After the null check, deal is guaranteed non-null for the rest of this render.
  // Capture into a const that TS can narrow for closures.
  const currentDeal: DealWithContact = deal

  const contactName = currentDeal.contact
    ? [currentDeal.contact.first_name, currentDeal.contact.last_name].filter(Boolean).join(" ")
    : null

  const stageName = stages.find((s) => s.id === currentDeal.stage_id)?.name ?? "Unknown"
  const priorityStyle = PRIORITY_STYLES[currentDeal.priority] ?? PRIORITY_STYLES.low
  const statusStyle = STATUS_STYLES[currentDeal.status] ?? STATUS_STYLES.open

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

  function handleAddNote() {
    if (!noteContent.trim()) return
    startTransition(async () => {
      try {
        await addDealNote(currentDeal.id, noteContent.trim())
        toast.success("Note added")
        setNoteContent("")
        loadActivities()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add note")
      }
    })
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
                  {contactName ?? "No contact"} &middot; {stageName}
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
              <Button
                variant="destructive"
                size="sm"
                className="ml-auto"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="size-3.5" data-icon="inline-start" />
                Delete
              </Button>
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
                        value={editData.expected_close ?? ""}
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
                    <Badge className={cn("mt-0.5", statusStyle.className)}>
                      {statusStyle.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Priority</p>
                    <Badge className={cn("mt-0.5", priorityStyle.className)}>
                      {priorityStyle.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stage</p>
                    <p className="font-medium">{stageName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Contact</p>
                    <p className="font-medium">{contactName ?? "None"}</p>
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

            {/* Add Note */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="size-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Add Note</h4>
              </div>
              <Textarea
                placeholder="Write a note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={3}
              />
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={isPending || !noteContent.trim()}
              >
                Add Note
              </Button>
            </div>

            <Separator />

            {/* Activity Timeline */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Activity</h4>
              {activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <ActivityIcon type={activity.type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          {activity.content}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatSmartDate(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No activity yet</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Deal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{currentDeal.title}&rdquo;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
