"use client"

import { useMemo, useState } from "react"
import {
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  isAfter,
  isBefore,
  subMonths,
  format,
} from "date-fns"
import { toast } from "sonner"
import {
  BarChart3,
  Download,
  TrendingUp,
  Users,
  CheckSquare,
  Filter,
  DollarSign,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { formatCurrencyCompact } from "@/lib/utils/currency"
import { cn } from "@/lib/utils"
import type { Deal, Contact, Task, PipelineStage } from "@/types/database"

type DateRange = "week" | "month" | "quarter" | "year" | "all" | `y:${number}`

const DATE_RANGE_LABELS: Record<Exclude<DateRange, `y:${number}`>, string> = {
  week: "This Week",
  month: "This Month",
  quarter: "This Quarter",
  year: "This Year",
  all: "All Time",
}

function labelFor(range: DateRange): string {
  return range.startsWith("y:") ? range.slice(2) : DATE_RANGE_LABELS[range as keyof typeof DATE_RANGE_LABELS]
}

interface Period { start: Date | null; end: Date }

function getPeriod(range: DateRange): Period {
  const now = new Date()
  if (range.startsWith("y:")) {
    const y = Number(range.slice(2))
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59, 999) }
  }
  switch (range) {
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now }
    case "month":
      return { start: startOfMonth(now), end: now }
    case "quarter":
      return { start: startOfQuarter(now), end: now }
    case "year":
      return { start: startOfYear(now), end: now }
    default:
      return { start: null, end: now }
  }
}

function filterByDateRange<T extends { created_at: string }>(items: T[], range: DateRange): T[] {
  const { start, end } = getPeriod(range)
  return items.filter((item) => {
    const d = new Date(item.created_at)
    return (!start || !isBefore(d, start)) && !isAfter(d, end)
  })
}

interface Bucket { key: string; label: string; short: string; start: Date; end: Date }

function monthBucket(d: Date, end?: Date): Bucket {
  const start = startOfMonth(d)
  return {
    key: format(d, "yyyy-MM"),
    label: format(d, "MMM yyyy"),
    short: format(d, "MMM"),
    start,
    end: end ?? new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999),
  }
}

// Chart buckets follow the selected range: a year shows its 12 months, a quarter its 3,
// "All Time" shows one bar per calendar year, and week/month keep the trailing 6 months.
function getBuckets(range: DateRange, earliest: Date | null): Bucket[] {
  const now = new Date()
  if (range === "all") {
    const firstYear = (earliest ?? now).getFullYear()
    const out: Bucket[] = []
    for (let y = firstYear; y <= now.getFullYear(); y++) {
      out.push({ key: `y${y}`, label: String(y), short: String(y), start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59, 999) })
    }
    return out
  }
  if (range === "year" || range.startsWith("y:")) {
    const y = range === "year" ? now.getFullYear() : Number(range.slice(2))
    return Array.from({ length: 12 }, (_, m) => monthBucket(new Date(y, m, 1)))
  }
  if (range === "quarter") {
    const q = startOfQuarter(now)
    return Array.from({ length: 3 }, (_, i) => monthBucket(new Date(q.getFullYear(), q.getMonth() + i, 1)))
  }
  const out: Bucket[] = []
  for (let i = 5; i >= 0; i--) out.push(monthBucket(subMonths(now, i), i === 0 ? now : undefined))
  return out
}

interface ReportsPageProps {
  deals: Deal[]
  contacts: Pick<Contact, "id" | "source" | "tags" | "created_at">[]
  tasks: Pick<Task, "id" | "status" | "created_at">[]
  stages: PipelineStage[]
  currency: string
}

