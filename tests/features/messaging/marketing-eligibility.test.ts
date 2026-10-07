// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertMarketingEligibility } from '@/lib/messaging/marketing-eligibility'
import { sendEmailToContact } from '@/lib/messaging/send'
const mocks = vi.hoisted(() => ({ send: vi.fn(), wait: vi.fn() }))
vi.mock('@/lib/resend/client', () => ({ getResendClient: () => ({ emails: { send: mocks.send } }) }))
vi.mock('@/lib/resend/send-paced', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/resend/send-paced')>()
  let now = 0
  return { ...original, sendPaced: original.createPacedSender(async ms => { now += ms; await mocks.wait(ms) }, () => now, () => 0) }
})
function setup() {
  const contact = { email: 'person@example.invalid', consent_status: 'explicit', tags: [] as string[], unsubscribe_token: 'token' }
  let found = true, suppressed = false, errorTable = '', throwTable = ''
  const filters: unknown[][] = []
  const activity = vi.fn()
  const db = { from(table: string) {
    if (table === throwTable) throw new Error('offline')
    const q = {
      select: () => q,
      eq: (field: string, value: unknown) => { filters.push([table, field, value]); return q },
      not: () => q, order: () => q, range: () => q,
      in: (field: string, value: unknown) => { filters.push([table, field, value]); return q },
      limit: () => q,
      insert: (value: unknown) => { activity(value); return q },
      single: async () => ({ data: { id: 'activity' }, error: null }),
      maybeSingle: async () => ({ data: found ? contact : null, error: table === errorTable ? new Error('unavailable') : null }),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: table === 'broadcast_recipients' ? [{ provider_id: 'past' }] : suppressed ? [{ event_id: 'suppression' }] : [], error: table === errorTable ? new Error('unavailable') : null }),
    }
    return q
  }} as unknown as SupabaseClient
  const params = { supabase: db, orgId: 'org', subAccountId: 'workspace', userId: null, contact: { id: 'person', first_name: 'Person', last_name: null, phone: null, email: contact.email, unsubscribe_token: 'token' }, settings: { fromName: 'Sender', fromEmail: 'sender@example.invalid', replyTo: 'sender@example.invalid', mailingAddress: 'Test address', signature: null, copyTo: 'sender@example.invalid' }, subject: 'Subject', body: 'Message', marketing: true }
  return { db, contact, filters, activity, params, missing: () => { found = false }, suppress: () => { suppressed = true }, error: (table: string) => { errorTable = table }, throws: (table: string) => { throwTable = table } }
}
beforeEach(() => { mocks.send.mockReset().mockResolvedValue({ data: { id: 'accepted' }, error: null }); mocks.wait.mockReset() })
describe('marketing eligibility at provider boundary', () => {
  it.each(['explicit', 'implied'])('allows current %s consent with unchanged payload and scoped reads', async status => {
    const t = setup(); t.contact.consent_status = status
    expect(await sendEmailToContact({ ...t.params, activityMetadata: { broadcast_id: 'campaign' } })).toMatchObject({ ok: true, providerId: 'accepted' })
    expect(mocks.send.mock.calls[0][1]).toEqual({ idempotencyKey: 'broadcast/campaign/person' })
    for (const table of ['contacts', 'broadcast_recipients']) {
      expect(t.filters).toContainEqual([table, 'org_id', 'org']); expect(t.filters).toContainEqual([table, 'sub_account_id', 'workspace'])
    }
    expect(t.activity).toHaveBeenCalledOnce()
  })
  it.each(['withdrawn', 'none', 'unknown'])('blocks %s without provider/activity calls', async status => {
    const t = setup(); t.contact.consent_status = status
    expect(await sendEmailToContact(t.params)).toMatchObject({ ok: false, error: expect.stringContaining('no longer eligible') })
    expect(mocks.send).not.toHaveBeenCalled(); expect(t.activity).not.toHaveBeenCalled()
  })
  it.each(['missing', 'tag', 'address', 'token', 'suppression'])('blocks %s changes', async reason => {
    const t = setup()
    if (reason === 'missing') t.missing()
    if (reason === 'tag') t.contact.tags.push('do-not-contact')
    if (reason === 'address') t.contact.email = 'different@example.invalid'
    if (reason === 'token') t.contact.unsubscribe_token = 'changed'
    if (reason === 'suppression') t.suppress()
    expect(await sendEmailToContact(t.params)).toMatchObject({ ok: false, error: expect.stringContaining('not sent') })
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it.each(['contacts', 'broadcast_recipients', 'email_delivery_events'])('fails closed for %s read errors and thrown failures', async table => {
    for (const method of ['error', 'throws'] as const) {
      const t = setup(); t[method](table)
      await expect(assertMarketingEligibility(t.db, 'org', 'workspace', 'person', t.contact.email, 'token')).rejects.toThrow('could not be verified')
    }
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('blocks an automation email whose consent changes during the queue wait', async () => {
    const t = setup(); mocks.wait.mockImplementationOnce(() => { t.contact.consent_status = 'withdrawn' })
    expect(await sendEmailToContact({ ...t.params, activityMetadata: { automation_run_id: 'run' } })).toMatchObject({ ok: false })
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('allows the accepted first send but blocks another already queued send after withdrawal', async () => {
    const t = setup()
    mocks.send.mockImplementationOnce(async () => { t.contact.consent_status = 'withdrawn'; return { data: { id: 'first' }, error: null } })
    const results = await Promise.all([sendEmailToContact(t.params), sendEmailToContact(t.params)])
    expect(results[0]).toMatchObject({ ok: true, providerId: 'first' }); expect(results[1]).toMatchObject({ ok: false })
    expect(mocks.send).toHaveBeenCalledOnce(); expect(t.activity).toHaveBeenCalledOnce()
  })
  it.each(['consent', 'suppression'])('rechecks %s after 429 backoff and stops without another attempt', async reason => {
    const t = setup()
    mocks.send.mockImplementationOnce(async () => {
      if (reason === 'consent') t.contact.consent_status = 'withdrawn'; else t.suppress()
      return { data: null, error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'rate' }, headers: { 'retry-after': '2' } }
    })
    const result = await sendEmailToContact({ ...t.params, activityMetadata: { broadcast_id: 'campaign' } })
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('Marketing email not sent') })
    expect(mocks.send).toHaveBeenCalledOnce(); expect(t.activity).not.toHaveBeenCalled()
  })
  it('keeps payload/key and spacing stable when an eligible 429 retry succeeds', async () => {
    const t = setup(); mocks.send.mockResolvedValueOnce({ data: null, error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'rate' }, headers: null })
    expect(await sendEmailToContact({ ...t.params, activityMetadata: { broadcast_id: 'campaign' } })).toMatchObject({ ok: true })
    expect(mocks.send).toHaveBeenCalledTimes(2)
    expect(mocks.send.mock.calls[0][0]).toBe(mocks.send.mock.calls[1][0])
    expect(mocks.send.mock.calls[0][1]).toEqual(mocks.send.mock.calls[1][1])
    expect(mocks.wait).toHaveBeenCalledWith(1000)
    expect(t.filters.filter(f => f[0] === 'contacts' && f[1] === 'id')).toHaveLength(2)
  })
})
