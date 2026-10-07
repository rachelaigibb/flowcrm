// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({rpc:vi.fn(),notify:vi.fn()}))
vi.mock('@/lib/supabase/anon',()=>({createAnonClient:()=>({rpc:mocks.rpc})}))
vi.mock('@/lib/rate-limit',()=>({rateLimit:()=>true,clientKey:()=> 'fixture'}))
vi.mock('@/features/intake/notify',()=>({sendIntakeNotification:mocks.notify}))
import { POST } from '@/app/api/intake/route'
const payload={name:'Fixture Person',email:'fixture@example.invalid',consent:true,source:'rachelgibbrealtor.ca:contact-form',submission_id:'10000000-0000-0000-0000-000000000001'}
const request=(body=payload)=>new Request('https://fixture.invalid/api/intake',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-key-123456'},body:JSON.stringify(body)})
beforeEach(()=>{mocks.rpc.mockReset();mocks.notify.mockReset().mockResolvedValue(true)})
it('passes the stable ID into atomic intake and returns its task ID',async()=>{
 mocks.rpc.mockResolvedValue({data:{contact_id:'contact',created:true,task_id:'task',duplicate:false},error:null})
 expect(await (await POST(request())).json()).toMatchObject({ok:true,task_id:'task',duplicate:false,notified:true})
 expect(mocks.rpc).toHaveBeenCalledWith('intake_contact',expect.objectContaining({p_payload:expect.objectContaining({submission_id:payload.submission_id})}))
 expect(mocks.notify).toHaveBeenCalledOnce()
})
it('does not send another notification for accepted retries',async()=>{
 mocks.rpc.mockResolvedValue({data:{contact_id:'contact',created:true,task_id:'task',duplicate:true},error:null})
 expect(await (await POST(request())).json()).toMatchObject({ok:true,task_id:'task',duplicate:true,notified:false})
 expect(mocks.notify).not.toHaveBeenCalled()
})
it('returns conflict when an ID is reused with different content',async()=>{
 mocks.rpc.mockResolvedValue({data:{error:'submission_conflict'},error:null})
 expect((await POST(request())).status).toBe(409);expect(mocks.notify).not.toHaveBeenCalled()
})
it('does not notify or claim success after transaction failure',async()=>{
 mocks.rpc.mockResolvedValue({data:null,error:{message:'task failed'}})
 expect((await POST(request())).status).toBe(500);expect(mocks.notify).not.toHaveBeenCalled()
})
it('rejects malformed IDs before any database operation',async()=>{
 expect((await POST(request({...payload,submission_id:'bad'}))).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled()
})
