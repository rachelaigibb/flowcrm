import { getUserContext } from "@/lib/supabase/get-user-context"
import { ReportsPage } from "@/features/reports/components/reports-page"

export const metadata = {
  title: "Reports | FlowCRM",
}

export default async function ReportsRoute() {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const [dealsResult, contactsResult, tasksResult, stagesResult, subAccountResult] =
    await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(id, name, color, position)")
        .eq("org_id", orgId)
        .eq("sub_account_id", subAccountId),
      supabase
        .from("contacts")
        .select("id, source, tags, created_at")
        .eq("org_id", orgId)
        .eq("sub_account_id", subAccountId),
      supabase
        .from("tasks")
        .select("id, status, created_at")
        .eq("org_id", orgId)
        .eq("sub_account_id", subAccountId),
      supabase
        .from("pipeline_stages")
        .select("*")
        .eq("org_id", orgId)
        .eq("sub_account_id", subAccountId)
        .order("position"),
      supabase
        .from("sub_accounts")
        .select("currency")
        .eq("id", subAccountId)
        .single(),
    ])

  return (
    <ReportsPage
      deals={dealsResult.data ?? []}
      contacts={contactsResult.data ?? []}
      tasks={tasksResult.data ?? []}
      stages={stagesResult.data ?? []}
      currency={subAccountResult.data?.currency ?? "USD"}
    />
  )
}
