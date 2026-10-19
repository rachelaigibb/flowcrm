// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({context:vi.fn(),eligibility:vi.fn(),send:vi.fn()}))
vi.mock('@/lib/supabase/get-user-context',()=>({getUserContext:mocks.context}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/messaging/marketing-eligibility',()=>({assertMarketingEligibility:mocks.eligibility}))
vi.mock('@/lib/messaging/send',()=>({getEmailSettings:vi.fn().mockResolvedValue({fromEmail:'sender@example.invalid'}),getSmsSettings:vi.fn(),sendEmailToContact:mocks.send,sendSmsToContact:mocks.send,renderTemplate:(s:string)=>s}))
import { addContactsToBroadcast, getEditableBroadcasts, previewContactAudience } from '@/features/broadcasts/contact-audience-actions'
import { updateBroadcast } from '@/features/broadcasts/actions'
import { deliverBroadcast, getBroadcastRecipients } from '@/features/broadcasts/deliver'
import { mergeAudience, normalizeAudience } from '@/features/broadcasts/audience'
import type { SupabaseClient } from '@supabase/supabase-js'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const ctx={orgId:'org',subAccountId:'workspace',userId:'user'}
type Row=Record<string,any>
let contacts:Row[], broadcasts:Row[], writes:Row[], beforeUpdate:(()=>void)|undefined, db:SupabaseClient
function base(n:number,filter:unknown,status='draft'):Row {return {id:id(n),org_id:'org',sub_account_id:'workspace',name:`Campaign ${n}`,channel:'email',status,recipient_filter:filter,scheduled_at:status==='scheduled'?'2026-12-01T20:00:00Z':null,updated_at:'v1',email_subject:'Subject',email_body:'Body'}}
function memoryDb(){
 return {from(table:string){
  const rows=table==='contacts'?contacts:broadcasts
  let op='read', values:Row={}, predicate:(r:Row)=>boolean=()=>true, head=false
  const add=(test:(r:Row)=>boolean)=>{const old=predicate;predicate=r=>old(r)&&test(r);return q}
  const execute=()=>{
   if(op==='insert'){
    if(rows.some(r=>r.id===values.id))return {data:null,error:{message:'duplicate'}}
    rows.push({...values,updated_at:'created'});writes.push({table,op,values});return {data:values,error:null}
   }
   if(op==='update'&&beforeUpdate){const f=beforeUpdate;beforeUpdate=undefined;f()}
   const found=rows.filter(predicate)
   if(op==='update')for(const r of found){Object.assign(r,values,{updated_at:'v'+(writes.length+2)});writes.push({table,op,values})}
   return {data:head?null:found,count:found.length,error:null}
  }
  const q:any={
   select:(_s:string,opts?:{head?:boolean})=>{head=!!opts?.head;return q},
   eq:(k:string,v:unknown)=>add(r=>r[k]===v),in:(k:string,v:unknown[])=>add(r=>v.includes(r[k])),
   not:(k:string,operator:string)=>add(r=>operator==='cs'?!(r.tags??[]).includes('do-not-contact'):r[k]!=null),
   order:()=>q,
   or:(condition:string)=>add(r=>[...condition.matchAll(/tags\.(ov|cs)\.\{([^}]*)\}|source\.in\.\(([^)]*)\)|id\.in\.\(([^)]*)\)/g)].some(m=>{
    if(m[1]){const tags=JSON.parse(`[${m[2]}]`) as string[];return m[1]==='cs'?tags.every(t=>(r.tags??[]).includes(t)):tags.some(t=>(r.tags??[]).includes(t))}
    if(m[3])return m[3].split(',').includes(r.source)
    return (JSON.parse(`[${m[4]}]`) as string[]).includes(r.id)
   })),
   update:(v:Row)=>{op='update';values=v;return q},insert:(v:Row)=>{op='insert';values=v;return q},
   single:async()=>{const r=execute();return {...r,data:Array.isArray(r.data)?r.data[0]:r.data}},
   maybeSingle:async()=>{const r=execute();return {...r,data:Array.isArray(r.data)?r.data[0]:r.data}},
   then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(execute()).then(resolve),
  };return q
 }} as unknown as SupabaseClient
}
beforeEach(()=>{
 contacts=[
  {id:id(1),first_name:'Existing',email:'one@example.invalid',phone:'123',consent_status:'explicit',tags:['Buyer'],unsubscribe_token:'one'},
  {id:id(2),first_name:'Added',email:'two@example.invalid',phone:'456',consent_status:'implied',tags:[],unsubscribe_token:'two'},
  {id:id(3),first_name:'No consent',email:'three@example.invalid',phone:'789',consent_status:'none',tags:[]},
  {id:id(4),first_name:'Blocked',email:'four@example.invalid',phone:'111',consent_status:'explicit',tags:['do-not-contact']},
  {id:id(5),first_name:'No method',email:null,phone:null,consent_status:'explicit',tags:[]},
 ].map(c=>({...c,org_id:'org',sub_account_id:'workspace'}))
 contacts.push({...contacts[0],id:id(6),sub_account_id:'foreign'})
 broadcasts=[base(10,{contact_ids:[id(1)]}),base(11,{tags:['Buyer'],tag_match:'all'},'scheduled'),base(12,{all:true}),base(13,{},'sent'),{...base(14,{}),sub_account_id:'foreign'},base(15,{})]
 writes=[];beforeUpdate=undefined;db=memoryDb()
 mocks.context.mockResolvedValue({...ctx,supabase:db});mocks.eligibility.mockReset().mockResolvedValue(undefined);mocks.send.mockReset()
})
it('preserves each audience shape and rejects malformed additions',()=>{
 expect(mergeAudience({contact_ids:[id(1)]},[id(1),id(2)])).toEqual({contact_ids:[id(1),id(2)]})
 expect(mergeAudience({tags:['Buyer'],tag_match:'all',sources:['Referral']},[id(2)])).toEqual({tags:['Buyer'],tag_match:'all',sources:['Referral'],additional_contact_ids:[id(2)]})
 expect(mergeAudience({all:true},[id(2)])).toEqual({all:true})
 expect(normalizeAudience({tags:['Buyer'],additional_contact_ids:'broken'})).toBeNull()
})
it('lists only editable broadcasts in the current workspace',async()=>{
 expect((await getEditableBroadcasts()).data?.map(b=>b.id)).toEqual([id(10),id(11),id(12),id(15)])
})
it('previews duplicates, new contacts and exclusions, then merges a draft without touching content',async()=>{
 const target={kind:'existing' as const,id:id(10)}, ids=[id(1),id(2),id(2),id(3),id(4),id(5)]
 const preview=await previewContactAudience(ids,target)
 expect(preview.data).toMatchObject({added:1,alreadyIncluded:1,total:2})
 expect(preview.data?.excluded).toHaveLength(3)
 const result=await addContactsToBroadcast(ids,target,preview.data!.token)
 expect(result.data?.id).toBe(id(10))
 expect(broadcasts[0]).toMatchObject({status:'draft',email_body:'Body',recipient_filter:{contact_ids:[id(1),id(2)]}})
 expect(writes[0].values).not.toHaveProperty('scheduled_at');expect(mocks.send).not.toHaveBeenCalled()
})
it('retains tag AND logic and a scheduled send time; count and delivery include additions',async()=>{
 const target={kind:'existing' as const,id:id(11)}
 const preview=await previewContactAudience([id(2)],target)
 expect(preview.data).toMatchObject({added:1,total:2,scheduledAt:'2026-12-01T20:00:00Z'})
 expect((await addContactsToBroadcast([id(2)],target,preview.data!.token)).error).toBeUndefined()
 expect(broadcasts[1]).toMatchObject({status:'scheduled',scheduled_at:'2026-12-01T20:00:00Z',recipient_filter:{tags:['Buyer'],tag_match:'all',additional_contact_ids:[id(2)]}})
 for(const countOnly of [false,true]){
  const r=await getBroadcastRecipients(db,ctx,broadcasts[1].recipient_filter,'email',countOnly)
  expect(countOnly?r.count:r.data?.length).toBe(2)
 }
})
it('creates a fixed-audience draft and reuses its ID after a retried confirmation',async()=>{
 const target={kind:'new' as const,name:'Picked contacts',channel:'sms' as const,draftId:id(20)}
 const preview=await previewContactAudience([id(2),id(3)],target)
 expect(preview.data?.added).toBe(1)
 expect((await addContactsToBroadcast([id(2),id(3)],target,preview.data!.token)).data?.id).toBe(id(20))
 await addContactsToBroadcast([id(2),id(3)],target,preview.data!.token)
 expect(broadcasts.filter(b=>b.id===id(20))).toHaveLength(1)
 expect(broadcasts.at(-1)).toMatchObject({status:'draft',channel:'sms',recipient_filter:{contact_ids:[id(2)]}})
})
it('handles an all-contact audience without duplicating it and an empty draft with explicit additions',async()=>{
 expect((await previewContactAudience([id(2)],{kind:'existing',id:id(12)})).data).toMatchObject({added:0,alreadyIncluded:1})
 const target={kind:'existing' as const,id:id(15)}, p=await previewContactAudience([id(2)],target)
 await addContactsToBroadcast([id(2)],target,p.data!.token)
 expect(broadcasts[5].recipient_filter).toEqual({additional_contact_ids:[id(2)]})
})
it('refuses foreign IDs, foreign destinations, completed broadcasts, invalid or oversized selections',async()=>{
 for(const [ids,target] of [[[id(6)],{kind:'existing',id:id(10)}],[[id(2)],{kind:'existing',id:id(14)}],[[id(2)],{kind:'existing',id:id(13)}],[[],{kind:'existing',id:id(10)}],[Array(501).fill(id(2)),{kind:'existing',id:id(10)}]] as const){
  expect((await previewContactAudience([...ids],target)).error).toBeTruthy()
 }
 expect(writes).toHaveLength(0)
})
it('rechecks eligibility and rejects changed previews before writing',async()=>{
 const target={kind:'existing' as const,id:id(10)},p=await previewContactAudience([id(2)],target)
 contacts[1].consent_status='withdrawn'
 expect((await addContactsToBroadcast([id(2)],target,p.data!.token)).error).toMatch(/changed/)
 expect(writes).toHaveLength(0)
})
it('excludes suppression evidence and fails closed when eligibility verification fails',async()=>{
 mocks.eligibility.mockRejectedValue(new Error('Suppression evidence exists'))
 const p=await previewContactAudience([id(2)],{kind:'existing',id:id(10)})
 expect(p.data).toMatchObject({added:0,excluded:[{name:'Added',reason:'Suppression evidence exists'}]})
})
it('does not alter a broadcast that starts sending between preview and update',async()=>{
 const target={kind:'existing' as const,id:id(11)},p=await previewContactAudience([id(2)],target)
 beforeUpdate=()=>{broadcasts[1].status='sending'}
 expect((await addContactsToBroadcast([id(2)],target,p.data!.token)).error).toMatch(/started sending/)
 expect(broadcasts[1].recipient_filter).not.toHaveProperty('additional_contact_ids')
 expect(writes).toHaveLength(0)
})
it('does not lose a concurrent addition or schedule change after preview',async()=>{
 const target={kind:'existing' as const,id:id(11)},p=await previewContactAudience([id(2)],target)
 broadcasts[1].updated_at='v2';broadcasts[1].scheduled_at='2026-12-02T20:00:00Z'
 expect((await addContactsToBroadcast([id(2)],target,p.data!.token)).error).toMatch(/changed/)
 expect(broadcasts[1].scheduled_at).toBe('2026-12-02T20:00:00Z')
 expect(writes).toHaveLength(0)
})
it('rejects stale editors before they can overwrite a newly merged audience',async()=>{
 broadcasts[0].updated_at='v2'
 const r=await updateBroadcast(id(10),{expected_updated_at:'v1',recipient_filter:{contact_ids:[]}})
 expect(r.error).toMatch(/changed/);expect(writes).toHaveLength(0)
})
it('does not send a stale audience if the broadcast changes before the send claim',async()=>{
 beforeUpdate=()=>{broadcasts[0].updated_at='v2';broadcasts[0].recipient_filter={contact_ids:[id(1),id(2)]}}
 const r=await deliverBroadcast(db,ctx,id(10))
 expect(r.ok).toBe(false);expect(mocks.send).not.toHaveBeenCalled();expect(writes).toHaveLength(0)
})
it('rejects a competing addition committed immediately before the conditional write',async()=>{
 const target={kind:'existing' as const,id:id(11)},p=await previewContactAudience([id(2)],target)
 beforeUpdate=()=>{broadcasts[1].updated_at='v2';broadcasts[1].recipient_filter={tags:['Buyer'],tag_match:'all',additional_contact_ids:[id(1)]}}
 expect((await addContactsToBroadcast([id(2)],target,p.data!.token)).error).toMatch(/changed/)
 expect(broadcasts[1].recipient_filter.additional_contact_ids).toEqual([id(1)])
 expect(writes).toHaveLength(0)
})
