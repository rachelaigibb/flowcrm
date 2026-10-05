import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Service-role client: bypasses RLS. Only the authenticated cron route and
// signature-verified Resend webhook may import this file — neither has a user session,
// so it cannot use the cookie client. The key lives only in Vercel
// (Production, Sensitive); it is never in .env.local, so this throws locally.
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
