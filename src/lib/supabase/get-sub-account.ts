import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

/**
 * Gets the current sub-account ID for the authenticated user.
 * Reads from cookie first, falls back to first sub-account in the user's org.
 * Returns null only if the user has no sub-accounts at all.
 */
export async function getSubAccountId(): Promise<string | null> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get("flowcrm_sub_account_id")?.value

  if (fromCookie) return fromCookie

  // Cookie not set — look up from the user's org
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single()

  if (!membership) return null

  const { data: subAccounts } = await supabase
    .from("sub_accounts")
    .select("id")
    .eq("org_id", membership.org_id)
    .order("name")
    .limit(1)

  return subAccounts?.[0]?.id ?? null
}
