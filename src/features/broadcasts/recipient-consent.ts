import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecipientWithEngagement } from './engagement'

export type RecipientHistory = RecipientWithEngagement & {
  consent: { status: string | null; withdrawnAt: string | null }
}

// Current contact state, never campaign attribution. Select only the one metadata
// field required for display; do not expose contact tokens or other private metadata.
export async function attachRecipientConsent(db: SupabaseClient, rows: RecipientWithEngagement[], orgId: string, subAccountId: string): Promise<RecipientHistory[]> {
  const ids = [...new Set(rows.flatMap(r => r.contact_id ? [r.contact_id] : []))]
  const contacts = new Map<string, RecipientHistory['consent']>()
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from('contacts').select('id,consent_status,withdrawn_at:metadata->>unsubscribed_at')
      .eq('org_id', orgId).eq('sub_account_id', subAccountId).in('id', ids.slice(i, i + 100))
    if (error) throw new Error('Current recipient consent could not be loaded.')
    for (const c of data ?? []) {
      const date = typeof c.withdrawn_at === 'string' && Number.isFinite(Date.parse(c.withdrawn_at)) ? c.withdrawn_at : null
      contacts.set(c.id, { status: c.consent_status, withdrawnAt: c.consent_status === 'withdrawn' ? date : null })
    }
  }
  return rows.map(r => ({ ...r, consent: contacts.get(r.contact_id ?? '') ?? { status: null, withdrawnAt: null } }))
}

export function unsubscribedCount(rows: RecipientHistory[]) {
  return new Set(rows.filter(r => r.consent?.status === 'withdrawn' && r.contact_id).map(r => r.contact_id)).size
}
