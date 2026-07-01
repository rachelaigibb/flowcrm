"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { SUPPORTED_CURRENCIES } from "@/lib/utils/currency"
import { TIMEZONES, ACCENT_COLORS, TAG_COLORS } from "@/lib/constants/colors"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  GripVerticalIcon,
  UsersIcon,
  TagIcon,
  CheckIcon,
  MailIcon,
  FileTextIcon,
  Loader2Icon,
  MessageSquareIcon,
  SmartphoneIcon,
} from "lucide-react"
import {
  updateSubAccount,
  createPipelineStage,
  updatePipelineStage,
  reorderPipelineStages,
  deletePipelineStage,
  createTag,
  updateTag,
  deleteTag,
} from "@/features/settings/actions"
import {
  updateEmailSettings,
  getEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from "@/features/email/actions"
import {
  updateSmsSettings,
  getSmsTemplates,
  createSmsTemplate,
  updateSmsTemplate,
  deleteSmsTemplate,
} from "@/features/sms/actions"
import type { SubAccount, PipelineStage, EmailTemplate, SmsTemplate } from "@/types/database"

interface Tag {
  id: string
  name: string
  color: string
}

interface SubAccountSettingsPageProps {
  subAccount: SubAccount
  stages: PipelineStage[]
  members: Array<{ id: string; user_id: string; role: string; email?: string }>
  tags: Tag[]
}

export function SubAccountSettingsPage({
  subAccount,
  stages: initialStages,
  members,
  tags: initialTags,
}: SubAccountSettingsPageProps) {
  const [name, setName] = React.useState(subAccount.name)
  const [currency, setCurrency] = React.useState(subAccount.currency)
  const [timezone, setTimezone] = React.useState(subAccount.timezone)
  const [accentColor, setAccentColor] = React.useState(
    (subAccount as SubAccount & { accent_color?: string }).accent_color ?? "#6366f1"
  )
  const [saving, setSaving] = React.useState(false)

  const [stages, setStages] = React.useState(initialStages)
  const [addStageOpen, setAddStageOpen] = React.useState(false)
  const [newStageName, setNewStageName] = React.useState("")
  const [newStageColor, setNewStageColor] = React.useState("#6366f1")
  const [addingStage, setAddingStage] = React.useState(false)

  // Tag state
  const [tags, setTags] = React.useState(initialTags)
  const [addTagOpen, setAddTagOpen] = React.useState(false)
  const [newTagName, setNewTagName] = React.useState("")
  const [newTagColor, setNewTagColor] = React.useState<string>(TAG_COLORS[8].value) // indigo default
  const [addingTag, setAddingTag] = React.useState(false)
  const [editingTag, setEditingTag] = React.useState<Tag | null>(null)
  const [editTagName, setEditTagName] = React.useState("")
  const [editTagColor, setEditTagColor] = React.useState("")
  const [editTagOpen, setEditTagOpen] = React.useState(false)
  const [savingTag, setSavingTag] = React.useState(false)

  // Email settings state
  const emailSettings = (subAccount.settings as Record<string, unknown>)?.email as
    | { from_name?: string; from_email?: string; reply_to?: string }
    | undefined
  const [fromName, setFromName] = React.useState(emailSettings?.from_name ?? "")
  const [fromEmail, setFromEmail] = React.useState(emailSettings?.from_email ?? "")
  const [replyTo, setReplyTo] = React.useState(emailSettings?.reply_to ?? "")
  const [savingEmail, setSavingEmail] = React.useState(false)

  // Email templates state
  const [emailTemplates, setEmailTemplates] = React.useState<EmailTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = React.useState(true)
  const [addTemplateOpen, setAddTemplateOpen] = React.useState(false)
  const [newTemplateName, setNewTemplateName] = React.useState("")
  const [newTemplateSubject, setNewTemplateSubject] = React.useState("")
  const [newTemplateBody, setNewTemplateBody] = React.useState("")
  const [addingTemplate, setAddingTemplate] = React.useState(false)
  const [editTemplateOpen, setEditTemplateOpen] = React.useState(false)
  const [editingTemplate, setEditingTemplate] = React.useState<EmailTemplate | null>(null)
  const [editTemplateName, setEditTemplateName] = React.useState("")
  const [editTemplateSubject, setEditTemplateSubject] = React.useState("")
  const [editTemplateBody, setEditTemplateBody] = React.useState("")
  const [savingTemplate, setSavingTemplate] = React.useState(false)
  const [deleteTemplateConfirm, setDeleteTemplateConfirm] = React.useState<string | null>(null)
  const [deletingTemplate, setDeletingTemplate] = React.useState(false)

  // SMS settings state
  const smsSettings = (subAccount.settings as Record<string, unknown>)?.sms as
    | { twilio_phone_number?: string }
    | undefined
  const [twilioPhone, setTwilioPhone] = React.useState(smsSettings?.twilio_phone_number ?? "")
  const [savingSms, setSavingSms] = React.useState(false)

  // SMS templates state
  const [smsTemplates, setSmsTemplates] = React.useState<SmsTemplate[]>([])
  const [loadingSmsTemplates, setLoadingSmsTemplates] = React.useState(true)
  const [addSmsTemplateOpen, setAddSmsTemplateOpen] = React.useState(false)
  const [newSmsTemplateName, setNewSmsTemplateName] = React.useState("")
  const [newSmsTemplateBody, setNewSmsTemplateBody] = React.useState("")
  const [addingSmsTemplate, setAddingSmsTemplate] = React.useState(false)
  const [editSmsTemplateOpen, setEditSmsTemplateOpen] = React.useState(false)
  const [editingSmsTemplate, setEditingSmsTemplate] = React.useState<SmsTemplate | null>(null)
  const [editSmsTemplateName, setEditSmsTemplateName] = React.useState("")
  const [editSmsTemplateBody, setEditSmsTemplateBody] = React.useState("")
  const [savingSmsTemplate, setSavingSmsTemplate] = React.useState(false)
  const [deleteSmsTemplateConfirm, setDeleteSmsTemplateConfirm] = React.useState<string | null>(null)
  const [deletingSmsTemplate, setDeletingSmsTemplate] = React.useState(false)

  // Delete confirmation state (shared for stages and tags)
  const [deleteStageConfirm, setDeleteStageConfirm] = React.useState<string | null>(null)
  const [deletingStage, setDeletingStage] = React.useState(false)
  const [deleteTagConfirm, setDeleteTagConfirm] = React.useState<string | null>(null)
  const [deletingTag, setDeletingTag] = React.useState(false)

  // Sync stages from server on re-render
  React.useEffect(() => {
    setStages(initialStages)
  }, [initialStages])

  // Sync tags from server on re-render
  React.useEffect(() => {
    setTags(initialTags)
  }, [initialTags])

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    setSaving(true)
    const result = await updateSubAccount(subAccount.id, {
      name: name.trim(),
      currency,
      timezone,
      accent_color: accentColor,
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Sub-account updated")
    }
  }

  async function handleAddStage() {
    if (!newStageName.trim()) {
      toast.error("Stage name is required")
      return
    }
    setAddingStage(true)
    const result = await createPipelineStage(
      subAccount.id,
      newStageName.trim(),
      newStageColor
    )
    setAddingStage(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Stage added")
      setNewStageName("")
      setNewStageColor("#6366f1")
      setAddStageOpen(false)
    }
  }

  async function handleMoveStage(index: number, direction: "up" | "down") {
    const newStages = [...stages]
    const swapIndex = direction === "up" ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newStages.length) return

    ;[newStages[index], newStages[swapIndex]] = [
      newStages[swapIndex],
      newStages[index],
    ]

    const reordered = newStages.map((s, i) => ({
      ...s,
      position: i + 1,
    }))

    setStages(reordered)

    const result = await reorderPipelineStages(
      reordered.map((s) => ({ id: s.id, position: s.position }))
    )
    if (result.error) {
      toast.error(result.error)
      setStages(initialStages)
    }
  }

  async function handleDeleteStage(id: string) {
    setDeletingStage(true)
    const result = await deletePipelineStage(id)
    setDeletingStage(false)
    setDeleteStageConfirm(null)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Stage deleted")
    }
  }

  async function handleUpdateStageName(id: string, newName: string) {
    if (!newName.trim()) return
    const result = await updatePipelineStage(id, { name: newName.trim() })
    if (result.error) {
      toast.error(result.error)
    }
  }

  async function handleUpdateStageColor(id: string, color: string) {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, color } : s))
    )
    const result = await updatePipelineStage(id, { color })
    if (result.error) {
      toast.error(result.error)
      setStages(initialStages)
    }
  }

  // Tag handlers
  async function handleAddTag() {
    if (!newTagName.trim()) {
      toast.error("Tag name is required")
      return
    }
    setAddingTag(true)
    const result = await createTag(subAccount.id, newTagName.trim(), newTagColor)
    setAddingTag(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Tag created")
      setNewTagName("")
      setNewTagColor(TAG_COLORS[8].value)
      setAddTagOpen(false)
    }
  }

  async function handleEditTag() {
    if (!editingTag || !editTagName.trim()) return
    setSavingTag(true)
    const result = await updateTag(subAccount.id, editingTag.id, {
      name: editTagName.trim(),
      color: editTagColor,
    })
    setSavingTag(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Tag updated")
      setEditTagOpen(false)
      setEditingTag(null)
    }
  }

  async function handleDeleteTag(id: string) {
    setDeletingTag(true)
    const result = await deleteTag(subAccount.id, id)
    setDeletingTag(false)
    setDeleteTagConfirm(null)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Tag deleted")
    }
  }

  function openEditTag(tag: Tag) {
    setEditingTag(tag)
    setEditTagName(tag.name)
    setEditTagColor(tag.color)
    setEditTagOpen(true)
  }

  // Load email templates on mount
  React.useEffect(() => {
    getEmailTemplates().then((result) => {
      if (result.data) setEmailTemplates(result.data)
      setLoadingTemplates(false)
    })
  }, [])

  // Email settings handler
  async function handleSaveEmailSettings() {
    setSavingEmail(true)
    const result = await updateEmailSettings({
      from_name: fromName.trim() || undefined,
      from_email: fromEmail.trim() || undefined,
      reply_to: replyTo.trim() || undefined,
    })
    setSavingEmail(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Email settings saved")
    }
  }

  // Email template handlers
  async function handleAddTemplate() {
    if (!newTemplateName.trim() || !newTemplateSubject.trim() || !newTemplateBody.trim()) {
      toast.error("All template fields are required")
      return
    }
    setAddingTemplate(true)
    const result = await createEmailTemplate({
      name: newTemplateName.trim(),
      subject: newTemplateSubject.trim(),
      body: newTemplateBody.trim(),
    })
    setAddingTemplate(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Template created")
      if (result.data) setEmailTemplates((prev) => [...prev, result.data!].sort((a, b) => a.name.localeCompare(b.name)))
      setNewTemplateName("")
      setNewTemplateSubject("")
      setNewTemplateBody("")
      setAddTemplateOpen(false)
    }
  }

  function openEditTemplate(template: EmailTemplate) {
    setEditingTemplate(template)
    setEditTemplateName(template.name)
    setEditTemplateSubject(template.subject)
    setEditTemplateBody(template.body)
    setEditTemplateOpen(true)
  }

  async function handleEditTemplate() {
    if (!editingTemplate || !editTemplateName.trim() || !editTemplateSubject.trim() || !editTemplateBody.trim()) return
    setSavingTemplate(true)
    const result = await updateEmailTemplate(editingTemplate.id, {
      name: editTemplateName.trim(),
      subject: editTemplateSubject.trim(),
      body: editTemplateBody.trim(),
    })
    setSavingTemplate(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Template updated")
      if (result.data) {
        setEmailTemplates((prev) =>
          prev.map((t) => (t.id === editingTemplate.id ? result.data! : t)).sort((a, b) => a.name.localeCompare(b.name))
        )
      }
      setEditTemplateOpen(false)
      setEditingTemplate(null)
    }
  }

  async function handleDeleteTemplate(id: string) {
    setDeletingTemplate(true)
    const result = await deleteEmailTemplate(id)
    setDeletingTemplate(false)
    setDeleteTemplateConfirm(null)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Template deleted")
      setEmailTemplates((prev) => prev.filter((t) => t.id !== id))
    }
  }

  // Load SMS templates on mount
  React.useEffect(() => {
    getSmsTemplates().then((result) => {
      if (result.data) setSmsTemplates(result.data)
      setLoadingSmsTemplates(false)
    })
  }, [])

  // SMS settings handler
  async function handleSaveSmsSettings() {
    setSavingSms(true)
    const result = await updateSmsSettings({
      twilio_phone_number: twilioPhone.trim() || undefined,
    })
    setSavingSms(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("SMS settings saved")
    }
  }

  // SMS template handlers
  async function handleAddSmsTemplate() {
    if (!newSmsTemplateName.trim() || !newSmsTemplateBody.trim()) {
      toast.error("Template name and body are required")
      return
    }
    setAddingSmsTemplate(true)
    const result = await createSmsTemplate({
      name: newSmsTemplateName.trim(),
      body: newSmsTemplateBody.trim(),
    })
    setAddingSmsTemplate(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("SMS template created")
      if (result.data) setSmsTemplates((prev) => [...prev, result.data!].sort((a, b) => a.name.localeCompare(b.name)))
      setNewSmsTemplateName("")
      setNewSmsTemplateBody("")
      setAddSmsTemplateOpen(false)
    }
  }

  function openEditSmsTemplate(template: SmsTemplate) {
    setEditingSmsTemplate(template)
    setEditSmsTemplateName(template.name)
    setEditSmsTemplateBody(template.body)
    setEditSmsTemplateOpen(true)
  }

  async function handleEditSmsTemplate() {
    if (!editingSmsTemplate || !editSmsTemplateName.trim() || !editSmsTemplateBody.trim()) return
    setSavingSmsTemplate(true)
    const result = await updateSmsTemplate(editingSmsTemplate.id, {
      name: editSmsTemplateName.trim(),
      body: editSmsTemplateBody.trim(),
    })
    setSavingSmsTemplate(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("SMS template updated")
      if (result.data) {
        setSmsTemplates((prev) =>
          prev.map((t) => (t.id === editingSmsTemplate.id ? result.data! : t)).sort((a, b) => a.name.localeCompare(b.name))
        )
      }
      setEditSmsTemplateOpen(false)
      setEditingSmsTemplate(null)
    }
  }

  async function handleDeleteSmsTemplate(id: string) {
    setDeletingSmsTemplate(true)
    const result = await deleteSmsTemplate(id)
    setDeletingSmsTemplate(false)
    setDeleteSmsTemplateConfirm(null)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("SMS template deleted")
      setSmsTemplates((prev) => prev.filter((t) => t.id !== id))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Settings Sub-Account
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, subscription, and workspace data for {subAccount.name}
        </p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            Name, currency, and timezone for this sub-account
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sa-name">Name</Label>
            <Input
              id="sa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Theme color */}
          <div className="flex flex-col gap-1.5">
            <Label>Theme Color</Label>
            <p className="text-xs text-muted-foreground">
              Sets the accent color for this sub-account in the sidebar and header
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    "size-8 rounded-full border-2 transition-all flex items-center justify-center",
                    accentColor === color
                      ? "border-foreground scale-110 ring-2 ring-foreground/20 ring-offset-2 ring-offset-background"
                      : "border-transparent hover:border-border"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setAccentColor(color)}
                >
                  {accentColor === color && (
                    <CheckIcon className="size-4 text-white drop-shadow-sm" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stages */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Pipeline Stages</CardTitle>
            <CardDescription>
              Configure the stages deals move through
            </CardDescription>
          </div>
          <Dialog open={addStageOpen} onOpenChange={setAddStageOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline">
                  <PlusIcon className="size-4" />
                  Add Stage
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Pipeline Stage</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="stage-name">Name</Label>
                  <Input
                    id="stage-name"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder="e.g. Discovery"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {ACCENT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewStageColor(color)}
                        className={cn(
                          "size-7 rounded-md border-2 transition-all",
                          newStageColor === color
                            ? "border-foreground scale-110"
                            : "border-transparent hover:border-border"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddStage} disabled={addingStage}>
                  {addingStage ? "Adding..." : "Add Stage"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {stages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pipeline stages configured. Add your first stage above.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {stages.map((stage, index) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  index={index}
                  total={stages.length}
                  onMove={handleMoveStage}
                  onDelete={(id) => setDeleteStageConfirm(id)}
                  onUpdateName={handleUpdateStageName}
                  onUpdateColor={handleUpdateStageColor}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <TagIcon className="size-4" />
              Tags
            </CardTitle>
            <CardDescription>
              Organize contacts and deals with colored tags
            </CardDescription>
          </div>
          <Dialog open={addTagOpen} onOpenChange={setAddTagOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline">
                  <PlusIcon className="size-4" />
                  Add Tag
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Tag</DialogTitle>
                <DialogDescription>
                  Create a new tag for organizing contacts and deals
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tag-name">Name</Label>
                  <Input
                    id="tag-name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="e.g. VIP, Hot Lead, Follow Up"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {TAG_COLORS.map((tc) => (
                      <button
                        key={tc.value}
                        type="button"
                        onClick={() => setNewTagColor(tc.value)}
                        className={cn(
                          "size-7 rounded-md border-2 transition-all",
                          newTagColor === tc.value
                            ? "border-foreground scale-110"
                            : "border-transparent hover:border-border"
                        )}
                        style={{ backgroundColor: tc.value }}
                        title={tc.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddTag} disabled={addingTag}>
                  {addingTag ? "Adding..." : "Add Tag"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tags configured. Add your first tag above.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-3 py-1 text-sm group"
                >
                  <div
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="font-medium">{tag.name}</span>
                  <button
                    type="button"
                    onClick={() => openEditTag(tag)}
                    className="size-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    title="Edit tag"
                  >
                    <PencilIcon className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTagConfirm(tag.id)}
                    className="size-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    title="Delete tag"
                  >
                    <TrashIcon className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Tag Dialog */}
      <Dialog open={editTagOpen} onOpenChange={(open) => {
        setEditTagOpen(open)
        if (!open) setEditingTag(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update the tag name or color
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tag-name">Name</Label>
              <Input
                id="edit-tag-name"
                value={editTagName}
                onChange={(e) => setEditTagName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((tc) => (
                  <button
                    key={tc.value}
                    type="button"
                    onClick={() => setEditTagColor(tc.value)}
                    className={cn(
                      "size-7 rounded-md border-2 transition-all",
                      editTagColor === tc.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:border-border"
                    )}
                    style={{ backgroundColor: tc.value }}
                    title={tc.name}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditTag} disabled={savingTag}>
              {savingTag ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Stage Confirmation */}
      <DeleteConfirmDialog
        open={deleteStageConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteStageConfirm(null)
        }}
        title="Delete Pipeline Stage"
        description="Are you sure you want to delete this pipeline stage? This action cannot be undone. Stages with existing deals cannot be deleted."
        onConfirm={() => {
          if (deleteStageConfirm) handleDeleteStage(deleteStageConfirm)
        }}
        isPending={deletingStage}
      />

      {/* Delete Tag Confirmation */}
      <DeleteConfirmDialog
        open={deleteTagConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTagConfirm(null)
        }}
        title="Delete Tag"
        description="Are you sure you want to delete this tag? It will be removed from all contacts and deals that use it."
        onConfirm={() => {
          if (deleteTagConfirm) handleDeleteTag(deleteTagConfirm)
        }}
        isPending={deletingTag}
      />

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailIcon className="size-4" />
            Email Settings
          </CardTitle>
          <CardDescription>
            Configure the sender details for outbound emails via Resend
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="from-name">From Name</Label>
            <Input
              id="from-name"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="e.g. Rachel Gibb"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="from-email">From Email</Label>
            <Input
              id="from-email"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="e.g. hello@yourdomain.com"
            />
            <p className="text-xs text-muted-foreground">
              Must be a verified domain in Resend. Emails will fail without this.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reply-to">Reply-To Email</Label>
            <Input
              id="reply-to"
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="e.g. rachel@yourdomain.com (optional)"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveEmailSettings} disabled={savingEmail}>
              {savingEmail ? "Saving..." : "Save Email Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Templates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon className="size-4" />
              Email Templates
            </CardTitle>
            <CardDescription>
              Reusable email templates for quick sending from contact pages
            </CardDescription>
          </div>
          <Dialog open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline">
                  <PlusIcon className="size-4" />
                  Add Template
                </Button>
              }
            />
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Email Template</DialogTitle>
                <DialogDescription>
                  Create a reusable email template
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="e.g. Welcome Email"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="template-subject">Subject Line</Label>
                  <Input
                    id="template-subject"
                    value={newTemplateSubject}
                    onChange={(e) => setNewTemplateSubject(e.target.value)}
                    placeholder="e.g. Welcome to our community"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="template-body">Email Body</Label>
                  <textarea
                    id="template-body"
                    value={newTemplateBody}
                    onChange={(e) => setNewTemplateBody(e.target.value)}
                    placeholder="Write the email body..."
                    className="flex min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddTemplate} disabled={addingTemplate}>
                  {addingTemplate ? "Adding..." : "Add Template"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-4">
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : emailTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No email templates yet. Add your first template above.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {emailTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{template.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Subject: {template.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEditTemplate(template)}
                      title="Edit template"
                    >
                      <PencilIcon className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeleteTemplateConfirm(template.id)}
                      title="Delete template"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <TrashIcon className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Template Dialog */}
      <Dialog open={editTemplateOpen} onOpenChange={(open) => {
        setEditTemplateOpen(open)
        if (!open) setEditingTemplate(null)
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-template-name">Template Name</Label>
              <Input
                id="edit-template-name"
                value={editTemplateName}
                onChange={(e) => setEditTemplateName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-template-subject">Subject Line</Label>
              <Input
                id="edit-template-subject"
                value={editTemplateSubject}
                onChange={(e) => setEditTemplateSubject(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-template-body">Email Body</Label>
              <textarea
                id="edit-template-body"
                value={editTemplateBody}
                onChange={(e) => setEditTemplateBody(e.target.value)}
                className="flex min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditTemplate} disabled={savingTemplate}>
              {savingTemplate ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation */}
      <DeleteConfirmDialog
        open={deleteTemplateConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTemplateConfirm(null)
        }}
        title="Delete Email Template"
        description="Are you sure you want to delete this email template? This action cannot be undone."
        onConfirm={() => {
          if (deleteTemplateConfirm) handleDeleteTemplate(deleteTemplateConfirm)
        }}
        isPending={deletingTemplate}
      />

      {/* SMS Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SmartphoneIcon className="size-4" />
            SMS Settings
          </CardTitle>
          <CardDescription>
            Configure your Twilio phone number for outbound SMS
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="twilio-phone">Twilio Phone Number</Label>
            <Input
              id="twilio-phone"
              type="tel"
              value={twilioPhone}
              onChange={(e) => setTwilioPhone(e.target.value)}
              placeholder="e.g. +16045551234"
            />
            <p className="text-xs text-muted-foreground">
              Must be a verified Twilio number. Use E.164 format (+1XXXXXXXXXX).
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveSmsSettings} disabled={savingSms}>
              {savingSms ? "Saving..." : "Save SMS Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SMS Templates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <MessageSquareIcon className="size-4" />
              SMS Templates
            </CardTitle>
            <CardDescription>
              Reusable SMS templates for quick sending from contact pages
            </CardDescription>
          </div>
          <Dialog open={addSmsTemplateOpen} onOpenChange={setAddSmsTemplateOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline">
                  <PlusIcon className="size-4" />
                  Add Template
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add SMS Template</DialogTitle>
                <DialogDescription>
                  Create a reusable SMS template
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sms-template-name">Template Name</Label>
                  <Input
                    id="sms-template-name"
                    value={newSmsTemplateName}
                    onChange={(e) => setNewSmsTemplateName(e.target.value)}
                    placeholder="e.g. Follow-up Reminder"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sms-template-body">Message</Label>
                  <textarea
                    id="sms-template-body"
                    value={newSmsTemplateBody}
                    onChange={(e) => setNewSmsTemplateBody(e.target.value)}
                    placeholder="Write the SMS message..."
                    className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    maxLength={1600}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {newSmsTemplateBody.length} / 1600
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddSmsTemplate} disabled={addingSmsTemplate}>
                  {addingSmsTemplate ? "Adding..." : "Add Template"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loadingSmsTemplates ? (
            <div className="flex items-center justify-center py-4">
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : smsTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No SMS templates yet. Add your first template above.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {smsTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{template.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {template.body.slice(0, 60)}{template.body.length > 60 ? "..." : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEditSmsTemplate(template)}
                      title="Edit template"
                    >
                      <PencilIcon className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeleteSmsTemplateConfirm(template.id)}
                      title="Delete template"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <TrashIcon className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit SMS Template Dialog */}
      <Dialog open={editSmsTemplateOpen} onOpenChange={(open) => {
        setEditSmsTemplateOpen(open)
        if (!open) setEditingSmsTemplate(null)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit SMS Template</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-sms-template-name">Template Name</Label>
              <Input
                id="edit-sms-template-name"
                value={editSmsTemplateName}
                onChange={(e) => setEditSmsTemplateName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-sms-template-body">Message</Label>
              <textarea
                id="edit-sms-template-body"
                value={editSmsTemplateBody}
                onChange={(e) => setEditSmsTemplateBody(e.target.value)}
                className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                maxLength={1600}
              />
              <p className="text-xs text-muted-foreground text-right">
                {editSmsTemplateBody.length} / 1600
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditSmsTemplate} disabled={savingSmsTemplate}>
              {savingSmsTemplate ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete SMS Template Confirmation */}
      <DeleteConfirmDialog
        open={deleteSmsTemplateConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteSmsTemplateConfirm(null)
        }}
        title="Delete SMS Template"
        description="Are you sure you want to delete this SMS template? This action cannot be undone."
        onConfirm={() => {
          if (deleteSmsTemplateConfirm) handleDeleteSmsTemplate(deleteSmsTemplateConfirm)
        }}
        isPending={deletingSmsTemplate}
      />

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="size-4" />
            Members
          </CardTitle>
          <CardDescription>
            Users with access to this sub-account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-border/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {(member.email ?? "U")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {member.email ?? "Team member"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {member.user_id}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">{member.role}</Badge>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No members assigned to this sub-account yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StageRow({
  stage,
  index,
  total,
  onMove,
  onDelete,
  onUpdateName,
  onUpdateColor,
}: {
  stage: PipelineStage
  index: number
  total: number
  onMove: (index: number, direction: "up" | "down") => void
  onDelete: (id: string) => void
  onUpdateName: (id: string, name: string) => void
  onUpdateColor: (id: string, color: string) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [editName, setEditName] = React.useState(stage.name)
  const [colorOpen, setColorOpen] = React.useState(false)

  React.useEffect(() => {
    setEditName(stage.name)
  }, [stage.name])

  function handleSaveName() {
    if (editName.trim() && editName.trim() !== stage.name) {
      onUpdateName(stage.id, editName.trim())
    }
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 p-2 group">
      <GripVerticalIcon className="size-4 text-muted-foreground/40 shrink-0" />

      <button
        type="button"
        onClick={() => setColorOpen(!colorOpen)}
        className="size-5 rounded-full shrink-0 border border-border/50 transition-transform hover:scale-110"
        style={{ backgroundColor: stage.color }}
        title="Change color"
      />

      {colorOpen ? (
        <div className="flex flex-wrap gap-1.5 flex-1">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                onUpdateColor(stage.id, color)
                setColorOpen(false)
              }}
              className={cn(
                "size-6 rounded-full border-2 transition-transform hover:scale-110",
                stage.color === color
                  ? "border-foreground"
                  : "border-transparent"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            {editing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName()
                  if (e.key === "Escape") {
                    setEditName(stage.name)
                    setEditing(false)
                  }
                }}
                className="h-7 text-sm"
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-sm font-medium truncate text-left hover:text-foreground/80 transition-colors"
              >
                {stage.name}
              </button>
            )}
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={index === 0}
              onClick={() => onMove(index, "up")}
              title="Move up"
            >
              <ChevronUpIcon className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={index === total - 1}
              onClick={() => onMove(index, "down")}
              title="Move down"
            >
              <ChevronDownIcon className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onDelete(stage.id)}
              title="Delete stage"
              className="text-muted-foreground hover:text-destructive"
            >
              <TrashIcon className="size-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
