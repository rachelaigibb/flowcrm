"use client"

import { useState, useEffect, useTransition } from "react"
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
import { formatSmartDate } from "@/lib/utils/dates"
import { updateTask, deleteTask, toggleTaskStatus } from "../actions"
import type { TaskWithRelations, UpdateTaskInput } from "../types"
import type { DealPriority } from "@/types/database"
import {
  Trash2,
  Pencil,
  Save,
  X,
  CheckCircle2,
  Circle,
  CalendarIcon,
  UserIcon,
  BriefcaseIcon,
} from "lucide-react"
import { toast } from "sonner"

interface ContactOption {
  id: string
  first_name: string | null
  last_name: string | null
}

interface DealOption {
  id: string
  title: string
}

interface TaskDetailSheetProps {
  task: TaskWithRelations | null
  contacts: ContactOption[]
  deals: DealOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskUpdated: () => void
}

const PRIORITY_STYLES: Record<string, { className: string; label: string }> = {
  low: { className: "bg-green-500/10 text-green-400 border-green-500/20", label: "Low" },
  medium: { className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20", label: "Medium" },
  high: { className: "bg-red-500/10 text-red-400 border-red-500/20", label: "High" },
}

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  pending: { className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Pending" },
  completed: { className: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Completed" },
  cancelled: { className: "bg-muted text-muted-foreground", label: "Cancelled" },
}

export function TaskDetailSheet({
  task,
  contacts,
  deals,
  open,
  onOpenChange,
  onTaskUpdated,
}: TaskDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<UpdateTaskInput>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (task && open) {
      setIsEditing(false)
      setEditData({})
    }
  }, [task, open])

  if (!task) return null

  const currentTask: TaskWithRelations = task

  const contactName = currentTask.contact
    ? [currentTask.contact.first_name, currentTask.contact.last_name].filter(Boolean).join(" ") || "(Unnamed)"
    : null

  const dealTitle = currentTask.deal?.title ?? null

  const priorityStyle = PRIORITY_STYLES[currentTask.priority] ?? PRIORITY_STYLES.low
  const statusStyle = STATUS_STYLES[currentTask.status] ?? STATUS_STYLES.pending

  function startEditing() {
    setIsEditing(true)
    setEditData({
      title: currentTask.title,
      description: currentTask.description,
      due_date: currentTask.due_date,
      priority: currentTask.priority,
      contact_id: currentTask.contact_id,
      deal_id: currentTask.deal_id,
    })
  }

  function cancelEditing() {
    setIsEditing(false)
    setEditData({})
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const result = await updateTask(currentTask.id, editData)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Task updated")
        setIsEditing(false)
        onTaskUpdated()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update task")
      }
    })
  }

  function handleToggleStatus() {
    startTransition(async () => {
      try {
        const result = await toggleTaskStatus(currentTask.id)
        if (result.error) {
          toast.error(result.error)
          return
        }
        const newStatus = result.newStatus ?? (currentTask.status === "pending" ? "completed" : "pending")
        toast.success(`Task marked as ${newStatus}`)
        onTaskUpdated()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update status")
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await deleteTask(currentTask.id)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Task deleted")
        onTaskUpdated()
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete task")
      }
    })
  }

  function contactLabel(id: string | null | undefined): string {
    if (!id) return "Select contact"
    const c = contacts.find((c) => c.id === id)
    if (!c) return "Select contact"
    return [c.first_name, c.last_name].filter(Boolean).join(" ") || "(Unnamed)"
  }

  function dealLabel(id: string | null | undefined): string {
    if (!id) return "Select deal"
    const d = deals.find((d) => d.id === id)
    return d?.title ?? "Select deal"
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-0">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="min-w-0">
                <SheetTitle className="text-lg">{currentTask.title}</SheetTitle>
                <SheetDescription className="mt-1">
                  {contactName ?? "No contact"} &middot; {statusStyle.label}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 pb-6">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleStatus}
                disabled={isPending}
              >
                {currentTask.status === "completed" ? (
                  <>
                    <Circle className="size-3.5" data-icon="inline-start" />
                    Mark Pending
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" data-icon="inline-start" />
                    Mark Complete
                  </>
                )}
              </Button>

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

            {/* Task details */}
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
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea
                      value={editData.description ?? ""}
                      onChange={(e) =>
                        setEditData((prev) => ({ ...prev, description: e.target.value || null }))
                      }
                      rows={3}
                      placeholder="Add a description..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={editData.due_date ?? ""}
                        onChange={(e) =>
                          setEditData((prev) => ({
                            ...prev,
                            due_date: e.target.value || null,
                          }))
                        }
                      />
                    </div>
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
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact</Label>
                    <Select
                      value={editData.contact_id ?? "none"}
                      onValueChange={(val: string | null) =>
                        setEditData((prev) => ({
                          ...prev,
                          contact_id: val === "none" ? null : val,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {contactLabel(editData.contact_id)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No contact</SelectItem>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {[c.first_name, c.last_name].filter(Boolean).join(" ") || "(Unnamed)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Deal</Label>
                    <Select
                      value={editData.deal_id ?? "none"}
                      onValueChange={(val: string | null) =>
                        setEditData((prev) => ({
                          ...prev,
                          deal_id: val === "none" ? null : val,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {dealLabel(editData.deal_id)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No deal</SelectItem>
                        {deals.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className={cn("mt-0.5", statusStyle.className)}>
                      {statusStyle.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Priority</p>
                    <Badge className={cn("mt-0.5 border", priorityStyle.className)} variant="outline">
                      {priorityStyle.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Due Date</p>
                    <p className="font-medium flex items-center gap-1">
                      <CalendarIcon className="size-3 text-muted-foreground" />
                      {currentTask.due_date
                        ? new Date(currentTask.due_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Contact</p>
                    <p className="font-medium flex items-center gap-1">
                      <UserIcon className="size-3 text-muted-foreground" />
                      {contactName ?? "None"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Deal</p>
                    <p className="font-medium flex items-center gap-1">
                      <BriefcaseIcon className="size-3 text-muted-foreground" />
                      {dealTitle ?? "None"}
                    </p>
                  </div>
                  {currentTask.description && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Description</p>
                      <p className="font-medium whitespace-pre-wrap">{currentTask.description}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">{formatSmartDate(currentTask.created_at)}</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Delete button at the bottom, separated */}
            <div className="pt-2">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="size-3.5" data-icon="inline-start" />
                Delete Task
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{currentTask.title}&rdquo;? This
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
