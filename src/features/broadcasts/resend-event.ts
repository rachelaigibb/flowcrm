import type { EmailDeliveryEvent } from "@/types/database"
const supported = new Set(["email.sent", "email.delivered", "email.clicked", "email.bounced", "email.complained", "email.delivery_delayed", "email.failed", "email.suppressed"])
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid event")
  return value as Record<string, unknown>
}
function date(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error("Invalid event time")
  return new Date(value).toISOString()
}
// Called only after signature verification. Whitelist fields: no addresses, IPs, agents or raw payload.
export function normalizeResendEvent(payload: unknown, eventId: string): EmailDeliveryEvent | null {
  const event = record(payload)
  if (typeof event.type !== "string" || !supported.has(event.type)) return null
  const data = record(event.data)
  if (!eventId || eventId.length > 255 || typeof data.email_id !== "string" || !data.email_id || data.email_id.length > 255) throw new Error("Invalid event identity")
  let occurredAt = date(event.created_at)
  let link: string | null = null
  if (event.type === "email.clicked") {
    const click = record(data.click)
    if (typeof click.link !== "string" || !click.link || click.link.length > 16384) throw new Error("Invalid link")
    link = click.link; occurredAt = date(click.timestamp)
  }
  return { event_id: eventId, provider_id: data.email_id, event_type: event.type, occurred_at: occurredAt, link }
}
