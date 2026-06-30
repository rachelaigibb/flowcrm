"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from "date-fns"
import { Button } from "@/components/ui/button"
import { PRIORITY_COLORS } from "@/lib/constants/colors"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react"
import { CreateTaskDialog } from "@/features/tasks/components/create-task-dialog"
import type { DealPriority } from "@/types/database"

export interface CalendarTask {
  id: string
  title: string
  due_date: string | null
  priority: DealPriority
  status: string
}

export interface CalendarDeal {
  id: string
  title: string
  value: number
  currency: string
  priority: DealPriority
  status: string
  expected_close: string | null
}

interface CalendarViewProps {
  tasks: CalendarTask[]
  deals: CalendarDeal[]
  month: number // 0-indexed
  year: number
  contacts: Array<{ id: string; first_name: string | null; last_name: string | null }>
  dealOptions: Array<{ id: string; title: string }>
}

export function CalendarView({ tasks, deals, month, year, contacts, dealOptions }: CalendarViewProps) {
  const router = useRouter()
  const currentDate = new Date(year, month, 1)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Index tasks and deals by date string (yyyy-MM-dd)
  const tasksByDate: Record<string, CalendarTask[]> = {}
  for (const task of tasks) {
    if (!task.due_date) continue
    const key = task.due_date.slice(0, 10)
    if (!tasksByDate[key]) tasksByDate[key] = []
    tasksByDate[key].push(task)
  }

  const dealsByDate: Record<string, CalendarDeal[]> = {}
  for (const deal of deals) {
    if (!deal.expected_close) continue
    const key = deal.expected_close.slice(0, 10)
    if (!dealsByDate[key]) dealsByDate[key] = []
    dealsByDate[key].push(deal)
  }

  function navigateMonth(direction: "prev" | "next") {
    const target =
      direction === "prev"
        ? subMonths(currentDate, 1)
        : addMonths(currentDate, 1)
    const m = target.getMonth() + 1
    const y = target.getFullYear()
    router.push(`/calendar?month=${m}&year=${y}`)
  }

  function goToToday() {
    const now = new Date()
    const m = now.getMonth() + 1
    const y = now.getFullYear()
    router.push(`/calendar?month=${m}&year=${y}`)
  }

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Tasks and deals by date
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateTaskDialog contacts={contacts} deals={dealOptions}>
            <Button size="sm">
              <Plus className="size-4" />
              Add Task
            </Button>
          </CreateTaskDialog>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navigateMonth("prev")}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {format(currentDate, "MMMM yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navigateMonth("next")}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-blue-400" />
          <span>Task</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-emerald-400" />
          <span>Deal</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/50">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dateKey = format(day, "yyyy-MM-dd")
            const dayTasks = tasksByDate[dateKey] ?? []
            const dayDeals = dealsByDate[dateKey] ?? []
            const inMonth = isSameMonth(day, currentDate)
            const today = isToday(day)
            const hasItems = dayTasks.length > 0 || dayDeals.length > 0

            return (
              <div
                key={dateKey}
                className={cn(
                  "relative min-h-[80px] md:min-h-[100px] border-b border-r border-border p-1.5",
                  // Remove right border on last column
                  (idx + 1) % 7 === 0 && "border-r-0",
                  // Remove bottom border on last row
                  idx >= days.length - 7 && "border-b-0",
                  !inMonth && "bg-muted/30"
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs",
                      today &&
                        "bg-primary text-primary-foreground font-semibold",
                      !today && inMonth && "text-foreground",
                      !today && !inMonth && "text-muted-foreground/50"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {/* Small dot indicators visible on mobile when text is hidden */}
                  {hasItems && (
                    <div className="flex gap-0.5 md:hidden">
                      {dayTasks.length > 0 && (
                        <div className="size-1.5 rounded-full bg-blue-400" />
                      )}
                      {dayDeals.length > 0 && (
                        <div className="size-1.5 rounded-full bg-emerald-400" />
                      )}
                    </div>
                  )}
                </div>

                {/* Item pills - hidden on small screens, shown on md+ */}
                <div className="hidden md:flex flex-col gap-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <Link
                      key={task.id}
                      href="/tasks"
                      className={cn(
                        "group/pill flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight transition-colors",
                        "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                      )}
                    >
                      <div
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          PRIORITY_COLORS[task.priority as DealPriority]?.dot ??
                            "bg-blue-400"
                        )}
                      />
                      <span className="truncate">{task.title}</span>
                    </Link>
                  ))}
                  {dayDeals.slice(0, 3).map((deal) => (
                    <Link
                      key={deal.id}
                      href="/pipeline"
                      className={cn(
                        "group/pill flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight transition-colors",
                        "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      )}
                    >
                      <div
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          PRIORITY_COLORS[deal.priority as DealPriority]?.dot ??
                            "bg-emerald-400"
                        )}
                      />
                      <span className="truncate">{deal.title}</span>
                    </Link>
                  ))}
                  {dayTasks.length + dayDeals.length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1">
                      +{dayTasks.length + dayDeals.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Empty state */}
      {tasks.length === 0 && deals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarDays className="size-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            No tasks or deals scheduled this month
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Tasks with due dates and deals with expected close dates will appear
            here
          </p>
        </div>
      )}
    </div>
  )
}
