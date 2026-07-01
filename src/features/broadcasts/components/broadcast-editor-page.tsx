"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type {
  Broadcast,
  BroadcastChannel,
  BroadcastRecipientFilter,
  BroadcastStats,
  EmailTemplate,
  SmsTemplate,
} from "@/types/database"
import {
  updateBroadcast,
  sendBroadcast,
  getRecipientCount,
} from "@/features/broadcasts/actions"
import { Card, CardContent, CardHeader, CardTitle, CardAction, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  ArrowLeft,
  Save,
  Loader2,
  Send,
  Mail,
  MessageSquare,
  Users,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"

const STATUS_BADGE_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  sending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  sent: "bg-green-500/10 text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
}

const SMS_MAX_LENGTH = 160

interface BroadcastEditorPageProps {
  broadcast: Broadcast
  emailTemplates: EmailTemplate[]
  smsTemplates: SmsTemplate[]
  availableTags: string[]
  availableSources: string[]
}

export function BroadcastEditorPage({
  broadcast,
  emailTemplates,
  smsTemplates,
  availableTags,
  availableSources,
}: BroadcastEditorPageProps) {
  const router = useRouter()
  const isDraft = broadcast.status === "draft"
  const stats = broadcast.stats as BroadcastStats

  // ── Form state ──
  const [name, setName] = useState(broadcast.name)
  const [emailSubject, setEmailSubject] = useState(broadcast.email_subject ?? "")
  const [emailBody, setEmailBody] = useState(broadcast.email_body ?? "")
  const [smsBody, setSmsBody] = useState(broadcast.sms_body ?? "")
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<string | null>(
    broadcast.email_template_id ?? null
  )
  const [selectedSmsTemplateId, setSelectedSmsTemplateId] = useState<string | null>(
    broadcast.sms_template_id ?? null
  )

  // ── Recipient filter state ──
  const filter = broadcast.recipient_filter as BroadcastRecipientFilter
  const [sendToAll, setSendToAll] = useState(filter.all ?? false)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    new Set(filter.tags ?? [])
  )
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(filter.sources ?? [])
  )

  // ── Schedule state ──
  const [scheduledAt, setScheduledAt] = useState(broadcast.scheduled_at ?? "")

  // ── UI state ──
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)

  // ── Build current filter object ──
  const buildFilter = useCallback((): BroadcastRecipientFilter => {
    if (sendToAll) return { all: true }
    const f: BroadcastRecipientFilter = {}
    if (selectedTags.size > 0) f.tags = Array.from(selectedTags)
    if (selectedSources.size > 0) f.sources = Array.from(selectedSources)
    return f
  }, [sendToAll, selectedTags, selectedSources])

  // ── Fetch recipient count when filters change ──
  useEffect(() => {
    let cancelled = false
    async function fetchCount() {
      setCountLoading(true)
      try {
        const currentFilter = buildFilter()
        const result = await getRecipientCount(currentFilter, broadcast.channel)
        if (!cancelled) {
          setRecipientCount(result.data ?? null)
        }
      } catch {
        // Silently ignore count fetch errors
      } finally {
        if (!cancelled) setCountLoading(false)
      }
    }
    fetchCount()
    return () => {
      cancelled = true
    }
  }, [sendToAll, selectedTags, selectedSources, broadcast.channel, buildFilter])

  // ── Save draft ──
  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateBroadcast(broadcast.id, {
        name: name.trim() || broadcast.name,
        email_subject: emailSubject || undefined,
        email_body: emailBody || undefined,
        sms_body: smsBody || undefined,
        email_template_id: selectedEmailTemplateId,
        sms_template_id: selectedSmsTemplateId,
        recipient_filter: buildFilter(),
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Broadcast saved")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // ── Send now ──
  async function handleSend() {
    setSending(true)
    try {
      // Save first
      const saveResult = await updateBroadcast(broadcast.id, {
        name: name.trim() || broadcast.name,
        email_subject: emailSubject || undefined,
        email_body: emailBody || undefined,
        sms_body: smsBody || undefined,
        email_template_id: selectedEmailTemplateId,
        sms_template_id: selectedSmsTemplateId,
        recipient_filter: buildFilter(),
      })
      if (saveResult.error) {
        toast.error(saveResult.error)
        return
      }

      const result = await sendBroadcast(broadcast.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Broadcast sent to ${result.data?.sent ?? 0} recipients`)
      router.refresh()
    } finally {
      setSending(false)
    }
  }

  // ── Schedule ──
  async function handleSchedule() {
    if (!scheduledAt) {
      toast.error("Please select a date and time")
      return
    }
    setScheduling(true)
    try {
      const result = await updateBroadcast(broadcast.id, {
        name: name.trim() || broadcast.name,
        email_subject: emailSubject || undefined,
        email_body: emailBody || undefined,
        sms_body: smsBody || undefined,
        email_template_id: selectedEmailTemplateId,
        sms_template_id: selectedSmsTemplateId,
        recipient_filter: buildFilter(),
        scheduled_at: new Date(scheduledAt).toISOString(),
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Broadcast scheduled")
      router.refresh()
    } finally {
      setScheduling(false)
    }
  }

  // ── Template select handlers ──
  function handleEmailTemplateSelect(val: string | null) {
    if (!val) return
    setSelectedEmailTemplateId(val)
    const template = emailTemplates.find((t) => t.id === val)
    if (template) {
      setEmailSubject(template.subject)
      setEmailBody(template.body)
    }
  }

  function handleSmsTemplateSelect(val: string | null) {
    if (!val) return
    setSelectedSmsTemplateId(val)
    const template = smsTemplates.find((t) => t.id === val)
    if (template) {
      setSmsBody(template.body)
    }
  }

  // ── Tag/source toggle helpers ──
  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function toggleSource(source: string) {
    setSelectedSources((prev) => {
      const next = new Set(prev)
      if (next.has(source)) next.delete(source)
      else next.add(source)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/broadcasts">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          {isDraft ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-2xl font-semibold tracking-tight border-none bg-transparent px-0 h-auto focus-visible:ring-0"
              placeholder="Broadcast name"
            />
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {broadcast.name}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className={cn("border capitalize", STATUS_BADGE_COLORS[broadcast.status])}
          >
            {broadcast.status}
          </Badge>
          <Badge variant="outline" className="gap-1">
            {broadcast.channel === "email" ? (
              <Mail className="size-3" />
            ) : (
              <MessageSquare className="size-3" />
            )}
            {broadcast.channel === "email" ? "Email" : "SMS"}
          </Badge>
          {isDraft && (
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" data-icon="inline-start" />
              )}
              Save Draft
            </Button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Left column: Content */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
              <CardDescription>
                {broadcast.channel === "email"
                  ? "Compose your email or select a template"
                  : "Compose your SMS or select a template"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Template selector */}
              {broadcast.channel === "email" && emailTemplates.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Email Template</Label>
                  <Select
                    value={selectedEmailTemplateId ?? undefined}
                    onValueChange={handleEmailTemplateSelect}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        <span className="text-muted-foreground">Choose a template</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {emailTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {broadcast.channel === "sms" && smsTemplates.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">SMS Template</Label>
                  <Select
                    value={selectedSmsTemplateId ?? undefined}
                    onValueChange={handleSmsTemplateSelect}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        <span className="text-muted-foreground">Choose a template</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {smsTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Email fields */}
              {broadcast.channel === "email" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email-subject">Subject</Label>
                    <Input
                      id="email-subject"
                      placeholder="Email subject line"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      disabled={!isDraft}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email-body">Body</Label>
                    <Textarea
                      id="email-body"
                      placeholder="Write your email content..."
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={12}
                      disabled={!isDraft}
                    />
                  </div>
                </>
              )}

              {/* SMS fields */}
              {broadcast.channel === "sms" && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sms-body">Message</Label>
                    <span
                      className={cn(
                        "text-xs",
                        smsBody.length > SMS_MAX_LENGTH
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {smsBody.length}/{SMS_MAX_LENGTH}
                    </span>
                  </div>
                  <Textarea
                    id="sms-body"
                    placeholder="Write your SMS message..."
                    value={smsBody}
                    onChange={(e) => setSmsBody(e.target.value)}
                    rows={6}
                    disabled={!isDraft}
                  />
                  {smsBody.length > SMS_MAX_LENGTH && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      Message exceeds {SMS_MAX_LENGTH} characters and may be split into multiple segments.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Recipients + Actions */}
        <div className="flex flex-col gap-6">
          {/* Recipients Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" />
                Recipients
              </CardTitle>
              {recipientCount !== null && (
                <CardAction>
                  <Badge variant="outline" className="gap-1">
                    {countLoading ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Users className="size-3" />
                    )}
                    ~{recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
                  </Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Send to all */}
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sendToAll}
                  onCheckedChange={(checked) => {
                    setSendToAll(checked === true)
                    if (checked) {
                      setSelectedTags(new Set())
                      setSelectedSources(new Set())
                    }
                  }}
                  disabled={!isDraft}
                />
                <span className="text-sm">Send to all contacts</span>
              </label>

              {/* Tag filters */}
              {!sendToAll && availableTags.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Filter className="size-3" />
                    Filter by Tags
                  </Label>
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {availableTags.map((tag) => (
                      <label
                        key={tag}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted transition-colors cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedTags.has(tag)}
                          onCheckedChange={() => toggleTag(tag)}
                          disabled={!isDraft}
                        />
                        <span className="truncate">{tag}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Source filters */}
              {!sendToAll && availableSources.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Filter className="size-3" />
                    Filter by Source
                  </Label>
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {availableSources.map((source) => (
                      <label
                        key={source}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted transition-colors cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedSources.has(source)}
                          onCheckedChange={() => toggleSource(source)}
                          disabled={!isDraft}
                        />
                        <span className="truncate capitalize">{source}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertCircle className="size-3 mt-0.5 shrink-0" />
                Only contacts with explicit or implied consent will receive this broadcast.
              </p>
            </CardContent>
          </Card>

          {/* Send Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="size-4" />
                Send
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {broadcast.status === "draft" && (
                <>
                  {/* Send Now */}
                  <Button
                    className="w-full"
                    onClick={handleSend}
                    disabled={sending}
                  >
                    {sending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" data-icon="inline-start" />
                    )}
                    Send Now
                  </Button>

                  <Separator />

                  {/* Schedule */}
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3" />
                      Schedule for later
                    </Label>
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleSchedule}
                      disabled={scheduling || !scheduledAt}
                    >
                      {scheduling ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Calendar className="size-3.5" data-icon="inline-start" />
                      )}
                      Schedule
                    </Button>
                  </div>
                </>
              )}

              {broadcast.status === "sending" && (
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-sm">Sending...</span>
                </div>
              )}

              {broadcast.status === "sent" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="size-4" />
                    <span className="text-sm font-medium">Broadcast sent</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
                      <span className="text-lg font-semibold">{stats.sent}</span>
                      <span className="text-xs text-muted-foreground">Sent</span>
                    </div>
                    <div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
                      <span className="text-lg font-semibold">{stats.failed}</span>
                      <span className="text-xs text-muted-foreground">Failed</span>
                    </div>
                    <div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
                      <span className="text-lg font-semibold">{stats.opened}</span>
                      <span className="text-xs text-muted-foreground">Opened</span>
                    </div>
                  </div>
                </div>
              )}

              {broadcast.status === "scheduled" && (
                <div className="flex items-center gap-2 text-blue-400">
                  <Calendar className="size-4" />
                  <span className="text-sm">
                    Scheduled for{" "}
                    {broadcast.scheduled_at
                      ? new Date(broadcast.scheduled_at).toLocaleString()
                      : "unknown"}
                  </span>
                </div>
              )}

              {broadcast.status === "failed" && (
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="size-4" />
                  <span className="text-sm">Broadcast failed to send</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
