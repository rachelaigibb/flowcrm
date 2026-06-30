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
import type { SubAccount, PipelineStage } from "@/types/database"

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
