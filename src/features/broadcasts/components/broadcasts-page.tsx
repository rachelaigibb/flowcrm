"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Broadcast, BroadcastChannel, BroadcastStatus, BroadcastStats } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"
import { formatDateShort } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import { createBroadcast, deleteBroadcast } from "@/features/broadcasts/actions"
import { toast } from "sonner"
import {
  Plus,
  Mail,
  MessageSquare,
  Pencil,
  Trash2,
  Loader2,
  Radio,
} from "lucide-react"

const STATUS_BADGE_COLORS: Record<BroadcastStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  sending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  sent: "bg-green-500/10 text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
}

interface BroadcastsPageProps {
  broadcasts: Broadcast[]
}

export function BroadcastsPage({ broadcasts }: BroadcastsPageProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [channel, setChannel] = useState<BroadcastChannel>("email")
  const [deleteTarget, setDeleteTarget] = useState<Broadcast | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Please enter a broadcast name")
      return
    }
    setCreating(true)
    try {
      const result = await createBroadcast({ name: name.trim(), channel })
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.data) {
        toast.success("Broadcast created")
        setCreateOpen(false)
        setName("")
        setChannel("email")
        router.push(`/broadcasts/${result.data.id}`)
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await deleteBroadcast(deleteTarget.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Broadcast deleted")
      setDeleteTarget(null)
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  function canDelete(status: BroadcastStatus): boolean {
    return status === "draft" || status === "failed"
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Broadcasts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {broadcasts.length} broadcast{broadcasts.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" data-icon="inline-start" />
          Create Broadcast
        </Button>
      </div>

      {/* List */}
      {broadcasts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Radio className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No broadcasts yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create your first broadcast campaign.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" data-icon="inline-start" />
            Create Broadcast
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Recipients</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.map((broadcast) => {
                const stats = broadcast.stats as BroadcastStats
                return (
                  <TableRow key={broadcast.id}>
                    <TableCell className="font-medium">
                      {broadcast.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {broadcast.channel === "email" ? (
                          <Mail className="size-3" />
                        ) : (
                          <MessageSquare className="size-3" />
                        )}
                        {broadcast.channel === "email" ? "Email" : "SMS"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border capitalize",
                          STATUS_BADGE_COLORS[broadcast.status]
                        )}
                      >
                        {broadcast.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {stats.sent}/{stats.total}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {formatDateShort(broadcast.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => router.push(`/broadcasts/${broadcast.id}`)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        {canDelete(broadcast.status) && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleteTarget(broadcast)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Broadcast</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="broadcast-name">Name</Label>
              <Input
                id="broadcast-name"
                placeholder="e.g. June Newsletter"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Channel</Label>
              <Select
                value={channel}
                onValueChange={(val: string | null) => {
                  if (val) setChannel(val as BroadcastChannel)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <span className="flex items-center gap-1.5">
                      {channel === "email" ? (
                        <Mail className="size-3" />
                      ) : (
                        <MessageSquare className="size-3" />
                      )}
                      {channel === "email" ? "Email" : "SMS"}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <Mail className="size-3" />
                    Email
                  </SelectItem>
                  <SelectItem value="sms">
                    <MessageSquare className="size-3" />
                    SMS
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="size-3.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete Broadcast"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        isPending={deleting}
      />
    </div>
  )
}
