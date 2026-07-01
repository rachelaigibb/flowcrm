"use client"

import { useState, useTransition, useEffect } from "react"
import { sendEmail, getEmailTemplates } from "../actions"
import type { EmailTemplate } from "@/types/database"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Send, FileText } from "lucide-react"

interface ComposeEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactEmail: string
  contactName: string
}

export function ComposeEmailDialog({
  open,
  onOpenChange,
  contactId,
  contactEmail,
  contactName,
}: ComposeEmailDialogProps) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [isPending, startTransition] = useTransition()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Load templates when dialog opens
  useEffect(() => {
    if (open) {
      setLoadingTemplates(true)
      getEmailTemplates().then((result) => {
        if (result.data) setTemplates(result.data)
        setLoadingTemplates(false)
      })
    }
  }, [open])

  function handleTemplateSelect(templateId: string | null) {
    if (!templateId) return
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSubject(template.subject)
      setBody(template.body)
    }
  }

  function handleSend() {
    if (!subject.trim() || !body.trim()) return
    startTransition(async () => {
      const result = await sendEmail(contactId, contactEmail, subject.trim(), body.trim())
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Email sent to ${contactName}`)
        setSubject("")
        setBody("")
        onOpenChange(false)
      }
    })
  }

  function handleClose(value: boolean) {
    if (!isPending) {
      if (!value) {
        setSubject("")
        setBody("")
      }
      onOpenChange(value)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-4" />
            Send Email
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* To (read-only) */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <p className="text-sm">{contactName} &lt;{contactEmail}&gt;</p>
          </div>

          {/* Template picker */}
          {templates.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Template</Label>
              <Select onValueChange={handleTemplateSelect}>
                <SelectTrigger className="h-8 text-sm w-full">
                  <SelectValue>
                    <span className="flex items-center gap-1.5">
                      <FileText className="size-3" />
                      Choose a template
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="h-8 text-sm"
            />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email..."
              className="min-h-32 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!subject.trim() || !body.trim() || isPending}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
