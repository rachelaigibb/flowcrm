import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmailDeliveryEvent } from '@/types/database'

export async function isBroadcastEvent(supabase: SupabaseClient, event: EmailDeliveryEvent, payload: unknown): Promise<boolean> {
  const data = (payload as { data?: { tags?: Record<string, unknown> } }).data
  const tags = data?.tags
  const broadcast = tags?.flowcrm_broadcast_id
  const contact = tags?.flowcrm_contact_id
  let query = supabase.from('broadcast_recipients').select('provider_id,broadcast:broadcasts!inner(channel)')
    .eq('broadcast.channel', 'email')
  if (broadcast !== undefined || contact !== undefined) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (typeof broadcast !== 'string' || typeof contact !== 'string' || !uuid.test(broadcast) || !uuid.test(contact)) return false
    query = query.eq('broadcast_id', broadcast).eq('contact_id', contact)
  } else {
    // Legacy sends have no tags. Accept only IDs already recorded by FlowCRM.
    query = query.eq('provider_id', event.provider_id)
  }
  const { data: recipient, error } = await query.maybeSingle()
  if (error) throw new Error('Could not resolve broadcast event')
  return !!recipient && (!recipient.provider_id || recipient.provider_id === event.provider_id)
}
