"use client"

import { useState, useTransition, useEffect } from "react"
import { sendSms, getSmsTemplates } from "../actions"
import type { SmsTemplate } from "@/types/database"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { Loader2, MessageSquare, FileText } from "lucide-react"

interface ComposeSmsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactPhone: string
  contactName: string
}

const SMS_CHAR_LIMIT = 1600 // Twilio concatenates, but show count

export function ComposeSmsDialog({
  open,
  onOpenChange,
  contactId,
  contactPhone,
  contactName,
}: ComposeSmsDialogProps) {
  const [body, setBody] = useState("")
  const [isPending, startTransition] = useTransition()
  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  useEffect(() => {
    if (open) {
      setLoadingTemplates(true)
      getSmsTemplates().then((result) => {
        if (result.data) setTemplates(result.data)
        setLoadingTemplates(false)
      })
    }
  }, [open])

  function handleTemplateSelect(templateId: string | null) {
    if (!templateId) return
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setBody(template.body)
    }
  }

  function handleSend() {
    if (!body.trim()) return
    startTransition(async () => {
      const result = await sendSms(contactId, contactPhone, body.trim())
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`SMS sent to ${contactName}`)
        setBody("")
        onOpenChange(false)
      }
    })
  }

  function handleClose(value: boolean) {
    if (!isPending) {
      if (!value) setBody("")
      onOpenChange(value)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            Send SMS
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* To (read-only) */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <p className="text-sm">{contactName} — {contactPhone}</p>
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

          {/* Body */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Message</Label>
              <span className="text-xs text-muted-foreground">
                {body.length} / {SMS_CHAR_LIMIT}
              </span>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your SMS message..."
              className="min-h-24 text-sm"
              maxLength={SMS_CHAR_LIMIT}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!body.trim() || isPending}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <MessageSquare className="size-3.5" />}
            Send SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
