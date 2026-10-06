// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
const mocks=vi.hoisted(()=>({send:vi.fn(),eligible:vi.fn(),settings:vi.fn()}))
vi.mock('@/lib/messaging/send',()=>({getEmailSettings:mocks.settings,renderTemplate:(s:string)=>s,sendEmailToContact:mocks.send}))
vi.mock('@/features/broadcasts/deliver',()=>({getBroadcastRecipients:mocks.eligible}))
import { retryRateLimitedRecipients } from '@/features/broadcasts/retry'
const ctx={orgId:'org',subAccountId:'workspace',userId:'owner'}
const rejection='Too many requests. You can only make 10 requests per second. See rate limit response headers for more information.'
function setup(){
 const rows:any[]=[{id:'failed',contact_id:'contact',broadcast_id:'broadcast',org_id:'org',sub_account_id:'workspace',address:'self@example.com',status:'failed',provider_id:null,sent_at:null,error:rejection},{id:'accepted',contact_id:'other',broadcast_id:'broadcast',org_id:'org',sub_account_id:'workspace',status:'sent',provider_id:'previous',sent_at:'earlier',error:null}]
 const campaign:any={id:'broadcast',org_id:'org',sub_account_id:'workspace',status:'sent',channel:'email',name:'Original',email_subject:'Subject',email_body:'Original content',stats:{total:2,sent:1,failed:1}}
 let prior=false;let suppressed=false
 const db={from:(table:string)=>{let data=table==='broadcasts'?[campaign]:table==='broadcast_recipients'?rows:table==='activities'?(prior?[{contact_id:'contact',org_id:'org',sub_account_id:'workspace',metadata:{resend_id:'existing',from:'undefined <undefined>'}}]:[]):suppressed?[{event_id:'suppressed'}]:[];let update:any
 const q:any={select:()=>q,eq:(k:string,v:any)=>{data=data.filter((r:any)=>r[k]===v);return q},in:(k:string,v:any[])=>{if(table!=='email_delivery_events')data=data.filter((r:any)=>v.includes(r[k]));return q},is:(k:string,v:any)=>{data=data.filter((r:any)=>r[k]===v);return q},not:(k:string)=>{data=data.filter((r:any)=>r[k]!=null);return q},contains:()=>q,limit:()=>q,update:(v:any)=>{update=v;return q},single:async()=>({data:data[0],error:null}),then:(resolve:any)=>{if(update){data=data.filter((r:any)=>r.status!== 'pending'||update.status!=='pending');data.forEach((r:any)=>Object.assign(r,update))}return resolve({data:data.map((r:any)=>({...r})),error:null})}};return q}} as unknown as SupabaseClient
 return {db,rows,campaign,prior:()=>{prior=true},suppress:()=>{suppressed=true;rows.push({...rows[1],id:'past',contact_id:'contact'})}}
}
beforeEach(()=>{mocks.send.mockReset().mockResolvedValue({ok:true,providerId:'new',activityId:'activity'});mocks.settings.mockResolvedValue({mailingAddress:'Original address'});mocks.eligible.mockResolvedValue({data:[{id:'contact',email:'self@example.com'}],error:null})})
describe('explicit rejected-recipient retry',()=>{
 it('claims only the selected failed row and preserves accepted recipients',async()=>{const t=setup();const before={...t.rows[1]};await retryRateLimitedRecipients(t.db,ctx,'broadcast',['failed']);expect(mocks.send).toHaveBeenCalledTimes(1);expect(t.rows[0]).toMatchObject({status:'sent',provider_id:'new'});expect(t.rows[1]).toEqual(before);expect(t.campaign.stats).toMatchObject({total:2,sent:2,failed:0});expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({subject:'Subject',body:'Original content',includeSignature:false}))})
 it.each(['accepted','missing'])('refuses accepted/missing selection %s',async id=>{const t=setup();expect((await retryRateLimitedRecipients(t.db,ctx,'broadcast',[id])).error).toBeTruthy();expect(mocks.send).not.toHaveBeenCalled()})
 it('blocks an ambiguous prior result',async()=>{const t=setup();t.rows[0].error='Acceptance unknown: timeout';expect((await retryRateLimitedRecipients(t.db,ctx,'broadcast',['failed'])).error).toBeTruthy();expect(mocks.send).not.toHaveBeenCalled()})
 it('blocks changed address, lost eligibility, prior acceptance and suppression',async()=>{for(const reason of ['address','eligibility','prior','suppressed']){const t=setup();mocks.eligible.mockResolvedValue({data:reason==='eligibility'?[]:[{id:'contact',email:reason==='address'?'changed@example.com':'self@example.com'}]});if(reason==='prior')t.prior();if(reason==='suppressed')t.suppress();await retryRateLimitedRecipients(t.db,ctx,'broadcast',['failed']);expect(mocks.send).not.toHaveBeenCalled()}})
 it('cannot send an already claimed row or resend after success',async()=>{const t=setup();await retryRateLimitedRecipients(t.db,ctx,'broadcast',['failed']);await retryRateLimitedRecipients(t.db,ctx,'broadcast',['failed']);expect(mocks.send).toHaveBeenCalledTimes(1);const u=setup();u.rows[0].status='pending';await retryRateLimitedRecipients(u.db,ctx,'broadcast',['failed']);expect(mocks.send).toHaveBeenCalledTimes(1)})
})
