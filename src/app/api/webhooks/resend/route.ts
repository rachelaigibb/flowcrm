import { Resend } from "resend"
import { createServiceClient } from "@/lib/supabase/service"
import { isBroadcastEvent } from "@/features/broadcasts/event-scope"
import { normalizeResendEvent } from "@/features/broadcasts/resend-event"

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return Response.json({ error: "Webhook not configured" }, { status: 503 })
  let event
  let verified: unknown
  try {
    const payload = await request.text()
    if (new TextEncoder().encode(payload).length > 262144) return Response.json({ error: "Payload too large" }, { status: 413 })
    const id = request.headers.get("svix-id") ?? ""
    // verify() is local cryptography; this placeholder never makes an API request.
    verified = new Resend("verification-only").webhooks.verify({ payload, webhookSecret: secret,
      headers: { id, timestamp: request.headers.get("svix-timestamp") ?? "", signature: request.headers.get("svix-signature") ?? "" } })
    event = normalizeResendEvent(verified, id)
  } catch {
    return Response.json({ error: "Invalid webhook" }, { status: 400 })
  }
  if (!event) return Response.json({ received: true })
  try {
    const supabase = createServiceClient()
    if (!await isBroadcastEvent(supabase, event, verified)) return Response.json({ received: true })
    // One durable, atomic insert before acknowledging. Duplicates never overwrite evidence.
    const { error } = await supabase.from("email_delivery_events")
      .upsert(event, { onConflict: "event_id", ignoreDuplicates: true })
    if (error) throw new Error("Event persistence failed")
    return Response.json({ received: true })
  } catch {
    // No raw payload or database error logged (may contain recipient/link data).
    console.error("Resend event persistence failed")
    return Response.json({ error: "Could not save event" }, { status: 503 })
  }
}
