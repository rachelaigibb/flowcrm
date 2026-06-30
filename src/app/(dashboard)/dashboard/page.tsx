import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getSubAccountId } from "@/lib/supabase/get-sub-account"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/currency"
import { ACTIVITY_TYPE_COLORS } from "@/lib/constants/colors"
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

export const metadata = {
  title: "Dashboard | FlowCRM",
}

export default async function DashboardPage() {
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
  const accountContact = (subAccount?.settings as Record<string, unknown> | null)?.account_contact as
    | { name?: string; email?: string; phone?: string }
    | undefined

  // Parallel fetches for dashboard stats
  const [
    contactsResult,
    openDealsResult,
    wonDealsResult,
    overdueTasksResult,
    pendingTasksResult,
    recentActivitiesResult,
    pipelineResult,
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
    supabase
      .from("deals")
      .select("value")
      .eq("sub_account_id", subAccountId)
      .eq("status", "won")
      .gte(
        "updated_at",
        new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        ).toISOString()
      ),
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
  ])

  const totalContacts = contactsResult.count ?? 0

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
      description: openDealsCount > 0 ? `${openDealsCount} active` : "No active deals",
      href: "/pipeline",
    },
    {
      title: "Pipeline Value",
      value: formatCurrency(openDealsValue, currency),
      icon: DollarSign,
      description: "Across open stages",
      href: "/pipeline",
    },
    {
      title: "Won This Month",
      value: formatCurrency(wonDealsValue, currency),
      icon: Trophy,
      description: `${wonDealsCount} deal${wonDealsCount !== 1 ? "s" : ""} closed`,
      href: "/pipeline",
      accent: true,
    },
    {
      title: "New Contacts",
      value: `${totalContacts}`,
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
      title: "Activities",
      value: `${recentActivities.length}`,
      icon: ActivityIcon,
      description: "Recent actions",
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

      {/* Welcome Message */}
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
            {recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent activity
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <Badge variant="secondary" className="mt-0.5 shrink-0">
                      {activity.type}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-foreground">
                        {activity.content ?? "No description"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.created_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
