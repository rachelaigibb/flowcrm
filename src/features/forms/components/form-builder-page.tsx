"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { updateForm } from "@/features/forms/actions"
import type { Form, FormField, FormFieldType, FormSettings } from "@/types/database"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
  CardDescription,
} from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Eye,
  Globe,
  ExternalLink,
  Settings,
  FileText,
} from "lucide-react"

// ── Types ──

interface FormBuilderPageProps {
  form: Form
  submissionCount: number
}

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "textarea", label: "Textarea" },
  { value: "select", label: "Select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
]

// ── Component ──

export function FormBuilderPage({ form, submissionCount }: FormBuilderPageProps) {
  const router = useRouter()

  // ── State ──
  const [name, setName] = useState(form.name)
  const [editingName, setEditingName] = useState(false)
  const [published, setPublished] = useState(form.published)
  const [fields, setFields] = useState<FormField[]>(form.fields ?? [])
  const [settings, setSettings] = useState<FormSettings>(
    form.settings ?? {
      submit_button_text: "Submit",
      success_message: "Thank you for your submission.",
      redirect_url: null,
      create_contact: true,
      notify_email: null,
    }
  )
  const [saving, setSaving] = useState(false)
  const [addFieldOpen, setAddFieldOpen] = useState(false)

  // ── New field form state ──
  const [newLabel, setNewLabel] = useState("")
  const [newType, setNewType] = useState<FormFieldType>("text")
  const [newPlaceholder, setNewPlaceholder] = useState("")
  const [newRequired, setNewRequired] = useState(false)
  const [newOptions, setNewOptions] = useState("")

  // ── Field editing helpers ──

  const resetNewFieldForm = useCallback(() => {
    setNewLabel("")
    setNewType("text")
    setNewPlaceholder("")
    setNewRequired(false)
    setNewOptions("")
  }, [])

  const addField = useCallback(() => {
    if (!newLabel.trim()) {
      toast.error("Field label is required")
      return
    }

    const field: FormField = {
      id: crypto.randomUUID(),
      type: newType,
      label: newLabel.trim(),
      placeholder: newPlaceholder.trim() || null,
      required: newRequired,
      options:
        newType === "select"
          ? newOptions
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : [],
    }

    setFields((prev) => [...prev, field])
    resetNewFieldForm()
    setAddFieldOpen(false)
    toast.success("Field added")
  }, [newLabel, newType, newPlaceholder, newRequired, newOptions, resetNewFieldForm])

  const removeField = useCallback((fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId))
  }, [])

  const updateFieldLabel = useCallback((fieldId: string, label: string) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, label } : f))
    )
  }, [])

  const toggleFieldRequired = useCallback((fieldId: string) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, required: !f.required } : f))
    )
  }, [])

  const moveField = useCallback((index: number, direction: "up" | "down") => {
    setFields((prev) => {
      const next = [...prev]
      const targetIndex = direction === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= next.length) return prev
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }, [])

  // ── Save ──

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const result = await updateForm(form.id, {
        name: name.trim(),
        fields,
        settings,
        published,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Form saved")
        router.refresh()
      }
    } catch {
      toast.error("Failed to save form")
    } finally {
      setSaving(false)
    }
  }, [form.id, name, fields, settings, published, router])

  // ── Toggle published ──

  const handleTogglePublished = useCallback(async () => {
    const next = !published
    setPublished(next)

    const result = await updateForm(form.id, { published: next })
    if (result.error) {
      setPublished(!next) // revert
      toast.error(result.error)
    } else {
      toast.success(next ? "Form published" : "Form unpublished")
      router.refresh()
    }
  }, [published, form.id, router])

  // ── Public URL ──
  const publicUrl = `/f/${form.slug}`

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/forms">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft />
            </Button>
          </Link>

          {/* Editable name */}
          {editingName ? (
            <Input
              className="h-7 max-w-xs text-sm font-medium"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setEditingName(false)
              }}
              autoFocus
            />
          ) : (
            <button
              className="truncate text-sm font-medium hover:underline underline-offset-2"
              onClick={() => setEditingName(true)}
            >
              {name || "Untitled Form"}
            </button>
          )}

          {/* Published toggle */}
          <Button
            variant={published ? "default" : "outline"}
            size="xs"
            onClick={handleTogglePublished}
          >
            <Globe className="size-3" />
            {published ? "Published" : "Draft"}
          </Button>

          {/* View link (only when published) */}
          {published && (
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="xs">
                <ExternalLink className="size-3" />
                View
              </Button>
            </a>
          )}

          {/* Submissions badge */}
          <Link href={`/forms/${form.id}/submissions`}>
            <Badge variant="secondary" className="cursor-pointer">
              <FileText className="size-3 mr-1" />
              {submissionCount} submission{submissionCount !== 1 ? "s" : ""}
            </Badge>
          </Link>
        </div>

        {/* Save button */}
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save
        </Button>
      </div>

      {/* ── Two-column body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[3fr_2fr]">
          {/* ── Left: Field Editor ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Fields</CardTitle>
                <CardDescription>
                  {fields.length === 0
                    ? "No fields yet. Add your first field below."
                    : `${fields.length} field${fields.length !== 1 ? "s" : ""}`}
                </CardDescription>
                <CardAction>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetNewFieldForm()
                      setAddFieldOpen(true)
                    }}
                  >
                    <Plus className="size-4" />
                    Add Field
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground">
                    <FileText className="size-8 mb-2 opacity-50" />
                    <p className="text-sm">No fields added yet</p>
                    <p className="text-xs mt-1">
                      Click &quot;Add Field&quot; to get started
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <FieldRow
                        key={field.id}
                        field={field}
                        index={index}
                        total={fields.length}
                        onLabelChange={(label) =>
                          updateFieldLabel(field.id, label)
                        }
                        onToggleRequired={() => toggleFieldRequired(field.id)}
                        onMoveUp={() => moveField(index, "up")}
                        onMoveDown={() => moveField(index, "down")}
                        onDelete={() => removeField(field.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right: Settings + Preview ── */}
          <div className="space-y-4">
            {/* Settings card */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <Settings className="size-4 inline mr-1.5 -mt-0.5" />
                  Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="submit-text">Submit button text</Label>
                  <Input
                    id="submit-text"
                    value={settings.submit_button_text}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        submit_button_text: e.target.value,
                      }))
                    }
                    placeholder="Submit"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="success-msg">Success message</Label>
                  <Textarea
                    id="success-msg"
                    value={settings.success_message}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        success_message: e.target.value,
                      }))
                    }
                    placeholder="Thank you for your submission."
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="create-contact"
                    checked={settings.create_contact}
                    onCheckedChange={(checked) =>
                      setSettings((s) => ({
                        ...s,
                        create_contact: checked === true,
                      }))
                    }
                  />
                  <Label htmlFor="create-contact" className="text-sm">
                    Auto-create contact from submissions
                  </Label>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notify-email">
                    Notification email{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="notify-email"
                    type="email"
                    value={settings.notify_email ?? ""}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        notify_email: e.target.value || null,
                      }))
                    }
                    placeholder="you@example.com"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Preview card */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <Eye className="size-4 inline mr-1.5 -mt-0.5" />
                  Preview
                </CardTitle>
                <CardDescription>
                  How the form will appear to submitters
                </CardDescription>
              </CardHeader>
              <CardContent>
                {fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Add fields to see a preview
                  </p>
                ) : (
                  <div className="space-y-4">
                    {fields.map((field) => (
                      <PreviewField key={field.id} field={field} />
                    ))}
                    <Button className="w-full" disabled>
                      {settings.submit_button_text || "Submit"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Add Field Dialog ── */}
      <Dialog open={addFieldOpen} onOpenChange={setAddFieldOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Field</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="field-label">Label</Label>
              <Input
                id="field-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Full Name"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={newType}
                onValueChange={(v) => {
                  if (v) setNewType(v as FormFieldType)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {FIELD_TYPES.find((t) => t.value === newType)?.label ??
                      "Select type"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-placeholder">
                Placeholder{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="field-placeholder"
                value={newPlaceholder}
                onChange={(e) => setNewPlaceholder(e.target.value)}
                placeholder="e.g. Enter your name"
              />
            </div>

            {newType === "select" && (
              <div className="space-y-1.5">
                <Label htmlFor="field-options">
                  Options{" "}
                  <span className="text-muted-foreground font-normal">
                    (comma-separated)
                  </span>
                </Label>
                <Textarea
                  id="field-options"
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                  placeholder="Option 1, Option 2, Option 3"
                  rows={2}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="field-required"
                checked={newRequired}
                onCheckedChange={(checked) => setNewRequired(checked === true)}
              />
              <Label htmlFor="field-required" className="text-sm">
                Required
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddFieldOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={addField}>
              <Plus className="size-4" />
              Add Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Field Row ──

interface FieldRowProps {
  field: FormField
  index: number
  total: number
  onLabelChange: (label: string) => void
  onToggleRequired: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

function FieldRow({
  field,
  index,
  total,
  onLabelChange,
  onToggleRequired,
  onMoveUp,
  onMoveDown,
  onDelete,
}: FieldRowProps) {
  const [editing, setEditing] = useState(false)

  return (
    <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-muted/30">
      {/* Drag handle (visual only) */}
      <GripVertical className="size-4 shrink-0 text-muted-foreground cursor-grab" />

      {/* Label (editable inline) */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <Input
            className="h-6 text-sm"
            value={field.label}
            onChange={(e) => onLabelChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setEditing(false)
            }}
            autoFocus
          />
        ) : (
          <button
            className="text-sm font-medium truncate block text-left hover:underline underline-offset-2"
            onClick={() => setEditing(true)}
          >
            {field.label || "Untitled"}
          </button>
        )}
      </div>

      {/* Type badge */}
      <Badge variant="outline" className="shrink-0 text-xs">
        {field.type}
      </Badge>

      {/* Required toggle */}
      <div className="flex items-center gap-1 shrink-0">
        <Checkbox
          checked={field.required}
          onCheckedChange={onToggleRequired}
        />
        <span className="text-xs text-muted-foreground">Req</span>
      </div>

      {/* Move up/down */}
      <div className="flex shrink-0">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onMoveUp}
          disabled={index === 0}
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onMoveDown}
          disabled={index === total - 1}
        >
          <ChevronDown />
        </Button>
      </div>

      {/* Delete */}
      <Button variant="ghost" size="icon-xs" onClick={onDelete}>
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  )
}

// ── Preview Field (read-only) ──

function PreviewField({ field }: { field: FormField }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>

      {field.type === "textarea" ? (
        <Textarea
          placeholder={field.placeholder ?? ""}
          rows={3}
          disabled
          className="resize-none"
        />
      ) : field.type === "select" ? (
        <Select disabled>
          <SelectTrigger className="w-full">
            <SelectValue>
              {field.placeholder || "Select an option"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "checkbox" ? (
        <div className="flex items-center gap-2">
          <Checkbox disabled />
          <span className="text-sm text-muted-foreground">
            {field.placeholder || field.label}
          </span>
        </div>
      ) : field.type === "date" ? (
        <Input type="date" disabled />
      ) : field.type === "number" ? (
        <Input
          type="number"
          placeholder={field.placeholder ?? ""}
          disabled
        />
      ) : (
        <Input
          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
          placeholder={field.placeholder ?? ""}
          disabled
        />
      )}
    </div>
  )
}
