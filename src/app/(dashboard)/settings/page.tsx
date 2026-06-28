import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SettingsPage } from "@/features/settings/components/settings-page"
import type { Organization, SubAccount, Membership } from "@/types/database"

export const metadata = {
  title: "Settings | FlowCRM",
}

export default async function SettingsRoute() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Get user's membership
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single()

  if (!membership) redirect("/signup")

  // Parallel fetches
  const [orgResult, subAccountsResult, membersResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("*")
      .eq("id", membership.org_id)
      .single(),
    supabase
      .from("sub_accounts")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("name"),
    supabase
      .from("memberships")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("created_at"),
  ])

  if (!orgResult.data) redirect("/signup")

  // Enrich members with the current user's email (can't access auth.users via RLS)
  const enrichedMembers = (membersResult.data ?? []).map((m) => ({
    ...m,
    email: m.user_id === user.id ? user.email ?? undefined : undefined,
  })) as (Membership & { email?: string })[]

  return (
    <SettingsPage
      org={orgResult.data as Organization}
      subAccounts={(subAccountsResult.data ?? []) as SubAccount[]}
      members={enrichedMembers}
    />
  )
}
