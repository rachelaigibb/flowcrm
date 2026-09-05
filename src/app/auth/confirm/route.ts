import { NextResponse, type NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

const ALLOWED_TYPES: EmailOtpType[] = ["recovery", "magiclink", "email", "signup", "invite", "email_change"]

// Token-hash email flow (Supabase's recommended server-side pattern).
//
// The PKCE flow handled by /auth/callback only works when the email link is
// opened in the SAME browser that requested it, because the code verifier
// lives in a cookie there. Password resets are routinely requested on one
// device and opened on another, so those links land here instead: the email
// template puts `token_hash` + `type` on the URL and we verify it directly —
// no cookie dependency, works from any device.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/"
  const safeNext = next.startsWith("/") ? next : "/"

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
    console.error(`[auth/confirm] verifyOtp failed (type=${type}): ${error.message}`)
  } else {
    console.error("[auth/confirm] missing or invalid token_hash/type")
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Sign-in link was invalid or has already been used. Please request a new one.")}`
  )
}
