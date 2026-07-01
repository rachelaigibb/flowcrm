"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Form } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"
import { createForm, deleteForm } from "@/features/forms/actions"
import { formatDateShort } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  Pencil,
  FileText,
  Globe,
  Loader2,
} from "lucide-react"

interface FormsPageProps {
  forms: (Form & { form_submissions: { count: number }[] })[]
}

export function FormsPage({ forms }: FormsPageProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const [deleteTarget, setDeleteTarget] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setCreating(true)
    const result = await createForm({
      name: name.trim(),
      description: description.trim() || undefined,
    })
    setCreating(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Form created")
    setCreateOpen(false)
    setName("")
    setDescription("")

    if (result.data) {
      router.push(`/forms/${result.data.id}`)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setDeleting(true)
    const result = await deleteForm(deleteTarget.id)
    setDeleting(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Form deleted")
    setDeleteTarget(null)
    router.refresh()
  }

  function getSubmissionCount(form: FormsPageProps["forms"][number]): number {
    return form.form_submissions?.[0]?.count ?? 0
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {forms.length} form{forms.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" data-icon="inline-start" />
          Create Form
        </Button>
      </div>

      <Separator />

      {/* Forms list or empty state */}
      {forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <FileText className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No forms yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create your first form to start collecting submissions.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" data-icon="inline-start" />
            Create Form
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {forms.map((form) => {
            const submissions = getSubmissionCount(form)

            return (
              <div
                key={form.id}
                className="group flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                {/* Icon */}
                <div className="shrink-0 rounded-md bg-muted p-2">
                  {form.published ? (
                    <Globe className="size-4 text-muted-foreground" />
                  ) : (
                    <FileText className="size-4 text-muted-foreground" />
                  )}
                </div>

                {/* Name + description */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => router.push(`/forms/${form.id}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{form.name}</span>
                    <Badge
                      variant={form.published ? "default" : "secondary"}
                      className={cn(
                        form.published
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : ""
                      )}
                    >
                      {form.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  {form.description && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {form.description}
                    </p>
                  )}
                </div>

                {/* Submissions count */}
                <div className="hidden sm:block shrink-0 text-sm text-muted-foreground text-right w-28">
                  {submissions} submission{submissions !== 1 ? "s" : ""}
                </div>

                {/* Created date */}
                <div className="hidden md:block shrink-0 text-sm text-muted-foreground text-right w-28">
                  {formatDateShort(form.created_at)}
                </div>

                {/* Actions — visible on hover */}
                <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => router.push(`/forms/${form.id}`)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(form)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Form Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Form</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="form-name">Name</Label>
              <Input
                id="form-name"
                placeholder="e.g. Contact Inquiry"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="form-description">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="form-description"
                placeholder="Brief description of this form's purpose"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
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
        title="Delete Form"
        description={`Are you sure you want to delete "${deleteTarget?.name ?? ""}"? This will also delete all submissions. This action cannot be undone.`}
        onConfirm={handleDelete}
        isPending={deleting}
      />
    </div>
  )
}
