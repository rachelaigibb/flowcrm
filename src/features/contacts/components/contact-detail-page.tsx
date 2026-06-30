"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { ContactWithRelations } from "../types"
import type { ConsentStatus, Deal, Task } from "@/types/database"
import { updateContact, deleteContact, addNote, editNote, deleteNote } from "../actions"
import { formatSmartDate, formatDateShort } from "@/lib/utils/dates"
import { formatCurrencyCompact } from "@/lib/utils/currency"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { PriorityBadge } from "@/components/shared/status-badges"
import { StatusBadge } from "@/components/shared/status-badges"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"
import { NotesSection } from "@/components/shared/notes-section"
import { ActivityLog } from "@/components/shared/activity-log"

import {
  ArrowLeft,
  Save,
  Trash2,
  Loader2,
  Plus,
  Briefcase,
  CheckSquare,
} from "lucide-react"
import { SOURCE_OPTIONS } from "../types"

interface TagColor {
  id: string
  name: string
  color: string
}

interface ContactDetailPageProps {
  contact: ContactWithRelations
  tagColors: TagColor[]
}

function getTagColor(tagName: string, tagColors: TagColor[]): string | undefined {
  return tagColors.find((t) => t.name.toLowerCase() === tagName.toLowerCase())?.color
}

export function ContactDetailPage({ contact, tagColors }: ContactDetailPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Editable fields
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(contact.first_name ?? "")
  const [lastName, setLastName] = useState(contact.last_name ?? "")
  const [email, setEmail] = useState(contact.email ?? "")
  const [phone, setPhone] = useState(contact.phone ?? "")
  const [company, setCompany] = useState(contact.company ?? "")
  const [source, setSource] = useState(contact.source ?? "")
  const [tags, setTags] = useState(contact.tags?.join(", ") ?? "")
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>(
    contact.consent_status
  )

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)

  const displayName =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    "Unnamed"

  // Filter notes from activities
  const notes = contact.activities.filter((a) => a.type === "note")

  function handleSave() {
    startTransition(async () => {
      const result = await updateContact(contact.id, {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        source: source || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        consent_status: consentStatus,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Contact updated")
        setEditing(false)
      }
    })
  }

  function handleCancelEdit() {
    setFirstName(contact.first_name ?? "")
    setLastName(contact.last_name ?? "")
    setEmail(contact.email ?? "")
    setPhone(contact.phone ?? "")
    setCompany(contact.company ?? "")
    setSource(contact.source ?? "")
    setTags(contact.tags?.join(", ") ?? "")
    setConsentStatus(contact.consent_status)
    setEditing(false)
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteContact(contact.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Contact deleted")
        router.push("/contacts")
      }
    })
  }

  async function handleAddNote(content: string) {
    const result = await addNote(contact.id, content)
    if (result.error) {
      return { error: result.error }
    }
    return {}
  }

  async function handleEditNote(noteId: string, content: string) {
    const result = await editNote(noteId, content)
    if (result.error) return { error: result.error }
    return {}
  }

  async function handleDeleteNote(noteId: string) {
    const result = await deleteNote(noteId)
    if (result.error) return { error: result.error }
    return {}
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.push("/contacts")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
          {contact.company && (
            <p className="text-sm text-muted-foreground">{contact.company}</p>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/pipeline")}
            >
              <Plus className="size-3.5" data-icon="inline-start" />
              Add Deal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/tasks")}
            >
              <Plus className="size-3.5" data-icon="inline-start" />
              Add Task
            </Button>
          </div>

          {/* Notes section */}
          <NotesSection
            notes={notes}
            onAddNote={handleAddNote}
            onEditNote={handleEditNote}
            onDeleteNote={handleDeleteNote}
          />

          {/* Deals card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="size-4" />
                Deals ({contact.deals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.deals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No deals yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {contact.deals.map((deal) => (
                    <DealTile key={deal.id} deal={deal} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasks card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckSquare className="size-4" />
                Tasks ({contact.tasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tasks yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {contact.tasks.map((task) => (
                    <TaskTile key={task.id} task={task} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity log — collapsed by default */}
          <ActivityLog activities={contact.activities} defaultOpen={false} />
        </div>

        {/* Right column (1/3) */}
        <div className="flex flex-col gap-6">
          {/* Contact info card */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">Contact Info</CardTitle>
              {!editing ? (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleCancelEdit}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    onClick={handleSave}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Save className="size-3" data-icon="inline-start" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {editing ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">First Name</Label>
                        <Input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Last Name</Label>
                        <Input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Phone</Label>
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Company</Label>
                      <Input
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Source</Label>
                      <Select value={source} onValueChange={(v) => setSource(v ?? "")}>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {source || "Select source"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCE_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Tags</Label>
                      <Input
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="Comma-separated"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Consent</Label>
                      <Select
                        value={consentStatus}
                        onValueChange={(v) =>
                          setConsentStatus(v as ConsentStatus)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {consentStatus === "explicit"
                              ? "Explicit"
                              : consentStatus === "implied"
                                ? "Implied"
                                : consentStatus === "none"
                                  ? "None"
                                  : "Withdrawn"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="explicit">Explicit</SelectItem>
                          <SelectItem value="implied">Implied</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="withdrawn">Withdrawn</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <InfoRow label="Email" value={contact.email} />
                    <InfoRow label="Phone" value={contact.phone} />
                    <InfoRow label="Company" value={contact.company} />
                    <InfoRow label="Source" value={contact.source} />
                    <InfoRow
                      label="Consent"
                      value={contact.consent_status}
                    />
                    <InfoRow
                      label="Created"
                      value={formatDateShort(contact.created_at)}
                    />
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tags card */}
          {!editing && contact.tags && contact.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {contact.tags.map((tag) => {
                    const color = getTagColor(tag, tagColors)
                    return (
                      <Badge
                        key={tag}
                        variant="secondary"
                        style={color ? {
                          backgroundColor: `${color}20`,
                          color: color,
                          borderColor: `${color}40`,
                        } : undefined}
                      >
                        {color && <span className="size-1.5 rounded-full mr-1 inline-block" style={{ backgroundColor: color }} />}
                        {tag}
                      </Badge>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete button — bottom of page, right-aligned */}
      <div className="flex justify-end pt-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-3.5" data-icon="inline-start" />
          Delete Contact
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Contact"
        description={`Are you sure you want to delete ${displayName}? This action cannot be undone.`}
        onConfirm={handleDelete}
        isPending={isPending}
      />
    </div>
  )
}

// --- Sub-components ---

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right truncate">
        {value || <span className="text-muted-foreground">-</span>}
      </span>
    </div>
  )
}

function DealTile({ deal }: { deal: Deal }) {
  return (
    <Link
      href="/pipeline"
      className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted/50 transition-colors -mx-2"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{deal.title}</p>
        <p className="text-xs text-muted-foreground">
          {deal.stage?.name ?? "No stage"} &middot;{" "}
          {formatCurrencyCompact(deal.value, deal.currency)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <StatusBadge status={deal.status} />
        <PriorityBadge priority={deal.priority} />
      </div>
    </Link>
  )
}

function TaskTile({ task }: { task: Task }) {
  return (
    <Link
      href="/tasks"
      className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted/50 transition-colors -mx-2"
    >
      <div className="min-w-0 flex-1">
        <p className={cn(
          "text-sm font-medium truncate",
          task.status === "completed" && "line-through text-muted-foreground"
        )}>
          {task.title}
        </p>
        {task.due_date && (
          <p className="text-xs text-muted-foreground">
            Due {formatDateShort(task.due_date)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
      </div>
    </Link>
  )
}
