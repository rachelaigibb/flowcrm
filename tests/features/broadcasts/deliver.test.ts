// @vitest-environment node
import {describe,it,expect,vi,beforeEach} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
const mocks=vi.hoisted(()=>({send:vi.fn(),settings:vi.fn()}))
vi.mock('@/lib/messaging/send',()=>({getEmailSettings:mocks.settings,getSmsSettings:vi.fn(),sendEmailToContact:mocks.send,sendSmsToContact:vi.fn(),renderTemplate:(s:string)=>s}))
import {deliverBroadcast,getBroadcastRecipients} from '@/features/broadcasts/deliver'
const ctx={orgId:'org',subAccountId:'workspace',userId:'user'}
function db(snapshotFails=false){
 const updates:Record<string,unknown>[]=[];const snapshots:unknown[]=[];const filters:unknown[]=[]
 const from=vi.fn((table:string)=>{
  let op='select';let value:Record<string,unknown>={}
  const q:Record<string,any>={}
  for(const method of ['select','eq','not','in','or','order'])q[method]=vi.fn((...args:unknown[])=>{filters.push([table,method,...args]);return q})
  q.insert=vi.fn((v:unknown)=>{op='insert';snapshots.push(v);return q})
  q.update=vi.fn((v:Record<string,unknown>)=>{op='update';value=v;updates.push(v);return q})
  q.single=()=>Promise.resolve({data:{id:'broadcast',name:'Wave 1',status:'draft',channel:'email',email_subject:'Hi',email_body:'Message',recipient_filter:{all:true}},error:null})
  q.then=(resolve:any)=>resolve(table==='contacts'?{data:[{id:'c1',first_name:'Rachel',last_name:'Gibb',company:'eXp',email:'self@test.invalid',phone:null}],error:null}:table==='broadcasts'?{data:op==='update'&&value.status==='sending'?[{id:'broadcast'}]:null,error:null}:{data:null,error:op==='insert'&&snapshotFails?{message:'disk error'}:null})
  return q
 });return {client:{from} as unknown as SupabaseClient,updates,snapshots,filters}
}
beforeEach(()=>{mocks.send.mockReset();mocks.settings.mockResolvedValue({fromEmail:'sender@test.invalid',mailingAddress:'Address',replyTo:'sender@test.invalid'})})
describe('broadcast recipient history',()=>{
 it('does not send anything when the permanent recipient snapshot fails',async()=>{const d=db(true);const r=await deliverBroadcast(d.client,ctx,'broadcast');expect(r.ok).toBe(false);expect(mocks.send).not.toHaveBeenCalled()})
 it('records acceptance and provider id and labels the contact activity',async()=>{mocks.send.mockResolvedValue({ok:true,providerId:'provider-1'});const d=db();await deliverBroadcast(d.client,ctx,'broadcast');expect(d.snapshots[0]).toEqual(expect.arrayContaining([expect.objectContaining({contact_id:'c1',address:'self@test.invalid',status:'pending'})]));expect(d.updates).toContainEqual(expect.objectContaining({status:'sent',provider_id:'provider-1'}));expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({activityMetadata:{broadcast_id:'broadcast',broadcast_name:'Wave 1'}}))})
 it('keeps provider engagement separate from send completion stats',async()=>{mocks.send.mockResolvedValue({ok:true,providerId:'provider-1'});const d=db();await deliverBroadcast(d.client,ctx,'broadcast');for(const update of d.updates){if(update.stats)expect(update.stats).not.toHaveProperty('opened');expect(update).not.toHaveProperty('engagement')}})
 it('stores per-recipient failure reasons',async()=>{mocks.send.mockResolvedValue({ok:false,error:'Rejected'});const d=db();await deliverBroadcast(d.client,ctx,'broadcast');expect(d.updates).toContainEqual(expect.objectContaining({status:'failed',error:'Rejected'}))})
 it('keeps explicit selected contacts narrower than all/tags and rechecks consent',async()=>{const d=db();await getBroadcastRecipients(d.client,ctx,{contact_ids:['c1'],all:true,tags:['other']},'email');expect(d.filters).toContainEqual(['contacts','in','id',['c1']]);expect(d.filters.some(f=>(f as string[])[1]==='or')).toBe(false);expect(d.filters).toContainEqual(['contacts','in','consent_status',['explicit','implied']])})
})
