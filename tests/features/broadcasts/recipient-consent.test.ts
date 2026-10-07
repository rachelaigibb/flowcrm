// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { attachRecipientConsent, unsubscribedCount } from '@/features/broadcasts/recipient-consent'
import { summarizeEngagement, type RecipientWithEngagement } from '@/features/broadcasts/engagement'
const row = (id: string | null) => ({ contact_id: id, engagement: summarizeEngagement([]) }) as RecipientWithEngagement
function database(data: unknown[], error: unknown = null) {
  const calls: unknown[][] = []
  const q = { select: (value: string) => { calls.push(['select', value]); return q }, eq: (key: string, value: string) => { calls.push(['eq', key, value]); return q }, in: (_key: string, ids: string[]) => { calls.push(['ids', ids]); return Promise.resolve({ data, error }) } }
  return { db: { from: () => q } as unknown as SupabaseClient, calls }
}
describe('current recipient consent reporting', () => {
  it('keeps unknown contacts and dates unknown, and does not infer campaign attribution', async () => {
    const t = database([{ id: 'a', consent_status: 'withdrawn', withdrawn_at: '2026-10-06T17:02:54Z' }, { id: 'b', consent_status: 'explicit', withdrawn_at: '2026-10-01T17:00:00Z' }, { id: 'c', consent_status: 'withdrawn', withdrawn_at: 'invalid' }])
    const result = await attachRecipientConsent(t.db, [row('a'), row('a'), row('b'), row('c'), row('missing'), row(null)], 'org', 'workspace')
    expect(unsubscribedCount(result)).toBe(2)
    expect(result[0].consent).toEqual({ status: 'withdrawn', withdrawnAt: '2026-10-06T17:02:54Z' })
    expect(result[2].consent).toEqual({ status: 'explicit', withdrawnAt: null })
    expect(result[3].consent).toEqual({ status: 'withdrawn', withdrawnAt: null })
    expect(result[4].consent).toEqual({ status: null, withdrawnAt: null })
    expect(result[5].consent).toEqual({ status: null, withdrawnAt: null })
    expect(t.calls).toContainEqual(['eq', 'org_id', 'org']); expect(t.calls).toContainEqual(['eq', 'sub_account_id', 'workspace'])
    expect(t.calls[0]).toEqual(['select', 'id,consent_status,withdrawn_at:metadata->>unsubscribed_at'])
  })
  it('chunks unique contacts to avoid a truncated count', async () => {
    const t = database([]); await attachRecipientConsent(t.db, Array.from({ length: 205 }, (_, i) => row(String(i))), 'org', 'workspace')
    expect(t.calls.filter(c => c[0] === 'ids').map(c => (c[1] as string[]).length)).toEqual([100, 100, 5])
  })
  it('surfaces failed reads instead of showing zero unsubscribes', async () => {
    const t = database([], new Error('unavailable'))
    await expect(attachRecipientConsent(t.db, [row('a')], 'org', 'workspace')).rejects.toThrow('could not be loaded')
  })
})
