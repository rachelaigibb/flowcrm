import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/currency"
import {
  Users,
  DollarSign,
  Trophy,
  AlertTriangle,
  ActivityIcon,
} from "lucide-react"
import type { Activity, PipelineStage } from "@/types/database"

export default async function DashboardPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()

  const subAccountId = cookieStore.get("flowcrm_sub_account_id")?.value

  if (!subAccountId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">
          No sub-account selected. Create one in Settings to get started.
        </p>
      </div>
    )
  }

  // Fetch sub-account for currency
  const { data: subAccount } = await supabase
    .from("sub_accounts")
    .select("currency")
    .eq("id", subAccountId)
    .single()

  const currency = subAccount?.currency ?? "USD"

  // Parallel fetches for dashboard stats
  const [
    contactsResult,
    openDealsResult,
    wonDealsResult,
    overdueTasksResult,
    recentActivitiesResult,
    pipelineResult,
  ] = await Promise.all([
    // Total contacts
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("sub_account_id", subAccountId),

    // Open deals
    supabase
      .from("deals")
      .select("value")
      .eq("sub_account_id", subAccountId)
      .eq("status", "open"),

    // Won deals this month
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

    // Overdue tasks
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("sub_account_id", subAccountId)
      .eq("status", "pending")
      .lt("due_date", new Date().toISOString()),

    // Recent activities
    supabase
      .from("activities")
      .select("*")
      .eq("sub_account_id", subAccountId)
      .order("created_at", { ascending: false })
      .limit(10),

    // Pipeline stages with deal counts
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

  const stats = [
    {
      title: "Total Contacts",
      value: totalContacts.toLocaleString(),
      icon: Users,
      description: "All contacts in this account",
    },
    {
      title: "Open Deals",
      value: `${openDealsCount}`,
      icon: DollarSign,
      description: formatCurrency(openDealsValue, currency) + " total value",
    },
    {
      title: "Won This Month",
      value: `${wonDealsCount}`,
      icon: Trophy,
      description: formatCurrency(wonDealsValue, currency) + " closed",
    },
    {
      title: "Overdue Tasks",
      value: `${overdueTasksCount}`,
      icon: AlertTriangle,
      description: overdueTasksCount > 0 ? "Needs attention" : "All caught up",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your business at a glance
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="size-4" />
              Pipeline Overview
            </CardTitle>
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
