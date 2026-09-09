import { NextResponse } from "next/server"
import { createAnonClient } from "@/lib/supabase/anon"
import { rateLimit, clientKey } from "@/lib/rate-limit"
import { validateIntakePayload } from "@/features/intake/validate"
import { sendIntakeNotification, type IntakeResult } from "@/features/intake/notify"

// POST /api/intake — public lead intake for external websites.
// Auth: `Authorization: Bearer <workspace intake key>` (or `x-intake-key`).
// The key is hashed and matched inside intake_contact(); the route never
// touches the service-role key. Always returns JSON.

function bearer(req: Request): string | null {
  const auth = req.headers.get("authorization")
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null
  return req.headers.get("x-intake-key")?.trim() || null
}

export async function POST(req: Request) {
  try {
    if (!rateLimit(`intake:${clientKey(req)}`)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 })
    }

    const key = bearer(req)
    if (!key) {
      return NextResponse.json({ error: "Missing intake key." }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const result = validateIntakePayload(body)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, issues: result.issues }, { status: 400 })
    }
    // Honeypot filled: pretend success so bots learn nothing.
    if (result.honeypot) {
      return NextResponse.json({ ok: true })
    }

    const supabase = createAnonClient()
    const { data, error } = await supabase.rpc("intake_contact", {
      p_key: key,
      p_payload: result.payload,
    })

    if (error) {
      console.error("[intake] rpc failed:", error.message)
      return NextResponse.json({ error: "Intake failed." }, { status: 500 })
    }

    const outcome = data as IntakeResult | { error: string }
    if ("error" in outcome) {
      const status = outcome.error === "invalid_key" ? 401 : 400
      return NextResponse.json({ error: outcome.error }, { status })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    const notified = await sendIntakeNotification(outcome, result.payload, appUrl)

    return NextResponse.json({
      ok: true,
      contact_id: outcome.contact_id,
      created: outcome.created,
      notified,
    })
  } catch (err) {
    console.error("[intake] unhandled:", err)
    return NextResponse.json({ error: "Intake failed." }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: "POST JSON {name, email, phone?, message?, source?, tags?, meta?, consent: true, consent_text?} with Authorization: Bearer <intake key>",
  })
}
