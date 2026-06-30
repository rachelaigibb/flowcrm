"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { MessageSquare, Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { formatSmartDate } from "@/lib/utils/dates"
import { toast } from "sonner"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"
import type { Activity } from "@/types/database"

interface NotesSectionProps {
  notes: Activity[]
  onAddNote: (content: string) => Promise<{ error?: string }>
  onEditNote?: (noteId: string, content: string) => Promise<{ error?: string }>
  onDeleteNote?: (noteId: string) => Promise<{ error?: string }>
}

export function NotesSection({
  notes,
  onAddNote,
  onEditNote,
  onDeleteNote,
}: NotesSectionProps) {
  // Add/edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogContent, setDialogContent] = useState("")
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  function openAddDialog() {
    setEditingNoteId(null)
    setDialogContent("")
    setDialogOpen(true)
  }

  function openEditDialog(note: Activity) {
    setEditingNoteId(note.id)
    setDialogContent(note.content ?? "")
    setDialogOpen(true)
  }

  function openDeleteDialog(noteId: string) {
    setDeletingNoteId(noteId)
    setDeleteOpen(true)
  }

  function handleSave() {
    if (!dialogContent.trim()) return

    startTransition(async () => {
      if (editingNoteId && onEditNote) {
        const result = await onEditNote(editingNoteId, dialogContent.trim())
        if (result?.error) {
          toast.error(result.error)
        } else {
          toast.success("Note updated")
          setDialogOpen(false)
          setDialogContent("")
          setEditingNoteId(null)
        }
      } else {
        const result = await onAddNote(dialogContent.trim())
        if (result?.error) {
          toast.error(result.error)
        } else {
          toast.success("Note added")
          setDialogOpen(false)
          setDialogContent("")
        }
      }
    })
  }

  function handleDelete() {
    if (!deletingNoteId || !onDeleteNote) return

    startDeleteTransition(async () => {
      const result = await onDeleteNote(deletingNoteId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Note deleted")
        setDeleteOpen(false)
        setDeletingNoteId(null)
      }
    })
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="size-4" />
            Notes ({notes.length})
          </CardTitle>
          <Button variant="ghost" size="icon-xs" onClick={openAddDialog}>
            <Plus className="size-4" />
          </Button>
        </CardHeader>
        {notes.length > 0 && (
          <CardContent>
            <div className="flex flex-col gap-3">
              {notes.map((note) => (
                <div key={note.id} className="group flex gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-foreground">
                      {note.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatSmartDate(note.created_at)}
                    </p>
                  </div>
                  {(onEditNote || onDeleteNote) && (
                    <div className="flex items-start gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onEditNote && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEditDialog(note)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {onDeleteNote && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => openDeleteDialog(note.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingNoteId ? "Edit Note" : "Add Note"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Write a note..."
            value={dialogContent}
            onChange={(e) => setDialogContent(e.target.value)}
            className="min-h-24 text-sm"
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!dialogContent.trim() || isPending}
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        onConfirm={handleDelete}
        isPending={isDeleting}
      />
    </>
  )
}
