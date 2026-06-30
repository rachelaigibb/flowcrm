import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AgencySettingsPage } from "@/features/settings/components/agency-settings-page"
import type { Organization, Membership } from "@/types/database"

export const metadata = {
  title: "Agency Settings | FlowCRM",
}

export default async function AgencySettingsRoute() {
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

  const [orgResult, membersResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("*")
      .eq("id", membership.org_id)
      .single(),
    supabase
      .from("memberships")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("created_at"),
  ])

  if (!orgResult.data) redirect("/login")

  const enrichedMembers = (membersResult.data ?? []).map((m) => ({
    ...m,
    email: m.user_id === user.id ? user.email ?? undefined : undefined,
  })) as (Membership & { email?: string })[]

  return (
    <AgencySettingsPage
      org={orgResult.data as Organization}
      members={enrichedMembers}
    />
  )
}
