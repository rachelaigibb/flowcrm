"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Automation, AutomationTriggerType } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DialogFooter,
} from "@/components/ui/dialog"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"
import { createAutomation, deleteAutomation } from "@/features/automations/actions"
import { formatDateShort } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, Trash2, Pencil, Zap, Loader2 } from "lucide-react"

const TRIGGER_TYPE_LABELS: Record<AutomationTriggerType, string> = {
  form_submission: "Form Submission",
  contact_created: "Contact Created",
  deal_stage_change: "Deal Stage Change",
  tag_added: "Tag Added",
  manual: "Manual",
}

interface AutomationsPageProps {
  automations: (Automation & { automation_runs: { count: number }[] })[]
}

export function AutomationsPage({ automations }: AutomationsPageProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>("manual")

  const [deleteTarget, setDeleteTarget] = useState<Automation | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setCreating(true)
    const result = await createAutomation({
      name: name.trim(),
      description: description.trim() || undefined,
      trigger_type: triggerType,
    })
    setCreating(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Automation created")
    setCreateOpen(false)
    setName("")
    setDescription("")
    setTriggerType("manual")

    if (result.data) {
      router.push(`/automations/${result.data.id}`)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setDeleting(true)
    const result = await deleteAutomation(deleteTarget.id)
    setDeleting(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Automation deleted")
    setDeleteTarget(null)
    router.refresh()
  }

  function getRunCount(
    automation: AutomationsPageProps["automations"][number]
  ): number {
    return automation.automation_runs?.[0]?.count ?? 0
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {automations.length} automation{automations.length !== 1 ? "s" : ""}{" "}
            total
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" data-icon="inline-start" />
          Create Automation
        </Button>
      </div>

      <Separator />

      {/* Automations list or empty state */}
      {automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Zap className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No automations yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create your first automation to start.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" data-icon="inline-start" />
            Create Automation
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {automations.map((automation) => {
            const runs = getRunCount(automation)

            return (
              <div
                key={automation.id}
                className="group flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                {/* Enabled indicator */}
                <div className="shrink-0">
                  <div
                    className={cn(
                      "size-2.5 rounded-full",
                      automation.enabled
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/30"
                    )}
                  />
                </div>

                {/* Name + trigger type */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => router.push(`/automations/${automation.id}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {automation.name}
                    </span>
                    <Badge variant="secondary">
                      {TRIGGER_TYPE_LABELS[automation.trigger_type]}
                    </Badge>
                  </div>
                  {automation.description && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {automation.description}
                    </p>
                  )}
                </div>

                {/* Run count */}
                <div className="hidden sm:block shrink-0 text-sm text-muted-foreground text-right w-24">
                  {runs} run{runs !== 1 ? "s" : ""}
                </div>

                {/* Created date */}
                <div className="hidden md:block shrink-0 text-sm text-muted-foreground text-right w-28">
                  {formatDateShort(automation.created_at)}
                </div>

                {/* Actions -- visible on hover */}
                <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      router.push(`/automations/${automation.id}`)
                    }
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(automation)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Automation Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Automation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="automation-name">Name</Label>
              <Input
                id="automation-name"
                placeholder="e.g. Welcome Sequence"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="automation-description">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="automation-description"
                placeholder="Brief description of what this automation does"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Trigger Type</Label>
              <Select
                value={triggerType}
                onValueChange={(v: string | null) => {
                  if (v) setTriggerType(v as AutomationTriggerType)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {TRIGGER_TYPE_LABELS[triggerType]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="form_submission">
                    Form Submission
                  </SelectItem>
                  <SelectItem value="contact_created">
                    Contact Created
                  </SelectItem>
                  <SelectItem value="deal_stage_change">
                    Deal Stage Change
                  </SelectItem>
                  <SelectItem value="tag_added">Tag Added</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete Automation"
        description={`Are you sure you want to delete "${deleteTarget?.name ?? ""}"? This will also delete all steps and run history. This action cannot be undone.`}
        onConfirm={handleDelete}
        isPending={deleting}
      />
    </div>
  )
}
