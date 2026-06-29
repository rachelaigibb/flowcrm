"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ContactWithRelations } from "../types"
import type { Activity, Deal, Task, ConsentStatus } from "@/types/database"
import { updateContact, deleteContact, addNote } from "../actions"
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
import { Textarea } from "@/components/ui/textarea"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Save,
  Trash2,
  Send,
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  Activity as ActivityIcon,
  Settings,
  Loader2,
  CheckCircle2,
  Circle,
  ChevronDown,
} from "lucide-react"
import { SOURCE_OPTIONS } from "../types"

interface ContactDetailPageProps {
  contact: ContactWithRelations
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  note: <MessageSquare className="size-3.5" />,
  email: <Mail className="size-3.5" />,
  sms: <Send className="size-3.5" />,
  call: <Phone className="size-3.5" />,
  meeting: <Calendar className="size-3.5" />,
  system: <Settings className="size-3.5" />,
  status_change: <ActivityIcon className="size-3.5" />,
}

export function ContactDetailPage({ contact }: ContactDetailPageProps) {
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

  // Note form
  const [noteContent, setNoteContent] = useState("")
  const [notePending, setNotePending] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Activity collapsible
  const [activityOpen, setActivityOpen] = useState(false)

  const displayName =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    "Unnamed"

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

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteContent.trim()) return

    setNotePending(true)
    const result = await addNote(contact.id, noteContent)
    setNotePending(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Note added")
      setNoteContent("")
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.push("/contacts")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{displayName}</h1>
          {contact.company && (
            <p className="text-sm text-muted-foreground">{contact.company}</p>
          )}
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-3.5" data-icon="inline-start" />
          Delete
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Deals, Tasks, Notes, Activity */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Related Deals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Deals ({contact.deals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.deals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No deals yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {contact.deals.map((deal) => (
                    <DealItem key={deal.id} deal={deal} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Tasks ({contact.tasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tasks yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {contact.tasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add note form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Note</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddNote} className="flex flex-col gap-3">
                <Textarea
                  placeholder="Write a note about this contact..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="min-h-20"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!noteContent.trim() || notePending}
                  >
                    {notePending && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    Add Note
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Activity timeline — collapsible, collapsed by default */}
          <Card>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => setActivityOpen(!activityOpen)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Activity ({contact.activities.length})
                </CardTitle>
                <Button variant="ghost" size="icon-sm">
                  <ChevronDown className={cn(
                    "size-4 transition-transform",
                    activityOpen && "rotate-180"
                  )} />
                </Button>
              </div>
            </CardHeader>
            {activityOpen && (
              <CardContent>
                {contact.activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No activity yet.
                  </p>
                ) : (
                  <div className="flex flex-col">
                    {contact.activities.map((activity, i) => (
                      <ActivityItem
                        key={activity.id}
                        activity={activity}
                        isLast={i === contact.activities.length - 1}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right: Contact info + tags */}
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
                          <SelectValue placeholder="Select source" />
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
                          <SelectValue />
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

          {/* Tags */}
          {!editing && contact.tags && contact.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {displayName}? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function ActivityItem({
  activity,
  isLast,
}: {
  activity: Activity
  isLast: boolean
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-full border",
            activity.type === "note"
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted text-muted-foreground border-border"
          )}
        >
          {ACTIVITY_ICONS[activity.type] ?? (
            <ActivityIcon className="size-3.5" />
          )}
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-border my-1" />
        )}
      </div>
      <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium capitalize">
            {activity.type.replace("_", " ")}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatSmartDate(activity.created_at)}
          </span>
        </div>
        {activity.content && (
          <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
            {activity.content}
          </p>
        )}
      </div>
    </div>
  )
}

function DealItem({ deal }: { deal: Deal }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.push(`/pipeline`)}
      className="flex items-center justify-between gap-2 rounded-md p-2 text-left hover:bg-muted/50 transition-colors -mx-2"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{deal.title}</p>
        <p className="text-xs text-muted-foreground">
          {deal.stage?.name ?? "No stage"} &middot;{" "}
          {formatCurrencyCompact(deal.value, deal.currency)}
        </p>
      </div>
      <Badge
        variant={
          deal.status === "won"
            ? "default"
            : deal.status === "lost"
              ? "destructive"
              : "secondary"
        }
        className="text-xs shrink-0"
      >
        {deal.status}
      </Badge>
    </button>
  )
}

function TaskItem({ task }: { task: Task }) {
  const isComplete = task.status === "completed"
  return (
    <div className="flex items-start gap-2 rounded-md p-2 -mx-2">
      <div className="mt-0.5">
        {isComplete ? (
          <CheckCircle2 className="size-4 text-primary" />
        ) : (
          <Circle className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            isComplete && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </p>
        {task.due_date && (
          <p className="text-xs text-muted-foreground">
            Due {formatDateShort(task.due_date)}
          </p>
        )}
      </div>
      <Badge
        variant={
          task.priority === "high"
            ? "destructive"
            : task.priority === "medium"
              ? "secondary"
              : "outline"
        }
        className="text-xs shrink-0"
      >
        {task.priority}
      </Badge>
    </div>
  )
}
