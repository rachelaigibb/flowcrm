"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { sendEmail, getEmailTemplates, getComposeDefaults } from "../actions"
import type { EmailTemplate } from "@/types/database"
import { formatBytes } from "@/features/documents/format"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Loader2, Send, FileText, Paperclip, X } from "lucide-react"

interface ComposeEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactEmail: string
  contactName: string
  initialSubject?: string
  initialBody?: string
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024

export function ComposeEmailDialog({
  open,
  onOpenChange,
  contactId,
  contactEmail,
  contactName,
  initialSubject,
  initialBody,
}: ComposeEmailDialogProps) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [sendCopy, setSendCopy] = useState(true)
  const [copyTo, setCopyTo] = useState<string | null>(null)
  const [hasSignature, setHasSignature] = useState(false)
  const [maxBytes, setMaxBytes] = useState(DEFAULT_MAX_BYTES)
  const [isPending, startTransition] = useTransition()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
  const tooLarge = totalBytes > maxBytes

  // Load templates and sender defaults when the dialog opens; seed fields
  // from an initial draft (e.g. an AI-generated follow-up).
  useEffect(() => {
    if (open) {
      if (initialSubject !== undefined) setSubject(initialSubject)
      if (initialBody !== undefined) setBody(initialBody)
      getEmailTemplates().then((result) => {
        if (result.data) setTemplates(result.data)
      })
      getComposeDefaults().then((d) => {
        setCopyTo(d.copyTo)
        setHasSignature(d.hasSignature)
        setMaxBytes(d.maxBytes)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleTemplateSelect(templateId: string | null) {
    if (!templateId) return
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSubject(template.subject)
      setBody(template.body)
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list)])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function reset() {
    setSubject("")
    setBody("")
    setFiles([])
    setSendCopy(true)
  }

  function handleSend() {
    if (!subject.trim() || !body.trim() || tooLarge) return
    startTransition(async () => {
      const formData = new FormData()
      formData.set("contact_id", contactId)
      formData.set("subject", subject.trim())
      formData.set("body", body.trim())
      formData.set("send_copy", sendCopy && copyTo ? "true" : "false")
      files.forEach((f) => formData.append("files", f))
      const result = await sendEmail(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(
          result.copiedTo ? `Email sent to ${contactName} (copy to ${result.copiedTo})` : `Email sent to ${contactName}`
        )
        reset()
        onOpenChange(false)
      }
    })
  }

  function handleClose(value: boolean) {
    if (!isPending) {
      if (!value) reset()
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
            <p className="text-xs text-muted-foreground">
              {hasSignature
                ? "Your signature is added automatically."
                : "No signature set yet — add one in Settings → Email Settings."}
            </p>
          </div>

          {/* Attachments */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Attachments</Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
              >
                <Paperclip className="size-3" />
                Attach file
              </Button>
            </div>
            {files.length > 0 && (
              <div className="flex flex-col gap-1">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                    <FileText className="size-3 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 text-muted-foreground">{formatBytes(f.size)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
                <p className={tooLarge ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                  {formatBytes(totalBytes)} of {formatBytes(maxBytes)}
                  {tooLarge ? " — remove a file to send" : ""}
                </p>
              </div>
            )}
          </div>

          {/* Copy to self */}
          {copyTo && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={sendCopy} onCheckedChange={(v) => setSendCopy(v === true)} />
              <span>
                Send me a copy <span className="text-muted-foreground">({copyTo})</span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!subject.trim() || !body.trim() || tooLarge || isPending}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
