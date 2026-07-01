"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"
import { formatSmartDate } from "@/lib/utils/dates"
import { deleteFormSubmission } from "@/features/forms/actions"
import type { Form, FormSubmission } from "@/types/database"
import {
  ArrowLeft,
  Trash2,
  Download,
  User,
  FileText,
  Loader2,
} from "lucide-react"

interface SubmissionWithContact extends FormSubmission {
  contact: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
}

interface FormSubmissionsPageProps {
  form: Form
  submissions: SubmissionWithContact[]
}

export function FormSubmissionsPage({
  form,
  submissions,
}: FormSubmissionsPageProps) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null)
  const [isPending, setIsPending] = React.useState(false)

  async function handleDelete() {
    if (!deleteTarget) return
    setIsPending(true)

    const result = await deleteFormSubmission(deleteTarget)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Submission deleted")
      router.refresh()
    }

    setIsPending(false)
    setDeleteTarget(null)
  }

  function handleExportCsv() {
    if (submissions.length === 0) return

    // Build header row from form fields
    const fieldLabels = form.fields.map((f) => f.label)
    const headers = ["Date", "Contact", ...fieldLabels]

    const rows = submissions.map((sub) => {
      const contactName = sub.contact
        ? [sub.contact.first_name, sub.contact.last_name]
            .filter(Boolean)
            .join(" ") || sub.contact.email || "Unknown"
        : "Anonymous"

      const fieldValues = form.fields.map((f) => {
        const val = sub.data[f.id]
        if (val === undefined || val === null) return ""
        if (typeof val === "boolean") return val ? "Yes" : "No"
        return String(val)
      })

      return [formatSmartDate(sub.created_at), contactName, ...fieldValues]
    })

    const csvContent = [
      headers.map(escapeCsvField).join(","),
      ...rows.map((row) => row.map(escapeCsvField).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${form.name.replace(/\s+/g, "-").toLowerCase()}-submissions.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/forms/${form.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            Submissions — {form.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
          </p>
        </div>
        {submissions.length > 0 && (
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="size-4" />
            Export CSV
          </Button>
        )}
      </div>

      <Separator />

      {/* Submissions list */}
      {submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <FileText className="size-10 text-muted-foreground" />
          <p className="text-muted-foreground">No submissions yet</p>
          <p className="text-sm text-muted-foreground">
            Share your form link to start collecting responses.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {submissions.map((submission) => (
            <Card key={submission.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-sm font-medium">
                      {formatSmartDate(submission.created_at)}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <User className="size-3.5 text-muted-foreground" />
                      {submission.contact ? (
                        <Link
                          href={`/contacts/${submission.contact.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {[
                            submission.contact.first_name,
                            submission.contact.last_name,
                          ]
                            .filter(Boolean)
                            .join(" ") ||
                            submission.contact.email ||
                            "Unknown"}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Anonymous
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(submission.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {form.fields.map((field) => {
                    const val = submission.data[field.id]
                    if (val === undefined || val === null) return null

                    return (
                      <div key={field.id} className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          {field.label}
                        </span>
                        <span className="text-sm">
                          {typeof val === "boolean" ? (
                            <Badge variant={val ? "default" : "secondary"}>
                              {val ? "Yes" : "No"}
                            </Badge>
                          ) : (
                            String(val)
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete submission"
        description="This will permanently delete this form submission. This action cannot be undone."
        onConfirm={handleDelete}
        isPending={isPending}
      />
    </div>
  )
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}
