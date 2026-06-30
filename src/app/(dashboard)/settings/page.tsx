import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getSubAccountId } from "@/lib/supabase/get-sub-account"
import { SubAccountSettingsPage } from "@/features/settings/components/sub-account-settings-page"
import type { SubAccount, PipelineStage, SubAccountMembership } from "@/types/database"

export const metadata = {
  title: "Settings Sub-Account | FlowCRM",
}

export default async function SettingsRoute() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const subAccountId = await getSubAccountId()

  if (!subAccountId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">
          No sub-account selected. Create one in Agency Home to get started.
        </p>
      </div>
    )
  }

  const [subAccountResult, stagesResult, membersResult] = await Promise.all([
    supabase.from("sub_accounts").select("*").eq("id", subAccountId).single(),
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("sub_account_id", subAccountId)
      .order("position"),
    supabase
      .from("sub_account_memberships")
      .select("*")
      .eq("sub_account_id", subAccountId),
  ])

  if (!subAccountResult.data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">
          Sub-account not found.
        </p>
      </div>
    )
  }

  const enrichedMembers = (membersResult.data ?? []).map((m) => ({
    ...m,
    email: m.user_id === user.id ? user.email ?? undefined : undefined,
  })) as (SubAccountMembership & { email?: string })[]

  const subAccountData = subAccountResult.data as SubAccount & { settings?: Record<string, unknown> }
  const tags = (subAccountData.settings?.tags as Array<{ id: string; name: string; color: string }>) ?? []

  return (
    <SubAccountSettingsPage
      subAccount={subAccountResult.data as SubAccount}
      stages={(stagesResult.data ?? []) as PipelineStage[]}
      members={enrichedMembers}
      tags={tags}
    />
  )
}
