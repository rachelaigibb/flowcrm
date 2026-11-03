import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SubAccountSettingsPage } from "@/features/settings/components/sub-account-settings-page"
import type { SubAccount, PipelineStage, SubAccountMembership } from "@/types/database"

export const metadata = {
  title: "Sub-account Settings | FlowCRM",
}

export default async function SubAccountSettingsRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [subAccountResult, stagesResult, membersResult] = await Promise.all([
    supabase.from("sub_accounts").select("*").eq("id", id).single(),
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("sub_account_id", id)
      .order("position"),
    supabase
      .from("sub_account_memberships")
      .select("*")
      .eq("sub_account_id", id),
  ])

  if (!subAccountResult.data) redirect("/settings")

  const { data: ownMembership } = await supabase.from("memberships")
    .select("role").eq("org_id", subAccountResult.data.org_id).eq("user_id", user.id).maybeSingle()
  const canInvite = ownMembership?.role === "owner" || ownMembership?.role === "admin"
  const { data: pendingInvitations } = canInvite ? await supabase.from("invitations")
    .select("id,email,expires_at,sub_account_ids")
    .eq("org_id", subAccountResult.data.org_id).eq("status", "pending") : { data: [] }

  // Enrich members with current user's email
  const enrichedMembers = (membersResult.data ?? []).map((m) => ({
    ...m,
    email: m.user_id === user.id ? user.email ?? undefined : undefined,
  })) as (SubAccountMembership & { email?: string })[]

  // Extract tags from sub-account settings JSONB
  const subAccountData = subAccountResult.data as SubAccount & { settings?: Record<string, unknown> }
  const tags = (subAccountData.settings?.tags as Array<{ id: string; name: string; color: string }>) ?? []

  return (
    <SubAccountSettingsPage
      subAccount={subAccountResult.data as SubAccount}
      stages={(stagesResult.data ?? []) as PipelineStage[]}
      members={enrichedMembers}
      tags={tags}
      canInvite={canInvite}
      pendingInvitations={(pendingInvitations ?? []).filter((invite) => invite.sub_account_ids?.includes(id))}

    />
  )
}
