"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquare, Loader2 } from "lucide-react"
import { formatSmartDate } from "@/lib/utils/dates"
import { toast } from "sonner"
import type { Activity } from "@/types/database"

interface NotesSectionProps {
  notes: Activity[]
  onAddNote: (content: string) => Promise<{ error?: string }>
}

export function NotesSection({ notes, onAddNote }: NotesSectionProps) {
  const [content, setContent] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    startTransition(async () => {
      const result = await onAddNote(content.trim())
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Note added")
        setContent("")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="size-4" />
          Notes ({notes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add note form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Textarea
            placeholder="Write a note..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-16 text-sm"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!content.trim() || isPending}
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Add Note
            </Button>
          </div>
        </form>

        {/* Notes list */}
        {notes.length > 0 && (
          <div className="space-y-3 border-t pt-3">
            {notes.map((note) => (
              <div key={note.id} className="text-sm">
                <p className="whitespace-pre-wrap text-foreground">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatSmartDate(note.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
