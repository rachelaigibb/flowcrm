"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { isToday, isBefore, startOfDay, isThisWeek, format } from "date-fns"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { PRIORITY_COLORS } from "@/lib/constants/colors"
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badges"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"
import type { PriorityKey } from "@/lib/constants/colors"
import {
  CalendarIcon,
  MoreHorizontalIcon,
  TrashIcon,
  ListIcon,
  CalendarDaysIcon,
  UserIcon,
  BriefcaseIcon,
  SearchIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  Trash2,
  XIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toggleTaskStatus, deleteTask, bulkDeleteTasks } from "../actions"
import { CreateTaskDialog } from "./create-task-dialog"
import { TaskDetailSheet } from "./task-detail-sheet"
import type { TaskWithRelations } from "../types"


interface ContactOption {
  id: string
  first_name: string | null
  last_name: string | null
}

interface DealOption {
  id: string
  title: string
}

interface TasksPageProps {
  tasks: TaskWithRelations[]
  contacts: ContactOption[]
  deals: DealOption[]
}

type FilterTab = "all" | "pending" | "completed" | "overdue"
type GroupMode = "none" | "date"
type SortField = "due_date" | "priority" | "created_at"
type SortDir = "asc" | "desc"

function isOverdue(task: TaskWithRelations): boolean {
  if (task.status !== "pending") return false
  if (!task.due_date) return false
  return isBefore(new Date(task.due_date), startOfDay(new Date()))
}

function isDueToday(task: TaskWithRelations): boolean {
  if (!task.due_date) return false
  return isToday(new Date(task.due_date))
}

function isDueThisWeek(task: TaskWithRelations): boolean {
  if (!task.due_date) return false
  const d = new Date(task.due_date)
  return isThisWeek(d, { weekStartsOn: 1 }) && !isToday(d) && !isBefore(d, startOfDay(new Date()))
}

function getDateGroup(task: TaskWithRelations): string {
  if (!task.due_date) return "No Date"
  if (isOverdue(task)) return "Overdue"
  if (isDueToday(task)) return "Today"
  if (isDueThisWeek(task)) return "This Week"
  return "Later"
}

const groupOrder = ["Overdue", "Today", "This Week", "Later", "No Date"]

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

function dueDateColor(task: TaskWithRelations) {
  if (!task.due_date) return "text-muted-foreground"
  if (isOverdue(task)) return PRIORITY_COLORS.high.text
  if (isDueToday(task)) return PRIORITY_COLORS.medium.text
  return "text-muted-foreground"
}

