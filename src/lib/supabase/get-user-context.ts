"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function getUserContext() {
  const supabase = await createClient()
  const cookieStore = await cookies()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("Unauthorized")
  }

  // Get org_id and role from membership
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single()

  if (membershipError || !membership) {
    throw new Error("No organization found")
  }

  // Get sub-account ID: cookie first, then DB fallback
  let subAccountId = cookieStore.get("flowcrm_sub_account_id")?.value

  if (!subAccountId) {
    const { data: subAccounts } = await supabase
      .from("sub_accounts")
      .select("id")
      .eq("org_id", membership.org_id)
      .order("name")
      .limit(1)

    subAccountId = subAccounts?.[0]?.id
  }

  if (!subAccountId) {
    throw new Error("No sub-account found")
  }

  return {
    userId: user.id,
    orgId: membership.org_id as string,
    orgRole: membership.role as string,
    subAccountId,
    supabase,
  }
}
