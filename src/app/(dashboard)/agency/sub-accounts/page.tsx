import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { SubAccount } from "@/types/database"
import { SubAccountsTable } from "./sub-accounts-table"

export const metadata = {
  title: "Sub-accounts | FlowCRM",
}

export default async function SubAccountsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single()

  if (!membership) redirect("/login")

  const { data: subAccounts } = await supabase
    .from("sub_accounts")
    .select("*")
    .eq("org_id", membership.org_id)
    .order("name")

  return (
    <div className="space-y-6">
      <SubAccountsTable
        subAccounts={(subAccounts ?? []) as (SubAccount & { accent_color?: string })[]}
      />
    </div>
  )
}
