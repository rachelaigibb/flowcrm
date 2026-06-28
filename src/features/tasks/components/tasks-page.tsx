"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { isToday, isBefore, startOfDay, isThisWeek, format } from "date-fns"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  CalendarIcon,
  MoreHorizontalIcon,
  TrashIcon,
  ListIcon,
  CalendarDaysIcon,
  UserIcon,
  BriefcaseIcon,
} from "lucide-react"
import { toggleTaskStatus, deleteTask } from "../actions"
import { CreateTaskDialog } from "./create-task-dialog"
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

function priorityColor(p: string) {
  switch (p) {
    case "high":
      return "bg-red-500/10 text-red-400 border-red-500/20"
    case "medium":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
    case "low":
      return "bg-green-500/10 text-green-400 border-green-500/20"
    default:
      return ""
  }
}

function dueDateColor(task: TaskWithRelations) {
  if (!task.due_date) return "text-muted-foreground"
  if (isOverdue(task)) return "text-red-400"
  if (isDueToday(task)) return "text-yellow-400"
  return "text-muted-foreground"
}

function TaskItem({
  task,
  onToggle,
  onDelete,
}: {
  task: TaskWithRelations
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const contactName = task.contact
    ? [task.contact.first_name, task.contact.last_name].filter(Boolean).join(" ") || "(Unnamed)"
    : null

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3 transition-colors hover:border-border",
        task.status === "completed" && "opacity-60"
      )}
    >
      <div className="pt-0.5">
        <Checkbox
          checked={task.status === "completed"}
          onCheckedChange={() => onToggle(task.id)}
        />
      </div>

      <div className="flex flex-1 min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate",
              task.status === "completed" && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
          <Badge
            className={cn("shrink-0 border", priorityColor(task.priority))}
            variant="outline"
          >
            {task.priority}
          </Badge>
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
            >
              <UserIcon className="size-3" />
              {contactName}
            </Link>
          )}

          {task.deal && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <BriefcaseIcon className="size-3" />
              {task.deal.title}
            </span>
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
  const [filter, setFilter] = React.useState<FilterTab>("all")
  const [groupMode, setGroupMode] = React.useState<GroupMode>("none")

  const filteredTasks = React.useMemo(() => {
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

  const pendingCount = tasks.filter((t) => t.status === "pending").length
  const completedCount = tasks.filter((t) => t.status === "completed").length
  const overdueCount = tasks.filter((t) => isOverdue(t)).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount} pending{overdueCount > 0 ? `, ${overdueCount} overdue` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={groupMode === "none" ? "ghost" : "secondary"}
            size="icon-sm"
            onClick={() => setGroupMode(groupMode === "none" ? "date" : "none")}
            title="Group by date"
          >
            <CalendarDaysIcon className="size-4" />
          </Button>
          <CreateTaskDialog contacts={contacts} deals={deals} />
        </div>
      </div>

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
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ListIcon className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No tasks found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Create a task to get started
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
                        group === "Overdue" ? "text-red-400" : "text-muted-foreground"
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
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
