"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { ContactWithRelations } from "../types"
import type { ConsentStatus, Deal, Task, Activity } from "@/types/database"
import { updateContact, deleteContact, addNote, editNote, deleteNote } from "../actions"
import { formatSmartDate, formatDateShort } from "@/lib/utils/dates"
import { formatCurrencyCompact } from "@/lib/utils/currency"
import { ACTIVITY_TYPE_COLORS, SOURCE_COLORS } from "@/lib/constants/colors"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
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

import { PriorityBadge, StatusBadge } from "@/components/shared/status-badges"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"

import {
  ArrowLeft,
  Save,
  Trash2,
  Loader2,
  Plus,
  Briefcase,
  CheckSquare,
  MessageSquare,
  Mail,
  Phone,
  Send,
  Calendar,
  Settings,
  ArrowRight,
  Pencil,
  X,
  Activity as ActivityIcon,
  Building2,
  Globe,
  Shield,
  Clock,
  Tag,
} from "lucide-react"
import { SOURCE_OPTIONS } from "../types"

// ── Types ──

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

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  note: <MessageSquare className="size-3.5" />,
  email: <Mail className="size-3.5" />,
  sms: <Send className="size-3.5" />,
  call: <Phone className="size-3.5" />,
  meeting: <Calendar className="size-3.5" />,
  status_change: <ArrowRight className="size-3.5" />,
  system: <Settings className="size-3.5" />,
}

// ── Main Component ──

