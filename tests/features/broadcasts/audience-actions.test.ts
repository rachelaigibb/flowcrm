// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({context:vi.fn(),ready:vi.fn().mockResolvedValue(null),recipients:vi.fn().mockResolvedValue({count:0,error:null})}))
vi.mock('@/lib/supabase/get-user-context',()=>({getUserContext:mocks.context}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/features/broadcasts/deliver',()=>({checkBroadcastReady:mocks.ready,getBroadcastRecipients:mocks.recipients,deliverBroadcast:vi.fn()}))
import { createBroadcast, updateBroadcast, scheduleBroadcast } from '@/features/broadcasts/actions'
const insert=vi.fn(), update=vi.fn()
beforeEach(()=>{
 insert.mockReset();update.mockReset();mocks.recipients.mockClear()
 const q={select:()=>q,eq:()=>q,insert:(v:unknown)=>{insert(v);return q},update:(v:unknown)=>{update(v);return q},single:async()=>({data:{id:'draft',status:'draft',recipient_filter:{},channel:'email'},error:null})}
 mocks.context.mockResolvedValue({orgId:'org',subAccountId:'workspace',supabase:{from:()=>q}})
})
describe('audience mutation safeguards',()=>{
 it('creates an unconfigured draft instead of implicitly selecting all',async()=>{
  await createBroadcast({name:'New draft',channel:'email'})
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({recipient_filter:{},status:'draft'}))
 })
 it('persists clearing all selections as an empty audience',async()=>{
  await updateBroadcast('draft',{recipient_filter:{all:false,tags:[],sources:[]}})
  expect(update).toHaveBeenCalledWith(expect.objectContaining({recipient_filter:{}}))
 })
 it('rejects malformed direct save requests without a write',async()=>{
  const result=await updateBroadcast('draft',{recipient_filter:{all:'true'} as never})
  expect(result.error).toBe('Invalid recipient selection');expect(update).not.toHaveBeenCalled()
 })
 it('refuses to schedule a legacy empty draft',async()=>{
  const result=await scheduleBroadcast('draft',new Date(Date.now()+86400000).toISOString())
  expect(result.error).toContain('No eligible recipients');expect(update).not.toHaveBeenCalled()
  expect(mocks.recipients).toHaveBeenCalledWith(expect.anything(),{orgId:'org',subAccountId:'workspace'},{},'email',true)
 })
})
