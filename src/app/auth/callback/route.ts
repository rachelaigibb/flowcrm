import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Handles the redirect from Supabase auth emails (magic link, password
// recovery, signup confirmation). The email link lands here with a `code`
// (PKCE) or token_hash, which we exchange for a session cookie before sending
// the user on to `next`. Without this route those links have nowhere to
// establish a session and the middleware bounces the user back to /login.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  // Never allow an open redirect: only same-origin relative paths.
  const safeNext = next.startsWith("/") ? next : "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  // No code, or the exchange failed (expired/reused link).
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Sign-in link was invalid or has expired. Please request a new one.")}`
  )
}