export function ContactDetailPage({ contact, tagColors }: ContactDetailPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Edit state
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(contact.first_name ?? "")
  const [lastName, setLastName] = useState(contact.last_name ?? "")
  const [email, setEmail] = useState(contact.email ?? "")
  const [phone, setPhone] = useState(contact.phone ?? "")
  const [company, setCompany] = useState(contact.company ?? "")
  const [source, setSource] = useState(contact.source ?? "")
  const [tags, setTags] = useState(contact.tags?.join(", ") ?? "")
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>(contact.consent_status)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Note dialog
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [isNotePending, startNoteTransition] = useTransition()

  // Note delete
  const [deleteNoteOpen, setDeleteNoteOpen] = useState(false)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [isNoteDeleting, startNoteDeleteTransition] = useTransition()

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<"profile" | "activity" | "context">("activity")

  const displayName =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unnamed"

  // All activities sorted newest first (already sorted from server)
  const allActivities = contact.activities

  // ── Handlers ──

  function handleSave() {
    startTransition(async () => {
      const result = await updateContact(contact.id, {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        source: source || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
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

  function openAddNote() {
    setEditingNoteId(null)
    setNoteContent("")
    setNoteDialogOpen(true)
  }

  function openEditNote(note: Activity) {
    setEditingNoteId(note.id)
    setNoteContent(note.content ?? "")
    setNoteDialogOpen(true)
  }

  function openDeleteNote(noteId: string) {
    setDeletingNoteId(noteId)
    setDeleteNoteOpen(true)
  }

  function handleSaveNote() {
    if (!noteContent.trim()) return
    startNoteTransition(async () => {
      if (editingNoteId) {
        const result = await editNote(editingNoteId, noteContent.trim())
        if (result.error) { toast.error(result.error) } else {
          toast.success("Note updated")
          setNoteDialogOpen(false)
        }
      } else {
        const result = await addNote(contact.id, noteContent.trim())
        if (result.error) { toast.error(result.error) } else {
          toast.success("Note added")
          setNoteDialogOpen(false)
        }
      }
    })
  }

  function handleDeleteNote() {
    if (!deletingNoteId) return
    startNoteDeleteTransition(async () => {
      const result = await deleteNote(deletingNoteId)
      if (result.error) { toast.error(result.error) } else {
        toast.success("Note deleted")
        setDeleteNoteOpen(false)
        setDeletingNoteId(null)
      }
    })
  }

  // ── Left Panel: Profile ──

  function LeftPanel() {
    return (
      <div className="flex flex-col gap-4">
        {/* Name & Company */}
        <div>
          <h2 className="text-lg font-semibold">{displayName}</h2>
          {contact.company && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-3" />
              {contact.company}
            </p>
          )}
        </div>

        {editing ? (
          <EditProfileForm />
        ) : (
          <ProfileReadView />
        )}

        <Separator />

        {/* Edit / Delete */}
        <div className="flex flex-col gap-2">
          {!editing ? (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
              Edit Contact
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1" onClick={handleCancelEdit} disabled={isPending}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1" onClick={handleSave} disabled={isPending}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete Contact
          </Button>
        </div>
      </div>
    )
  }

  function ProfileReadView() {
    return (
      <div className="flex flex-col gap-3 text-sm">
        {/* Contact details */}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-foreground hover:text-primary transition-colors truncate">
            <Mail className="size-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{contact.email}</span>
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <Phone className="size-3.5 text-muted-foreground shrink-0" />
            {contact.phone}
          </a>
        )}

        <Separator />

        {/* Meta fields */}
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Globe className="size-3" /> Source
            </span>
            {contact.source ? (
              <Badge variant="outline" className={cn("text-xs", SOURCE_COLORS[contact.source.toLowerCase()]?.badge)}>
                {contact.source}
              </Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Shield className="size-3" /> Consent
            </span>
            <span className="capitalize">{contact.consent_status}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3" /> Created
            </span>
            <span>{formatDateShort(contact.created_at)}</span>
          </div>
        </div>

        {/* Tags */}
        {contact.tags && contact.tags.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Tag className="size-3" /> Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((tag) => {
                  const color = getTagColor(tag, tagColors)
                  return (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs"
                      style={color ? { backgroundColor: `${color}20`, color, borderColor: `${color}40` } : undefined}
                    >
                      {color && <span className="size-1.5 rounded-full mr-1 inline-block" style={{ backgroundColor: color }} />}
                      {tag}
                    </Badge>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  function EditProfileForm() {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">First Name</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Last Name</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Phone</Label>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Company</Label>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Source</Label>
          <Select value={source} onValueChange={(v) => setSource(v ?? "")}>
            <SelectTrigger className="h-8 text-sm w-full">
              <SelectValue>{source || "Select"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Consent</Label>
          <Select value={consentStatus} onValueChange={(v) => setConsentStatus(v as ConsentStatus)}>
            <SelectTrigger className="h-8 text-sm w-full">
              <SelectValue>{consentStatus}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="explicit">Explicit</SelectItem>
              <SelectItem value="implied">Implied</SelectItem>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Tags</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Comma-separated" className="h-8 text-sm" />
        </div>
      </div>
    )
  }

  // ── Center Panel: Activity Feed ──

  function CenterPanel() {
    return (
      <div className="flex flex-col gap-4">
        {/* Action bar */}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={openAddNote}>
            <MessageSquare className="size-3.5" />
            Log Note
          </Button>
          {contact.email && (
            <Button variant="outline" size="sm" render={<a href={`mailto:${contact.email}`} />}>
              <Mail className="size-3.5" />
              Email
            </Button>
          )}
          {contact.phone && (
            <Button variant="outline" size="sm" render={<a href={`tel:${contact.phone}`} />}>
              <Phone className="size-3.5" />
              Call
            </Button>
          )}
        </div>

        <Separator />

        {/* Unified timeline */}
        {allActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ActivityIcon className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Log a note to get started</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

            <div className="flex flex-col gap-0">
              {allActivities.map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  isNote={activity.type === "note"}
                  onEditNote={activity.type === "note" ? () => openEditNote(activity) : undefined}
                  onDeleteNote={activity.type === "note" ? () => openDeleteNote(activity.id) : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Right Panel: Deals + Tasks ──

  function RightPanel() {
    return (
      <div className="flex flex-col gap-4">
        {/* Deals */}
        <Card>
          <CardHeader className="flex-row items-center justify-between py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="size-4" />
              Deals ({contact.deals.length})
            </CardTitle>
            <Button variant="ghost" size="icon-xs" onClick={() => router.push("/pipeline")}>
              <Plus className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {contact.deals.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No deals yet</p>
            ) : (
              <div className="flex flex-col gap-1">
                {contact.deals.map((deal) => (
                  <Link
                    key={deal.id}
                    href="/pipeline"
                    className="flex items-center justify-between gap-2 rounded-md p-2 -mx-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{deal.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {deal.stage?.name ?? "No stage"} · {formatCurrencyCompact(deal.value, deal.currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <StatusBadge status={deal.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card>
          <CardHeader className="flex-row items-center justify-between py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckSquare className="size-4" />
              Tasks ({contact.tasks.length})
            </CardTitle>
            <Button variant="ghost" size="icon-xs" onClick={() => router.push("/tasks")}>
              <Plus className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {contact.tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No tasks yet</p>
            ) : (
              <div className="flex flex-col gap-1">
                {contact.tasks.map((task) => (
                  <Link
                    key={task.id}
                    href="/tasks"
                    className="flex items-center justify-between gap-2 rounded-md p-2 -mx-2 hover:bg-muted/50 transition-colors"
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
                    <div className="flex items-center gap-1 shrink-0">
                      <PriorityBadge priority={task.priority} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Render ──

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top bar: back + name */}
      <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon-sm" onClick={() => router.push("/contacts")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight truncate">{displayName}</h1>
        {contact.company && (
          <span className="text-sm text-muted-foreground hidden sm:inline">· {contact.company}</span>
        )}
      </div>

      {/* Mobile tabs (shown below lg breakpoint) */}
      <div className="flex lg:hidden border-b">
        {(["profile", "activity", "context"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={cn(
              "flex-1 py-2 text-sm font-medium border-b-2 transition-colors capitalize",
              mobileTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "context" ? "Deals & Tasks" : tab}
          </button>
        ))}
      </div>

      {/* Three-panel layout (desktop) / Tab content (mobile) */}
      <div className="flex-1 min-h-0">
        {/* Desktop: three columns */}
        <div className="hidden lg:grid lg:grid-cols-[280px_1fr_300px] lg:gap-6 h-full">
          {/* Left panel — fixed scroll */}
          <div className="overflow-y-auto pr-2 border-r border-border/50 pt-1">
            <LeftPanel />
          </div>

          {/* Center panel — scrollable feed */}
          <div className="overflow-y-auto pt-1">
            <CenterPanel />
          </div>

          {/* Right panel — fixed scroll */}
          <div className="overflow-y-auto pl-2 border-l border-border/50 pt-1">
            <RightPanel />
          </div>
        </div>

        {/* Mobile: single panel */}
        <div className="lg:hidden pt-4">
          {mobileTab === "profile" && <LeftPanel />}
          {mobileTab === "activity" && <CenterPanel />}
          {mobileTab === "context" && <RightPanel />}
        </div>
      </div>

      {/* ── Dialogs ── */}

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingNoteId ? "Edit Note" : "Log Note"}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Write a note..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="min-h-24 text-sm"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)} disabled={isNotePending}>
              Cancel
            </Button>
            <Button onClick={handleSaveNote} disabled={!noteContent.trim() || isNotePending}>
              {isNotePending && <Loader2 className="size-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteNoteOpen}
        onOpenChange={setDeleteNoteOpen}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        onConfirm={handleDeleteNote}
        isPending={isNoteDeleting}
      />

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

// ── Sub-components ──

function ActivityRow({
  activity,
  isNote,
  onEditNote,
  onDeleteNote,
}: {
  activity: Activity
  isNote: boolean
  onEditNote?: () => void
  onDeleteNote?: () => void
}) {
  return (
    <div className="group relative flex gap-4 py-3 pl-7">
      {/* Timeline dot */}
      <div
        className={cn(
          "absolute left-1 top-4 flex size-5 items-center justify-center rounded-full border bg-background",
          ACTIVITY_TYPE_COLORS[activity.type as keyof typeof ACTIVITY_TYPE_COLORS] ?? ACTIVITY_TYPE_COLORS.system
        )}
      >
        {ACTIVITY_ICONS[activity.type] ?? <ActivityIcon className="size-3" />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">
            {activity.type.replace("_", " ")}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatSmartDate(activity.created_at)}
          </span>

          {/* Edit/delete for notes */}
          {isNote && (onEditNote || onDeleteNote) && (
            <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              {onEditNote && (
                <Button variant="ghost" size="icon-xs" onClick={onEditNote}>
                  <Pencil className="size-3" />
                </Button>
              )}
              {onDeleteNote && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={onDeleteNote}
                >
                  <Trash2 className="size-3" />
                </Button>
              )}
            </div>
          )}
        </div>
        {activity.content && (
          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {activity.content}
          </p>
        )}
      </div>
    </div>
  )
}
