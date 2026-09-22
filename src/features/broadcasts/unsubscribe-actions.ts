"use server"

import { createAnonClient } from "@/lib/supabase/anon"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Public: withdraws consent for the contact behind the token. Runs as anon
// through the SECURITY DEFINER function, so no login is involved.
export async function confirmUnsubscribe(token: string, source = "link") {
  if (!UUID_RE.test(token)) return { ok: false as const, error: "This link is not valid." }
  const supabase = createAnonClient()
  const { data, error } = await supabase.rpc("unsubscribe_contact", { p_token: token, p_source: source })
  if (error) return { ok: false as const, error: "Something went wrong. Please try again." }
  const result = data as { ok: boolean; already?: boolean; error?: string }
  if (!result.ok) return { ok: false as const, error: "This link is not valid." }
  return { ok: true as const, already: Boolean(result.already) }
}
