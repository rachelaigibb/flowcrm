import { NextResponse } from "next/server"
import { confirmUnsubscribe } from "@/features/broadcasts/unsubscribe-actions"

// One-click unsubscribe target for the List-Unsubscribe header (RFC 8058).
// Mail clients POST here without showing the recipient a page.

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const result = await confirmUnsubscribe(token, "one-click")
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[unsubscribe] one-click failed:", err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

// A person who opens the header link in a browser lands on the page instead.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return NextResponse.redirect(new URL(`/u/${token}`, req.url))
}
