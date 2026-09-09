import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Cookie-less anon client for public route handlers (no user session).
// Only SECURITY DEFINER functions granted to `anon` are reachable through it;
// RLS blocks everything else.
export function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