function TaskItem({
  task,
  onToggle,
  onDelete,
  onClick,
  selected,
  onSelectChange,
}: {
  task: TaskWithRelations
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onClick: (task: TaskWithRelations) => void
  selected: boolean
  onSelectChange: (checked: boolean) => void
}) {
  const contactName = task.contact
    ? [task.contact.first_name, task.contact.last_name].filter(Boolean).join(" ") || "(Unnamed)"
    : null

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3 transition-colors hover:border-border",
        task.status === "completed" && "opacity-60",
        selected && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="pt-0.5 flex items-center gap-2">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectChange(checked === true)}
          onClick={(e) => e.stopPropagation()}
        />
        <Checkbox
          checked={task.status === "completed"}
          onCheckedChange={() => onToggle(task.id)}
        />
      </div>

      <div
        className="flex flex-1 min-w-0 flex-col gap-1 cursor-pointer"
        onClick={() => onClick(task)}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate",
              task.status === "completed" && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
          <PriorityBadge priority={task.priority} className="shrink-0" />
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs">
          {task.due_date && (
            <span className={cn("flex items-center gap-1", dueDateColor(task))}>
              <CalendarIcon className="size-3" />
              {format(new Date(task.due_date), "MMM d, yyyy")}
            </span>
          )}

          {contactName && (
            <Link
              href={`/contacts/${task.contact!.id}`}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <UserIcon className="size-3" />
              {contactName}
            </Link>
          )}

          {task.deal && (
            <Link
              href="/pipeline"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <BriefcaseIcon className="size-3" />
              {task.deal.title}
            </Link>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => onDelete(task.id)}
          >
            <TrashIcon className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function TasksPage({ tasks, contacts, deals }: TasksPageProps) {
  const router = useRouter()
  const [filter, setFilter] = React.useState<FilterTab>("all")
  const [groupMode, setGroupMode] = React.useState<GroupMode>("none")
  const [selectedTask, setSelectedTask] = React.useState<TaskWithRelations | null>(null)
  const [detailSheetOpen, setDetailSheetOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [sortField, setSortField] = React.useState<SortField>("due_date")
  const [sortDir, setSortDir] = React.useState<SortDir>("asc")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = React.useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false)

  function handleTaskClick(task: TaskWithRelations) {
    setSelectedTask(task)
    setDetailSheetOpen(true)
  }

  function handleTaskUpdated() {
    router.refresh()
    setDetailSheetOpen(false)
  }

  // Filter by tab
  const tabFiltered = React.useMemo(() => {
    switch (filter) {
      case "pending":
        return tasks.filter((t) => t.status === "pending")
      case "completed":
        return tasks.filter((t) => t.status === "completed")
      case "overdue":
        return tasks.filter((t) => isOverdue(t))
      default:
        return tasks
    }
  }, [tasks, filter])

  // Search filter
  const searched = React.useMemo(() => {
    if (!search.trim()) return tabFiltered
    const q = search.toLowerCase()
    return tabFiltered.filter((t) => {
      const title = t.title.toLowerCase()
      const desc = (t.description ?? "").toLowerCase()
      return title.includes(q) || desc.includes(q)
    })
  }, [tabFiltered, search])

  // Sort
  const sorted = React.useMemo(() => {
    const items = [...searched]
    const dir = sortDir === "asc" ? 1 : -1

    items.sort((a, b) => {
      switch (sortField) {
        case "due_date": {
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return (new Date(a.due_date).getTime() - new Date(b.due_date).getTime()) * dir
        }
        case "priority": {
          const pa = PRIORITY_ORDER[a.priority] ?? 1
          const pb = PRIORITY_ORDER[b.priority] ?? 1
          return (pa - pb) * dir
        }
        case "created_at": {
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
        }
        default:
          return 0
      }
    })

    return items
  }, [searched, sortField, sortDir])

  // Final list for rendering
  const filteredTasks = sorted

  const grouped = React.useMemo(() => {
    if (groupMode === "none") return null
    const groups: Record<string, TaskWithRelations[]> = {}
    for (const task of filteredTasks) {
      const group = getDateGroup(task)
      if (!groups[group]) groups[group] = []
      groups[group].push(task)
    }
    return groups
  }, [filteredTasks, groupMode])

  async function handleToggle(id: string) {
    const result = await toggleTaskStatus(id)
    if (result.error) {
      toast.error(result.error)
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteTask(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Task deleted")
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    setIsBulkDeleting(true)
    const result = await bulkDeleteTasks(Array.from(selectedIds))
    setIsBulkDeleting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${selectedIds.size} task${selectedIds.size > 1 ? "s" : ""} deleted`)
      setSelectedIds(new Set())
      setShowBulkDeleteConfirm(false)
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredTasks.map((t) => t.id)))
    }
  }

  function handleSelectChange(taskId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(taskId)
      } else {
        next.delete(taskId)
      }
      return next
    })
  }

  const pendingCount = tasks.filter((t) => t.status === "pending").length
  const completedCount = tasks.filter((t) => t.status === "completed").length
  const overdueCount = tasks.filter((t) => isOverdue(t)).length

  const SORT_LABELS: Record<SortField, string> = {
    due_date: "Due Date",
    priority: "Priority",
    created_at: "Created",
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount} pending{overdueCount > 0 ? `, ${overdueCount} overdue` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 w-[200px]"
            />
          </div>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <ArrowUpDownIcon className="size-4" />
                  {SORT_LABELS[sortField]}
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSortField("due_date")}>
                Due Date {sortField === "due_date" && "•"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSortField("priority")}>
                Priority {sortField === "priority" && "•"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSortField("created_at")}>
                Created {sortField === "created_at" && "•"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}>
                {sortDir === "asc" ? (
                  <>
                    <ArrowUpIcon className="size-4" /> Ascending
                  </>
                ) : (
                  <>
                    <ArrowDownIcon className="size-4" /> Descending
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={groupMode === "none" ? "outline" : "secondary"}
            size="sm"
            onClick={() => setGroupMode(groupMode === "none" ? "date" : "none")}
          >
            <CalendarDaysIcon className="size-4" />
            {groupMode === "none" ? "Group by date" : "Ungroup"}
          </Button>
          <CreateTaskDialog contacts={contacts} deals={deals} />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Checkbox
            checked={selectedIds.size === filteredTasks.length}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowBulkDeleteConfirm(true)}
          >
            <Trash2 className="size-3.5" />
            Delete Selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            <XIcon className="size-3.5" />
            Clear
          </Button>
        </div>
      )}

      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
        <TabsList variant="line">
          <TabsTrigger value="all">
            All ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedCount})
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue ({overdueCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {/* Select all toggle when there are tasks */}
          {filteredTasks.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <Checkbox
                checked={selectedIds.size === filteredTasks.length && filteredTasks.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground">
                Select all ({filteredTasks.length})
              </span>
            </div>
          )}

          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ListIcon className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search.trim() ? "No tasks match your search" : "No tasks found"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {search.trim() ? "Try a different search term" : "Create a task to get started"}
              </p>
            </div>
          ) : grouped ? (
            <div className="flex flex-col gap-6">
              {groupOrder
                .filter((g) => grouped[g]?.length)
                .map((group) => (
                  <div key={group} className="flex flex-col gap-2">
                    <h3
                      className={cn(
                        "text-xs font-medium uppercase tracking-wider",
                        group === "Overdue" ? PRIORITY_COLORS.high.text : "text-muted-foreground"
                      )}
                    >
                      {group} ({grouped[group].length})
                    </h3>
                    <div className="flex flex-col gap-2">
                      {grouped[group].map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                          onClick={handleTaskClick}
                          selected={selectedIds.has(task.id)}
                          onSelectChange={(checked) => handleSelectChange(task.id, checked)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onClick={handleTaskClick}
                  selected={selectedIds.has(task.id)}
                  onSelectChange={(checked) => handleSelectChange(task.id, checked)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TaskDetailSheet
        task={selectedTask}
        contacts={contacts}
        deals={deals}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onTaskUpdated={handleTaskUpdated}
      />

      <DeleteConfirmDialog
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        title="Delete Selected Tasks"
        description={`Are you sure you want to delete ${selectedIds.size} task${selectedIds.size > 1 ? "s" : ""}? This action cannot be undone.`}
        onConfirm={handleBulkDelete}
        isPending={isBulkDeleting}
      />
    </div>
  )
}
