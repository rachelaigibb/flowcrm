import { getUserContext } from "@/lib/supabase/get-user-context"
import { FormsPage } from "@/features/forms/components/forms-page"
import type { Form } from "@/types/database"

export const metadata = {
  title: "Forms | FlowCRM",
}

export default async function FormsRoute() {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data: forms, error } = await supabase
    .from("forms")
    .select("*, form_submissions(count)")
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Failed to load forms. Please try again.
        </p>
      </div>
    )
  }

  const typedForms = (forms ?? []) as (Form & {
    form_submissions: { count: number }[]
  })[]

  return <FormsPage forms={typedForms} />
}
