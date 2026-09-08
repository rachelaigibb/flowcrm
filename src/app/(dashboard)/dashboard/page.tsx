import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getSubAccountId } from "@/lib/supabase/get-sub-account"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/currency"
import { CollapsibleActivityList } from "@/components/shared/collapsible-activity-list"
import {
  Users,
  DollarSign,
  Trophy,
  AlertTriangle,
  ActivityIcon,
  ArrowRight,
  CalendarDays,
  CheckSquare,
  Mail,
  Phone,
  TrendingUp,
} from "lucide-react"
import type { Activity, PipelineStage, SubAccount } from "@/types/database"
import { DashboardRangeSelect } from "@/features/dashboard/components/dashboard-range-select"
import { getPeriod, labelFor, parseDateRange, yearsFrom, type DateRange } from "@/lib/utils/date-range"

export const metadata = {
  title: "Dashboard | FlowCRM",
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const subAccountId = await getSubAccountId()

  if (!subAccountId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">
          No sub-account selected. Create one in Settings to get started.
        </p>
      </div>
    )
  }

  // Fetch sub-account details and user info
  const [subAccountResult, userResult] = await Promise.all([
    supabase
      .from("sub_accounts")
      .select("*")
      .eq("id", subAccountId)
      .single(),
    supabase.auth.getUser(),
  ])

  const subAccount = subAccountResult.data as SubAccount | null
  const currency = subAccount?.currency ?? "USD"
  const user = userResult.data.user

  // Get account contact from sub-account settings
  const settings = (subAccount?.settings as Record<string, unknown> | null) ?? {}
  const accountContact = settings.account_contact as
    | { name?: string; email?: string; phone?: string }
    | undefined

  // Period for the tiles: URL param wins, then the saved workspace choice, then this month
  const savedRange = typeof settings.dashboard_range === "string" ? settings.dashboard_range : undefined
  const range: DateRange = parseDateRange(sp.range, parseDateRange(savedRange, "month"))
  const period = getPeriod(range)
  const startISO = period.start?.toISOString()
  const endISO = period.end.toISOString()

  // Parallel fetches for dashboard stats
  // Period-scoped: won deals (by close date), new contacts, activities. All-time: open deals, pipeline value, tasks.
  let wonQuery = supabase
    .from("deals")
    .select("value, commission")
    .eq("sub_account_id", subAccountId)
    .eq("status", "won")
    .lte("closed_at", endISO)
  if (startISO) wonQuery = wonQuery.gte("closed_at", startISO)
  let newContactsQuery = supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("sub_account_id", subAccountId)
    .lte("created_at", endISO)
  if (startISO) newContactsQuery = newContactsQuery.gte("created_at", startISO)
  let activitiesCountQuery = supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("sub_account_id", subAccountId)
    .lte("created_at", endISO)
  if (startISO) activitiesCountQuery = activitiesCountQuery.gte("created_at", startISO)

  const [
    contactsResult,
    openDealsResult,
    wonDealsResult,
    overdueTasksResult,
    pendingTasksResult,
    recentActivitiesResult,
    pipelineResult,
    newContactsResult,
    activitiesCountResult,
    earliestDealResult,
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("sub_account_id", subAccountId),
    supabase
      .from("deals")
      .select("value")
      .eq("sub_account_id", subAccountId)
      .eq("status", "open"),
    wonQuery,
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("sub_account_id", subAccountId)
      .eq("status", "pending")
      .lt("due_date", new Date().toISOString()),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("sub_account_id", subAccountId)
      .eq("status", "pending"),
    supabase
      .from("activities")
      .select("*")
      .eq("sub_account_id", subAccountId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("sub_account_id", subAccountId)
      .order("position"),
    newContactsQuery,
    activitiesCountQuery,
    supabase
      .from("deals")
      .select("closed_at")
      .eq("sub_account_id", subAccountId)
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: true })
      .limit(1),
  ])

  const totalContacts = contactsResult.count ?? 0
  const newContactsCount = newContactsResult.count ?? 0
  const activitiesCount = activitiesCountResult.count ?? 0
  const years = yearsFrom(earliestDealResult.data?.[0]?.closed_at ?? null)
  const periodLabel = labelFor(range)

  const openDeals = openDealsResult.data ?? []
  const openDealsCount = openDeals.length
  const openDealsValue = openDeals.reduce(
    (sum, d) => sum + (d.value ?? 0),
    0
  )

  const wonDeals = wonDealsResult.data ?? []
  const wonDealsCount = wonDeals.length
  const wonDealsValue = wonDeals.reduce(
    (sum, d) => sum + (d.value ?? 0),
    0
  )
  const wonCommission = wonDeals.reduce((sum, d) => sum + (Number(d.commission) || 0), 0)

  const overdueTasksCount = overdueTasksResult.count ?? 0
  const pendingTasksCount = pendingTasksResult.count ?? 0

  const recentActivities = (recentActivitiesResult.data ?? []) as Activity[]
  const pipelineStages = (pipelineResult.data ?? []) as PipelineStage[]

  // Fetch deal counts per stage
  const stageIds = pipelineStages.map((s) => s.id)
  let stageDealCounts: Record<string, number> = {}
  if (stageIds.length > 0) {
    const { data: stageDeals } = await supabase
      .from("deals")
      .select("stage_id")
      .eq("sub_account_id", subAccountId)
      .eq("status", "open")
      .in("stage_id", stageIds)

    if (stageDeals) {
      stageDealCounts = stageDeals.reduce(
        (acc, deal) => {
          acc[deal.stage_id] = (acc[deal.stage_id] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
    }
  }

  // Use sub-account timezone for date display
  const saTimezone = subAccount?.timezone ?? "UTC"
  const now = new Date()
  const dayOfWeek = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: saTimezone,
  }).format(now)
  const dateStr = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: saTimezone,
  }).format(now)
  const displayName = accountContact?.name || user?.email?.split("@")[0] || "admin"

  const stats = [
    {
      title: "Open Deals",
      value: `${openDealsCount}`,
      icon: TrendingUp,
      description: openDealsCount > 0 ? `${openDealsCount} active · all time` : "No active deals",
      href: "/pipeline?view=list&status=open",
    },
    {
      title: "Pipeline Value",
      value: formatCurrency(openDealsValue, currency),
      icon: DollarSign,
      description: "Across open stages · all time",
      href: "/pipeline?view=list&status=open",
    },
    {
      title: `Won · ${periodLabel}`,
      value: formatCurrency(wonDealsValue, currency),
      icon: Trophy,
      description: `${wonDealsCount} deal${wonDealsCount !== 1 ? "s" : ""} closed · ${formatCurrency(wonCommission, currency)} commission`,
      href: `/pipeline?view=list&status=won&range=${encodeURIComponent(range)}`,
      accent: true,
    },
    {
      title: `New Contacts · ${periodLabel}`,
      value: `${newContactsCount}`,
      icon: Users,
      description: `${totalContacts} total`,
      href: "/contacts",
    },
    {
      title: "Tasks Due",
      value: `${pendingTasksCount}`,
      icon: CheckSquare,
      description: overdueTasksCount > 0 ? `${overdueTasksCount} overdue` : "All on track",
      href: "/tasks",
      warning: overdueTasksCount > 0,
    },
    {
      title: `Activities · ${periodLabel}`,
      value: `${activitiesCount}`,
      icon: ActivityIcon,
      description: "Notes, calls, emails, updates",
      href: "/contacts",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Account Contact Bar */}
      {(accountContact?.name || accountContact?.email || accountContact?.phone) && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground border-b pb-3">
          <span className="font-medium text-foreground">Account contact</span>
          {accountContact?.name && (
            <span>{accountContact.name}</span>
          )}
          {accountContact?.email && (
            <span className="flex items-center gap-1">
              <Mail className="size-3" />
              {accountContact.email}
            </span>
          )}
          {accountContact?.phone && (
            <span className="flex items-center gap-1">
              <Phone className="size-3" />
              {accountContact.phone}
            </span>
          )}
        </div>
      )}

      {/* Welcome Message + period picker */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {dayOfWeek}, {dateStr}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            Welcome back, <span className="italic">{displayName}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here&apos;s what&apos;s moving in your pipeline
          </p>
        </div>
        <DashboardRangeSelect value={range} years={years} />
      </div>

      {/* Stat cards — 6 grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`size-4 ${stat.warning ? "text-orange-400" : stat.accent ? "text-green-400" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.accent ? "text-green-400" : ""}`}>
                  {stat.value}
                </div>
                <p className={`text-xs ${stat.warning ? "text-orange-400" : "text-muted-foreground"}`}>
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ActivityIcon className="size-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CollapsibleActivityList activities={recentActivities} />
          </CardContent>
        </Card>

        {/* Pipeline Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="size-4" />
              Pipeline Overview
            </CardTitle>
            <Link href="/pipeline" className="text-xs text-primary hover:underline">
              View pipeline <ArrowRight className="inline size-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {pipelineStages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pipeline stages configured
              </p>
            ) : (
              <div className="space-y-3">
                {pipelineStages.map((stage) => {
                  const count = stageDealCounts[stage.id] ?? 0
                  return (
                    <div
                      key={stage.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="size-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="text-sm">{stage.name}</span>
                      </div>
                      <Badge variant="outline">{count} deals</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
