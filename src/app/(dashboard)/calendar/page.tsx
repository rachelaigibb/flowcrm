import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSubAccountId } from "@/lib/supabase/get-sub-account"
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
} from "date-fns"
import {
  CalendarView,
  type CalendarTask,
  type CalendarDeal,
} from "@/components/shared/calendar-view"

export const metadata = {
  title: "Calendar | FlowCRM",
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const subAccountId = await getSubAccountId()
  if (!subAccountId) redirect("/settings")

  const { month, year } = await searchParams

  // Determine the current display month
  const now = new Date()
  const displayMonth = month ? parseInt(month, 10) - 1 : now.getMonth()
  const displayYear = year ? parseInt(year, 10) : now.getFullYear()
  const currentDate = new Date(displayYear, displayMonth, 1)

  // Calculate the full grid range (includes partial weeks at start/end)
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const rangeStartISO = format(gridStart, "yyyy-MM-dd")
  const rangeEndISO = format(gridEnd, "yyyy-MM-dd")

  // Fetch tasks and deals in parallel for the grid range
  const [tasksResult, dealsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        `
        id, title, due_date, priority, status,
        contact:contacts(id, first_name, last_name),
        deal:deals(id, title)
      `
      )
      .eq("sub_account_id", subAccountId)
      .neq("status", "cancelled")
      .gte("due_date", rangeStartISO)
      .lte("due_date", rangeEndISO)
      .order("due_date", { ascending: true }),

    supabase
      .from("deals")
      .select(
        `
        id, title, value, currency, priority, status, expected_close,
        contact:contacts(id, first_name, last_name)
      `
      )
      .eq("sub_account_id", subAccountId)
      .eq("status", "open")
      .gte("expected_close", rangeStartISO)
      .lte("expected_close", rangeEndISO)
      .order("expected_close", { ascending: true }),
  ])

  const tasks = (tasksResult.data ?? []) as unknown as CalendarTask[]
  const deals = (dealsResult.data ?? []) as unknown as CalendarDeal[]

  return (
    <CalendarView
      tasks={tasks}
      deals={deals}
      month={displayMonth}
      year={displayYear}
    />
  )
}
