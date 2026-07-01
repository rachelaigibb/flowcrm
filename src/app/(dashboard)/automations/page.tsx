import { getUserContext } from "@/lib/supabase/get-user-context"
import { AutomationsPage } from "@/features/automations/components/automations-page"
import type { Automation } from "@/types/database"

export const metadata = {
  title: "Automations | FlowCRM",
}

export default async function AutomationsRoute() {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data: automations, error } = await supabase
    .from("automations")
    .select("*, automation_runs(count)")
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Failed to load automations. Please try again.
        </p>
      </div>
    )
  }

  const typedAutomations = (automations ?? []) as (Automation & {
    automation_runs: { count: number }[]
  })[]

  return <AutomationsPage automations={typedAutomations} />
}
