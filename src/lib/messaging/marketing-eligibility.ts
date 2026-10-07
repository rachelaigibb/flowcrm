import type { SupabaseClient } from '@supabase/supabase-js'

// A local refusal is known not to have reached the provider, unlike a transport error.
export class MarketingSendBlocked extends Error {}

export async function assertMarketingEligibility(db: SupabaseClient, orgId: string, subAccountId: string, contactId: string, email: string, token: string) {
  try {
    // Use the existing signed broadcast event ledger. It is not a complete provider
    // suppression list; Resend still enforces its own account-wide suppressions.
    for (let offset = 0; ; offset += 100) {
      const { data: previous, error } = await db.from('broadcast_recipients').select('provider_id')
        .eq('org_id', orgId).eq('sub_account_id', subAccountId).eq('contact_id', contactId)
        .not('provider_id', 'is', null).order('id').range(offset, offset + 99)
      if (error) throw error
      if (previous?.length) {
        const { data: issues, error: issueError } = await db.from('email_delivery_events').select('event_id')
          .in('provider_id', previous.map(r => r.provider_id))
          .in('event_type', ['email.bounced', 'email.complained', 'email.suppressed']).limit(1)
        if (issueError) throw issueError
        if (issues?.length) throw new MarketingSendBlocked('Marketing email not sent: suppression evidence exists for this contact.')
      }
      if ((previous?.length ?? 0) < 100) break
    }
    // Last read before the provider call, after queue/backoff waits. Never replace
    // an address or token in an already prepared idempotent payload.
    const { data: contact, error } = await db.from('contacts').select('email,consent_status,tags,unsubscribe_token')
      .eq('org_id', orgId).eq('sub_account_id', subAccountId).eq('id', contactId).maybeSingle()
    if (error) throw error
    if (!contact || !['explicit', 'implied'].includes(contact.consent_status) || contact.tags?.includes('do-not-contact')) {
      throw new MarketingSendBlocked('Marketing email not sent: contact is no longer eligible (consent or do-not-contact).')
    }
    if (contact.email !== email || contact.unsubscribe_token !== token) {
      throw new MarketingSendBlocked('Marketing email not sent: recipient address or unsubscribe link changed.')
    }
  } catch (error) {
    if (error instanceof MarketingSendBlocked) throw error
    throw new MarketingSendBlocked('Marketing email not sent: current consent and suppression could not be verified.')
  }
}
