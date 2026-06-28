import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TasksPage } from "@/features/tasks/components/tasks-page"

export const metadata = {
  title: "Tasks | FlowCRM",
}

export default async function TasksRoute() {
  const supabase = await createClient()
  const cookieStore = await cookies()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const subAccountId = cookieStore.get("flowcrm_sub_account_id")?.value
  if (!subAccountId) redirect("/settings")

  // Fetch tasks with contact and deal joins
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

  // Fetch contacts for the dialog combobox
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .eq("sub_account_id", subAccountId)
    .order("first_name")

  // Fetch deals for the dialog combobox
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
