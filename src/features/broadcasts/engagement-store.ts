import type { SupabaseClient } from "@supabase/supabase-js"
import type { BroadcastRecipient, EmailDeliveryEvent } from "@/types/database"
import { summarizeEngagement, type RecipientWithEngagement } from "./engagement"

// Explicit tenant filters plus RLS. Page all events so unique counts aren't silently capped.
export async function attachEngagement(supabase: SupabaseClient, rows: BroadcastRecipient[]): Promise<RecipientWithEngagement[]> {
  const ids = [...new Set(rows.flatMap(r => r.provider_id ? [r.provider_id] : []))]
  const byProvider = new Map<string, EmailDeliveryEvent[]>()
  for (let i = 0; i < ids.length; i += 100) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("email_delivery_events").select("event_id,provider_id,event_type,occurred_at,link")
        .in("provider_id", ids.slice(i, i + 100)).order("event_id").range(offset, offset + 499)
      if (error) throw new Error("Engagement could not be loaded. Confirm the reporting migration is installed and refresh.")
      for (const event of (data ?? []) as EmailDeliveryEvent[]) {
        const group = byProvider.get(event.provider_id) ?? []; group.push(event); byProvider.set(event.provider_id, group)
      }
      if ((data?.length ?? 0) < 500) break
    }
  }
  return rows.map(r => ({ ...r, engagement: summarizeEngagement(byProvider.get(r.provider_id ?? "") ?? []) }))
}
