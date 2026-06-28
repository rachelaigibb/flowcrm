import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getSubAccountId } from "@/lib/supabase/get-sub-account"
import { TasksPage } from "@/features/tasks/components/tasks-page"

export const metadata = {
  title: "Tasks | FlowCRM",
}

export default async function TasksRoute() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const subAccountId = await getSubAccountId()
  if (!subAccountId) redirect("/settings")

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      contact:contacts(id, first_name, last_name),
      deal:deals(id, title)
    `
    )
    .eq("sub_account_id", subAccountId)
    .order("due_date", { ascending: true, nullsFirst: false })

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Failed to load tasks. Please try again.
        </p>
      </div>
    )
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .eq("sub_account_id", subAccountId)
    .order("first_name")

  const { data: deals } = await supabase
    .from("deals")
    .select("id, title")
    .eq("sub_account_id", subAccountId)
    .eq("status", "open")
    .order("title")

  return (
    <TasksPage
      tasks={tasks ?? []}
      contacts={contacts ?? []}
      deals={deals ?? []}
    />
  )
}
