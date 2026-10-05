import type { BroadcastRecipient, EmailDeliveryEvent } from "@/types/database"

export interface Engagement {
  deliveredAt: string | null
  issue: string | null
  issueAt: string | null
  firstClickedAt: string | null
  lastClickedAt: string | null
  clicks: number
  links: { url: string; clicks: number; firstAt: string; lastAt: string }[]
}
export type RecipientWithEngagement = BroadcastRecipient & { engagement: Engagement }
export const engagementFilters = { all: "All engagement", clicked: "Clicked", delivered: "Delivered", issues: "Delivery issues", unknown: "No delivery/click evidence" }

// Derive from immutable events, never arrival order or the send-loop stats JSON.
export function summarizeEngagement(events: EmailDeliveryEvent[]): Engagement {
  const unique = [...new Map(events.map(e => [e.event_id, e])).values()]
    .sort((a,b) => a.occurred_at.localeCompare(b.occurred_at) || a.event_id.localeCompare(b.event_id))
  const links = new Map<string, Engagement["links"][number]>()
  const result: Engagement = { deliveredAt: null, issue: null, issueAt: null, firstClickedAt: null, lastClickedAt: null, clicks: 0, links: [] }
  for (const e of unique) {
    if (e.event_type === "email.delivered") result.deliveredAt ??= e.occurred_at
    if (["email.bounced", "email.complained", "email.failed", "email.suppressed", "email.delivery_delayed"].includes(e.event_type)) {
      // Terminal issues remain visible even if a delayed event arrives later.
      if (!result.issue || result.issue === "email.delivery_delayed" || e.event_type !== "email.delivery_delayed") {
        result.issue = e.event_type; result.issueAt = e.occurred_at
      }
    }
    if (e.event_type === "email.clicked" && e.link) {
      result.firstClickedAt ??= e.occurred_at; result.lastClickedAt = e.occurred_at; result.clicks++
      const link = links.get(e.link)
      if (link) { link.clicks++; link.lastAt = e.occurred_at }
      else links.set(e.link, { url: e.link, clicks: 1, firstAt: e.occurred_at, lastAt: e.occurred_at })
    }
  }
  if (result.issue === "email.delivery_delayed" && result.deliveredAt && result.deliveredAt >= result.issueAt!) {
    result.issue = null; result.issueAt = null
  }
  result.links = [...links.values()]
  return result
}
export function matchesEngagement(e: Engagement, filter: string) {
  if (filter === "clicked") return e.clicks > 0
  if (filter === "delivered") return !!e.deliveredAt
  if (filter === "issues") return !!e.issue
  if (filter === "unknown") return !e.deliveredAt && !e.clicks && !e.issue
  return true
}
export function safeLink(url: string): string | undefined {
  try { const parsed = new URL(url); return ["https:", "http:"].includes(parsed.protocol) ? url : undefined } catch { return undefined }
}
