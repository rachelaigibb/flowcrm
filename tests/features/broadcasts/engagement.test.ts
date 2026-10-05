// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { summarizeEngagement, matchesEngagement, safeLink } from '@/features/broadcasts/engagement'
import { normalizeResendEvent } from '@/features/broadcasts/resend-event'
import { isBroadcastEvent } from '@/features/broadcasts/event-scope'
import { attachEngagement } from '@/features/broadcasts/engagement-store'
import type { BroadcastRecipient, EmailDeliveryEvent } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
const event = (id:string,type:string,time:string,link:string|null=null):EmailDeliveryEvent => ({event_id:id,provider_id:'provider',event_type:type,occurred_at:`2026-10-05T${time}:00.000Z`,link})
describe('engagement evidence',()=>{
 it('deduplicates retries and sorts clicks by provider time, not arrival order',()=>{
  const a=event('a','email.clicked','10:00','https://example.com/a'), b=event('b','email.clicked','11:00','https://example.com/a')
  const result=summarizeEngagement([b,a,b,event('c','email.clicked','10:30','https://example.com/b')])
  expect(result).toMatchObject({clicks:3,firstClickedAt:a.occurred_at,lastClickedAt:b.occurred_at})
  expect(result.links).toHaveLength(2);expect(result.links[0].clicks).toBe(2)
  expect(result.deliveredAt).toBeNull() // A click is not a delivery event.
 })
 it('keeps historical absence unknown and manual intent out of event-derived state',()=>{
  const result=summarizeEngagement([])
  expect(result.deliveredAt).toBeNull();expect(result.firstClickedAt).toBeNull()
  expect(matchesEngagement(result,'unknown')).toBe(true);expect(matchesEngagement(result,'clicked')).toBe(false)
  expect(result).not.toHaveProperty('follow_up_status')
 })
 it('resolves an earlier delay after delivery but keeps bounce/complaint evidence',()=>{
  const delivered=event('d','email.delivered','12:00')
  expect(summarizeEngagement([delivered,event('delay','email.delivery_delayed','11:00')]).issue).toBeNull()
  expect(summarizeEngagement([event('b','email.bounced','13:00'),delivered,event('late-delay','email.delivery_delayed','14:00')]).issue).toBe('email.bounced')
 })
 it('whitelists payload data, uses click time and ignores opens',()=>{
  const e=normalizeResendEvent({type:'email.clicked',created_at:'2026-10-05T12:00:00Z',data:{email_id:'provider',to:['private@example.com'],click:{timestamp:'2026-10-05T11:00:00Z',link:'https://example.com',ipAddress:'192.0.2.1',userAgent:'bot'}}},'evt')
  expect(e).toEqual(event('evt','email.clicked','11:00','https://example.com'))
  expect(normalizeResendEvent({type:'email.opened'},'evt')).toBeNull()
  expect(()=>normalizeResendEvent({type:'email.clicked',data:{email_id:'provider'},created_at:'bad'},'evt')).toThrow()
 })
 it('never makes script URLs clickable',()=>{expect(safeLink('javascript:alert(1)')).toBeUndefined();expect(safeLink('https://example.com')).toBe('https://example.com')})
 it('matches previously stored events after provider ID persistence; preserves manual outcomes',async()=>{
  const from=vi.fn(()=>{const q={select:()=>q,in:()=>q,order:()=>q,range:async()=>({data:[event('e','email.clicked','11:00','https://example.com')],error:null})};return q})
  const db={from} as unknown as SupabaseClient
  const row={provider_id:null,follow_up_status:'replied'} as BroadcastRecipient
  expect((await attachEngagement(db,[row]))[0].engagement.clicks).toBe(0);expect(from).not.toHaveBeenCalled()
  const matched=await attachEngagement(db,[{...row,provider_id:'provider'}])
  expect(matched[0].engagement.clicks).toBe(1);expect(matched[0].follow_up_status).toBe('replied')
 })
 it('fails visibly on database errors rather than reporting zero engagement',async()=>{
  const q={select:()=>q,in:()=>q,order:()=>q,range:async()=>({error:{message:'missing migration'}})}
  await expect(attachEngagement({from:()=>q} as unknown as SupabaseClient,[{provider_id:'provider'} as BroadcastRecipient])).rejects.toThrow('Engagement could not be loaded')
 })
})

describe('broadcast event scope',()=>{
 it('uses signed tags for early events, rejects mismatched providers and unrelated mail',async()=>{
  const filters:unknown[]=[]
  let row:{provider_id:string|null}|null={provider_id:null}
  const q={select:()=>q,eq:(...args:unknown[])=>{filters.push(args);return q},maybeSingle:async()=>({data:row,error:null})}
  const db={from:()=>q} as unknown as SupabaseClient
  const tags={flowcrm_broadcast_id:'00000000-0000-0000-0000-000000000001',flowcrm_contact_id:'00000000-0000-0000-0000-000000000002'}
  const e=event('a','email.delivered','12:00')
  expect(await isBroadcastEvent(db,e,{data:{tags}})).toBe(true)
  expect(filters).toContainEqual(['broadcast_id',tags.flowcrm_broadcast_id]);expect(filters).toContainEqual(['contact_id',tags.flowcrm_contact_id])
  row={provider_id:'different'};expect(await isBroadcastEvent(db,e,{data:{tags}})).toBe(false)
  row=null;expect(await isBroadcastEvent(db,e,{data:{}})).toBe(false)
  expect(filters).toContainEqual(['provider_id','provider'])
  expect(await isBroadcastEvent(db,e,{data:{tags:{flowcrm_broadcast_id:'invalid'}}})).toBe(false)
 })
})
