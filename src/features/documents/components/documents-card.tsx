"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"
import { formatBytes } from "@/features/documents/format"
import { listDocuments, uploadDocuments, deleteDocument } from "@/features/documents/actions"
import { formatDateShort } from "@/lib/utils/dates"
import type { Document } from "@/types/database"
import { FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react"

interface DocumentsCardProps {
  contactId?: string
  dealId?: string
  // Server-rendered pages pass the list; dialogs/sheets leave it out and the
  // card loads on mount.
  initial?: Document[]
}

// Files kept on a contact or a deal: upload, open (signed link), remove.
export function DocumentsCard({ contactId, dealId, initial }: DocumentsCardProps) {
  const [docs, setDocs] = useState<Document[]>(initial ?? [])
  const [loading, setLoading] = useState(initial === undefined)
  const [uploading, setUploading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null)
  const [deleting, setDeleting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initial !== undefined) {
      setDocs(initial)
      return
    }
    let cancelled = false
    setLoading(true)
    listDocuments({ contactId, dealId }).then((result) => {
      if (cancelled) return
      if ("data" in result && result.data) setDocs(result.data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [contactId, dealId, initial])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const formData = new FormData()
    if (contactId) formData.set("contact_id", contactId)
    if (dealId) formData.set("deal_id", dealId)
    Array.from(files).forEach((f) => formData.append("files", f))
    setUploading(true)
    const result = await uploadDocuments(formData)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ""
    if ("error" in result && result.error) {
      toast.error(result.error)
      return
    }
    if ("data" in result && result.data) {
      setDocs((prev) => [...result.data!, ...prev])
      toast.success(result.data.length === 1 ? "File added" : `${result.data.length} files added`)
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    const result = await deleteDocument(pendingDelete.id)
    setDeleting(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setDocs((prev) => prev.filter((d) => d.id !== pendingDelete.id))
    setPendingDelete(null)
    toast.success("File removed")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Paperclip className="size-4" />
          Documents ({docs.length})
        </CardTitle>
        <CardAction>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Upload
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <p className="text-xs text-muted-foreground py-2">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No files yet. Up to 10 MB per upload.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {docs.map((doc) => (
              <div key={doc.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <a
                    href={`/api/documents/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {doc.name}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(doc.size)} · {formatDateShort(doc.created_at)}
                    {doc.activity_id ? " · sent by email" : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setPendingDelete(doc)}
                  aria-label={`Remove ${doc.name}`}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Remove file"
        description={`Remove ${pendingDelete?.name ?? "this file"}? It is deleted from storage and cannot be recovered.`}
        onConfirm={handleDelete}
        isPending={deleting}
      />
    </Card>
  )
}
