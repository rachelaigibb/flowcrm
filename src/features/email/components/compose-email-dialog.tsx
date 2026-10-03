"use client"

import { useState, useEffect, useRef } from "react"
import { sendEmail, prepareEmailAttachment, getEmailTemplates, getComposeDefaults } from "../actions"
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
  const [marketing, setMarketing] = useState(true)
  const [copyTo, setCopyTo] = useState<string | null>(null)
  const [hasSignature, setHasSignature] = useState(false)
  const [maxBytes, setMaxBytes] = useState(DEFAULT_MAX_BYTES)
  const [isPending, setIsPending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [sendStage, setSendStage] = useState("")
  const uploadedRef = useRef(new Map<File, { path: string; name: string }>())
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
    // FileList is live: clearing the input before React runs the updater
    // empties it. Snapshot the selection before resetting the input.
    const selected = Array.from(list)
    setFiles((prev) => [...prev, ...selected])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function reset() {
    setSendError(null)
    uploadedRef.current.clear()
    setSubject("")
    setBody("")
    setFiles([])
    setSendCopy(true)
    setMarketing(true)
  }

  async function handleSend() {
    if (isPending || !subject.trim() || !body.trim() || tooLarge) return
    setIsPending(true)
    setSendError(null)
    try {
      const formData = new FormData()
      formData.set("contact_id", contactId)
      formData.set("subject", subject.trim())
      formData.set("body", body.trim())
      formData.set("send_copy", sendCopy && copyTo ? "true" : "false")
      formData.set("marketing", String(marketing))
      const uploaded = []
      for (const file of files) {
        setSendStage(`Uploading ${file.name}…`)
        let reference = uploadedRef.current.get(file)
        if (!reference) {
          const prepared = await prepareEmailAttachment(contactId, file.name, file.size)
          if (prepared.error || !prepared.signedUrl || !prepared.path) {
            setSendError(prepared.error || "Could not start the attachment upload.")
            return
          }
          let response: Response
          try {
            response = await fetch(prepared.signedUrl, {
              method: "PUT", body: file,
              headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
              signal: AbortSignal.timeout(120_000),
            })
          } catch {
            setSendError(`Upload did not complete for ${file.name}. Email was not sent. Your draft has been kept.`)
            return
          }
          if (!response.ok) {
            setSendError(`Upload failed for ${file.name}. Email was not sent. Your draft has been kept.`)
            return
          }
          reference = { path: prepared.path, name: file.name }
          uploadedRef.current.set(file, reference)
        }
        uploaded.push(reference)
      }
      formData.set("uploaded_files", JSON.stringify(uploaded))
      setSendStage("Sending email…")
      const result = await sendEmail(formData)
      if (result.error) {
        setSendError(result.error)
      } else {
        toast.success(
          result.copiedTo ? `Email sent to ${contactName} (copy to ${result.copiedTo})` : `Email sent to ${contactName}`
        )
        reset()
        onOpenChange(false)
      }
    } catch {
      // A transport failure does not prove the provider rejected the email.
      // Keep the draft and avoid automatically retrying a possibly sent message.
      setSendError("Could not confirm whether this email was sent. Check the contact timeline and your inbox before trying again. Your draft has been kept. If your session expired, sign in again.")
    } finally {
      setIsPending(false)
      setSendStage("")
    }
  }

  function handleClose(value: boolean) {
    if (!isPending) {
      if (!value) reset()
      onOpenChange(value)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-4" />
            Send Email
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain">
          {isPending && <p role="status" className="text-sm text-muted-foreground">{sendStage || "Preparing email…"}</p>}
          {sendError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{sendError}</p>}
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
              className="h-48 min-h-32 max-h-64 field-sizing-fixed resize-none overflow-y-auto text-sm"
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
                      disabled={isPending}
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
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(v === true)} disabled={isPending} />
            <span>Marketing email <span className="block text-xs text-muted-foreground">Adds your mailing address and unsubscribe link. Requires consent. Turn off only for personal correspondence or a requested response.</span></span>
          </label>
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
