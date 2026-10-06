// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ context: vi.fn() }))
vi.mock('@/lib/supabase/get-user-context', () => ({ getUserContext: mocks.context }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { getRecipientCount } from '@/features/broadcasts/actions'

const contacts = [
  { id: 'selected', org_id: 'org', sub_account_id: 'workspace', email: 'self@example.com', phone: '123', consent_status: 'explicit', tags: [] },
  { id: 'other', org_id: 'org', sub_account_id: 'workspace', email: 'other@example.com', phone: '456', consent_status: 'implied', tags: [] },
  { id: 'blocked', org_id: 'org', sub_account_id: 'workspace', email: 'blocked@example.com', phone: '789', consent_status: 'explicit', tags: ['do-not-contact'] },
  { id: 'no-consent', org_id: 'org', sub_account_id: 'workspace', email: 'none@example.com', phone: '999', consent_status: 'none', tags: [] },
  { id: 'foreign', org_id: 'org', sub_account_id: 'other-workspace', email: 'foreign@example.com', phone: '222', consent_status: 'explicit', tags: [] },
]
beforeEach(() => {
  mocks.context.mockImplementation(async () => {
    let rows = [...contacts]
    const query = {
      select: () => query,
      eq: (key: keyof typeof contacts[number], value: string) => { rows = rows.filter(row => row[key] === value); return query },
      in: (key: keyof typeof contacts[number], values: string[]) => { rows = rows.filter(row => values.includes(row[key] as string)); return query },
      not: (key: keyof typeof contacts[number], operator: string) => { rows = rows.filter(row => operator === 'cs' ? !row.tags.includes('do-not-contact') : row[key] != null); return query },
      or: () => { throw new Error('Fixed audience must not fall through to broad filters') },
      then: (resolve: (value: { count: number; error: null }) => unknown) => resolve({ count: rows.length, error: null }),
    }
    return { orgId: 'org', subAccountId: 'workspace', supabase: { from: () => query } }
  })
})
describe('recipient count audience boundaries', () => {
  it('counts only explicit contacts even when broader filters coexist', async () => {
    expect(await getRecipientCount({ contact_ids: ['selected'], all: true, tags: ['broad'] }, 'email')).toEqual({ data: 1 })
  })
  it('does not turn an empty fixed audience into the whole workspace', async () => {
    expect(await getRecipientCount({ contact_ids: [] }, 'email')).toEqual({ data: 0 })
  })
  it('excludes other workspaces, do-not-contact and missing consent', async () => {
    expect(await getRecipientCount({ contact_ids: ['selected', 'blocked', 'no-consent', 'foreign'] }, 'email')).toEqual({ data: 1 })
  })
  it('uses the same exclusions for all-contact counts and selected SMS counts', async () => {
    expect(await getRecipientCount({ all: true }, 'email')).toEqual({ data: 2 })
    expect(await getRecipientCount({ contact_ids: ['selected', 'blocked'] }, 'sms')).toEqual({ data: 1 })
  })
})

it.each([{}, { all: false }, { tags: [], sources: [] }, { all: 'true' }, { contact_ids: null, all: true }, null])('fails closed for unconfigured or malformed audience %j', async filter => {
  expect(await getRecipientCount(filter as Parameters<typeof getRecipientCount>[0], 'email')).toEqual({ data: 0 })
})