export function ReportsPage({
  deals,
  contacts,
  tasks,
  stages,
  currency,
}: ReportsPageProps) {
  const [dateRange, setDateRange] = useState<DateRange>("all")

  // Deals count in the period they CLOSED (won/lost), not the period they were created —
  // a deal opened in June and won in September belongs to September.
  const filteredDeals = useMemo(
    () => filterByDateRange(deals.map((d) => ({ ...d, created_at: d.closed_at ?? d.created_at })), dateRange),
    [deals, dateRange]
  )
  const filteredContacts = useMemo(
    () => filterByDateRange(contacts, dateRange),
    [contacts, dateRange]
  )
  const filteredTasks = useMemo(() => filterByDateRange(tasks, dateRange), [tasks, dateRange])

  // Years that actually have data, for the range picker
  const dealDate = (d: Deal) => new Date(d.closed_at ?? d.created_at)
  // Every calendar year from the first record to now — including years with no sales
  const years = useMemo(() => {
    const ys = [...deals.map((d) => dealDate(d).getFullYear()), ...contacts.map((c) => new Date(c.created_at).getFullYear())]
    const now = new Date().getFullYear()
    const first = ys.length ? Math.min(...ys) : now
    return Array.from({ length: now - first + 1 }, (_, i) => now - i)
  }, [deals, contacts])
  const earliest = useMemo(() => {
    const ts = [...deals.map((d) => dealDate(d).getTime()), ...contacts.map((c) => new Date(c.created_at).getTime())]
    return ts.length ? new Date(Math.min(...ts)) : null
  }, [deals, contacts])
  const months = useMemo(() => getBuckets(dateRange, earliest), [dateRange, earliest])
  const bucketUnit = dateRange === "all" ? "year" : "month"

  // ---------------------------------------------------------------
  // Pipeline Funnel
  // ---------------------------------------------------------------
  const pipelineFunnel = useMemo(() => {
    const openDeals = filteredDeals.filter((d) => d.status === "open")
    return stages.map((stage) => {
      const stageDeals = openDeals.filter((d) => d.stage_id === stage.id)
      return {
        stage,
        count: stageDeals.length,
        value: stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0),
      }
    })
  }, [filteredDeals, stages])

  const maxFunnelCount = Math.max(...pipelineFunnel.map((s) => s.count), 1)

  // ---------------------------------------------------------------
  // Revenue Over Time (won deals by month)
  // ---------------------------------------------------------------
  const revenueByMonth = useMemo(() => {
    const wonDeals = deals.filter((d) => d.status === "won")
    return months.map((m) => {
      const monthDeals = wonDeals.filter((d) => {
        const date = dealDate(d)
        return date >= m.start && date <= m.end
      })
      return {
        ...m,
        value: monthDeals.reduce((sum, d) => sum + (d.value ?? 0), 0),
        commission: monthDeals.reduce((sum, d) => sum + (Number(d.commission) || 0), 0),
        count: monthDeals.length,
      }
    })
  }, [deals, months])

  const maxRevenue = Math.max(...revenueByMonth.map((m) => m.value), 1)
  const maxCommission = Math.max(...revenueByMonth.map((m) => m.commission), 1)
  // Totals for the selected range (won deals only)
  const rangeTotals = useMemo(() => {
    const won = filteredDeals.filter((d) => d.status === "won")
    return {
      sales: won.reduce((s, d) => s + (d.value ?? 0), 0),
      commission: won.reduce((s, d) => s + (Number(d.commission) || 0), 0),
      count: won.length,
    }
  }, [filteredDeals])

  // ---------------------------------------------------------------
  // Conversion Rate
  // ---------------------------------------------------------------
  const conversionData = useMemo(() => {
    const won = filteredDeals.filter((d) => d.status === "won").length
    const lost = filteredDeals.filter((d) => d.status === "lost").length
    const open = filteredDeals.filter((d) => d.status === "open").length
    const total = won + lost + open
    return {
      won,
      lost,
      open,
      total,
      wonPct: total > 0 ? Math.round((won / total) * 100) : 0,
      lostPct: total > 0 ? Math.round((lost / total) * 100) : 0,
      openPct: total > 0 ? Math.round((open / total) * 100) : 0,
    }
  }, [filteredDeals])

  // ---------------------------------------------------------------
  // Contact Growth (same buckets as the range)
  // ---------------------------------------------------------------
  const contactGrowth = useMemo(() => {
    return months.map((m) => {
      const count = contacts.filter((c) => {
        const date = new Date(c.created_at)
        return date >= m.start && date <= m.end
      }).length
      return { ...m, count }
    })
  }, [contacts, months])

  const maxContactCount = Math.max(...contactGrowth.map((m) => m.count), 1)

  // ---------------------------------------------------------------
  // Top Sources
  // ---------------------------------------------------------------
  const topSources = useMemo(() => {
    const sourceMap: Record<string, number> = {}
    filteredContacts.forEach((c) => {
      const source = c.source ?? "Unknown"
      sourceMap[source] = (sourceMap[source] ?? 0) + 1
    })
    return Object.entries(sourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredContacts])

  const maxSourceCount = Math.max(...topSources.map((s) => s.count), 1)

  // ---------------------------------------------------------------
  // Task Completion
  // ---------------------------------------------------------------
  const taskData = useMemo(() => {
    const completed = filteredTasks.filter((t) => t.status === "completed").length
    const pending = filteredTasks.filter((t) => t.status === "pending").length
    const cancelled = filteredTasks.filter((t) => t.status === "cancelled").length
    const total = completed + pending + cancelled
    return {
      completed,
      pending,
      cancelled,
      total,
      completedPct: total > 0 ? Math.round((completed / total) * 100) : 0,
      pendingPct: total > 0 ? Math.round((pending / total) * 100) : 0,
      cancelledPct: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    }
  }, [filteredTasks])

  // ---------------------------------------------------------------
  // CSV Export
  // ---------------------------------------------------------------
  function exportCSV() {
    const rows: string[][] = [
      ["Report", "Metric", "Value"],
      [],
      ["Pipeline Funnel"],
      ["Stage", "Deals", "Value"],
      ...pipelineFunnel.map((s) => [
        s.stage.name,
        String(s.count),
        formatCurrencyCompact(s.value, currency),
      ]),
      [],
      ["Sales Over Time"],
      ["Period", "Deals Won", "Sales", "Commission"],
      ...revenueByMonth.map((m) => [
        m.label,
        String(m.count),
        formatCurrencyCompact(m.value, currency),
        formatCurrencyCompact(m.commission, currency),
      ]),
      ["Total", String(rangeTotals.count), formatCurrencyCompact(rangeTotals.sales, currency), formatCurrencyCompact(rangeTotals.commission, currency)],
      [],
      ["Conversion Rate"],
      ["Status", "Count", "Percentage"],
      ["Won", String(conversionData.won), `${conversionData.wonPct}%`],
      ["Lost", String(conversionData.lost), `${conversionData.lostPct}%`],
      ["Open", String(conversionData.open), `${conversionData.openPct}%`],
      [],
      ["Contact Growth"],
      ["Period", "New Contacts"],
      ...contactGrowth.map((m) => [m.label, String(m.count)]),
      [],
      ["Top Sources"],
      ["Source", "Count"],
      ...topSources.map((s) => [s.source, String(s.count)]),
      [],
      ["Task Completion"],
      ["Status", "Count", "Percentage"],
      ["Completed", String(taskData.completed), `${taskData.completedPct}%`],
      ["Pending", String(taskData.pending), `${taskData.pendingPct}%`],
      ["Cancelled", String(taskData.cancelled), `${taskData.cancelledPct}%`],
    ]

    const csvContent = rows
      .map((row) => row.map((cell) => `"${(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `flowcrm-reports-${format(new Date(), "yyyy-MM-dd")}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Report exported as CSV")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overview of your pipeline, contacts, and activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={dateRange}
            onValueChange={(val: string | null) => {
              if (val) setDateRange(val as DateRange)
            }}
          >
            <SelectTrigger className="w-[160px]">
              <Filter className="size-3.5 text-muted-foreground" />
              <SelectValue>{labelFor(dateRange)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(DATE_RANGE_LABELS) as [DateRange, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
              {years.length > 0 && <Separator className="my-1" />}
              {years.map((y) => (
                <SelectItem key={y} value={`y:${y}`}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      <Separator />

      {/* Report cards grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. Pipeline Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="size-4 text-muted-foreground" />
              Pipeline Funnel
            </CardTitle>
            <CardDescription>Deal count and value per stage</CardDescription>
          </CardHeader>
          <CardContent>
            {pipelineFunnel.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pipeline stages configured
              </p>
            ) : (
              <div className="space-y-3">
                {pipelineFunnel.map((item) => (
                  <div key={item.stage.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.stage.color }}
                        />
                        <span className="truncate">{item.stage.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{item.count} deals</span>
                        <span className="text-xs">
                          {formatCurrencyCompact(item.value, currency)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max((item.count / maxFunnelCount) * 100, item.count > 0 ? 4 : 0)}%`,
                          backgroundColor: item.stage.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Revenue Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="size-4 text-muted-foreground" />
              Sales Over Time
            </CardTitle>
            <CardDescription>
              Sold value by {bucketUnit} · {labelFor(dateRange)} · total {formatCurrencyCompact(rangeTotals.sales, currency)} across {rangeTotals.count} deal{rangeTotals.count !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {revenueByMonth.map((m) => {
                const heightPct = maxRevenue > 0 ? (m.value / maxRevenue) * 100 : 0
                return (
                  <div
                    key={m.key}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-[10px] text-muted-foreground">
                      {m.value > 0 ? formatCurrencyCompact(m.value, currency) : ""}
                    </span>
                    <div className="w-full flex items-end" style={{ height: "120px" }}>
                      <div
                        className={cn(
                          "w-full rounded-t transition-all duration-500",
                          m.value > 0 ? "bg-primary" : "bg-muted"
                        )}
                        style={{
                          height: `${Math.max(heightPct, m.value > 0 ? 4 : 2)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {m.short}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* 2b. Commission Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="size-4 text-muted-foreground" />
              Commission Over Time
            </CardTitle>
            <CardDescription>
              Your commission by {bucketUnit} · {labelFor(dateRange)} · total {formatCurrencyCompact(rangeTotals.commission, currency)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {revenueByMonth.map((m) => {
                const heightPct = maxCommission > 0 ? (m.commission / maxCommission) * 100 : 0
                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {m.commission > 0 ? formatCurrencyCompact(m.commission, currency) : ""}
                    </span>
                    <div className="w-full flex items-end" style={{ height: "120px" }}>
                      <div
                        className={cn("w-full rounded-t transition-all duration-500", m.commission > 0 ? "bg-primary" : "bg-muted")}
                        style={{ height: `${Math.max(heightPct, m.commission > 0 ? 4 : 2)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{m.short}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* 3. Conversion Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="size-4 text-muted-foreground" />
              Conversion Rate
            </CardTitle>
            <CardDescription>
              Won / Lost / Open deal distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conversionData.total === 0 ? (
              <p className="text-sm text-muted-foreground">No deals in this period</p>
            ) : (
              <div className="space-y-4">
                {/* Stacked bar */}
                <div className="h-6 rounded-full overflow-hidden flex bg-muted">
                  {conversionData.wonPct > 0 && (
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${conversionData.wonPct}%` }}
                    />
                  )}
                  {conversionData.lostPct > 0 && (
                    <div
                      className="h-full bg-red-500 transition-all duration-500"
                      style={{ width: `${conversionData.lostPct}%` }}
                    />
                  )}
                  {conversionData.openPct > 0 && (
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${conversionData.openPct}%` }}
                    />
                  )}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 rounded-full bg-green-500" />
                    <span>Won {conversionData.wonPct}%</span>
                    <Badge variant="secondary" className="text-xs">
                      {conversionData.won}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 rounded-full bg-red-500" />
                    <span>Lost {conversionData.lostPct}%</span>
                    <Badge variant="secondary" className="text-xs">
                      {conversionData.lost}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 rounded-full bg-blue-500" />
                    <span>Open {conversionData.openPct}%</span>
                    <Badge variant="secondary" className="text-xs">
                      {conversionData.open}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Contact Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-muted-foreground" />
              Contact Growth
            </CardTitle>
            <CardDescription>New contacts per {bucketUnit} · {labelFor(dateRange)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {contactGrowth.map((m) => {
                const heightPct =
                  maxContactCount > 0 ? (m.count / maxContactCount) * 100 : 0
                return (
                  <div
                    key={m.key}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-[10px] text-muted-foreground">
                      {m.count > 0 ? m.count : ""}
                    </span>
                    <div className="w-full flex items-end" style={{ height: "120px" }}>
                      <div
                        className={cn(
                          "w-full rounded-t transition-all duration-500",
                          m.count > 0 ? "bg-primary" : "bg-muted"
                        )}
                        style={{
                          height: `${Math.max(heightPct, m.count > 0 ? 4 : 2)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {m.short}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* 5. Top Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Filter className="size-4 text-muted-foreground" />
              Top Sources
            </CardTitle>
            <CardDescription>Contact source distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {topSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No contacts with sources in this period
              </p>
            ) : (
              <div className="space-y-3">
                {topSources.map((item) => (
                  <div key={item.source} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{item.source}</span>
                      <span className="text-muted-foreground">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{
                          width: `${Math.max((item.count / maxSourceCount) * 100, 4)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6. Task Completion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckSquare className="size-4 text-muted-foreground" />
              Task Completion
            </CardTitle>
            <CardDescription>
              Completed vs pending vs cancelled
            </CardDescription>
          </CardHeader>
          <CardContent>
            {taskData.total === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks in this period</p>
            ) : (
              <div className="space-y-4">
                {/* Stacked bar */}
                <div className="h-6 rounded-full overflow-hidden flex bg-muted">
                  {taskData.completedPct > 0 && (
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${taskData.completedPct}%` }}
                    />
                  )}
                  {taskData.pendingPct > 0 && (
                    <div
                      className="h-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${taskData.pendingPct}%` }}
                    />
                  )}
                  {taskData.cancelledPct > 0 && (
                    <div
                      className="h-full bg-zinc-400 transition-all duration-500"
                      style={{ width: `${taskData.cancelledPct}%` }}
                    />
                  )}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 rounded-full bg-green-500" />
                    <span>Completed {taskData.completedPct}%</span>
                    <Badge variant="secondary" className="text-xs">
                      {taskData.completed}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 rounded-full bg-amber-500" />
                    <span>Pending {taskData.pendingPct}%</span>
                    <Badge variant="secondary" className="text-xs">
                      {taskData.pending}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 rounded-full bg-zinc-400" />
                    <span>Cancelled {taskData.cancelledPct}%</span>
                    <Badge variant="secondary" className="text-xs">
                      {taskData.cancelled}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
