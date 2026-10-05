// @vitest-environment node
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock=vi.hoisted(()=>({upsert:vi.fn(),client:vi.fn(),scope:vi.fn()}))
vi.mock('@/lib/supabase/service',()=>({createServiceClient:mock.client}))
import { POST } from '@/app/api/webhooks/resend/route'
// Synthetic fixture only. Not a provider credential or configured signing secret.
const key=Buffer.from('local-test-fixture-only-1234567890')
const body=JSON.stringify({type:'email.delivered',created_at:'2026-10-05T12:00:00Z',data:{email_id:'provider'}})
function request(payload=body,timestamp=Math.floor(Date.now()/1000),signedPayload=payload){
 const signature=createHmac('sha256',key).update(`evt.${timestamp}.${signedPayload}`).digest('base64')
 return new Request('http://localhost/api/webhooks/resend',{method:'POST',body:payload,headers:{'svix-id':'evt','svix-timestamp':String(timestamp),'svix-signature':`v1,${signature}`}})
}
beforeEach(()=>{vi.stubEnv('RESEND_WEBHOOK_SECRET',`whsec_${key.toString('base64')}`);mock.upsert.mockReset().mockResolvedValue({error:null});mock.scope.mockReset().mockResolvedValue({data:{provider_id:'provider'},error:null});mock.client.mockReset().mockReturnValue({from:(table:string)=>{const q={select:()=>q,eq:()=>q,maybeSingle:mock.scope,upsert:mock.upsert};return table==='email_delivery_events'?{upsert:mock.upsert}:q}})})
afterEach(()=>vi.unstubAllEnvs())
describe('Resend webhook boundary',()=>{
 it('fails closed when not configured',async()=>{vi.stubEnv('RESEND_WEBHOOK_SECRET','');expect((await POST(request())).status).toBe(503);expect(mock.client).not.toHaveBeenCalled()})
 it('rejects missing signatures, changed raw bodies and stale replay signatures',async()=>{
  expect((await POST(new Request('http://localhost',{method:'POST',body}))).status).toBe(400)
  expect((await POST(request(body+' ',undefined,body))).status).toBe(400)
  expect((await POST(request(body,1))).status).toBe(400)
  expect(mock.client).not.toHaveBeenCalled()
 })
 it('acknowledges only after durable storage and never overwrites duplicate event IDs',async()=>{
  let finish:(value:{error:null})=>void=()=>{}
  mock.upsert.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  let returned=false;const response=POST(request()).then(r=>{returned=true;return r})
  await vi.waitFor(()=>expect(mock.upsert).toHaveBeenCalled());expect(returned).toBe(false)
  finish({error:null});expect((await response).status).toBe(200)
  expect((await POST(request())).status).toBe(200)
  expect(mock.upsert).toHaveBeenCalledWith(expect.objectContaining({event_id:'evt',provider_id:'provider'}),{onConflict:'event_id',ignoreDuplicates:true})
 })
 it('ignores unrelated provider messages',async()=>{mock.scope.mockResolvedValue({data:null,error:null});expect((await POST(request())).status).toBe(200);expect(mock.upsert).not.toHaveBeenCalled()})
 it('retries scope lookup failures without accepting or storing unscoped events',async()=>{mock.scope.mockResolvedValue({data:null,error:{message:'unavailable'}});expect((await POST(request())).status).toBe(503);expect(mock.upsert).not.toHaveBeenCalled()})
 it('returns a retryable failure on storage failure',async()=>{mock.upsert.mockResolvedValue({error:{message:'database unavailable'}});expect((await POST(request())).status).toBe(503)})
 it('ignores opens and rejects malformed supported events without touching storage',async()=>{
  expect((await POST(request(JSON.stringify({type:'email.opened'})))).status).toBe(200)
  expect((await POST(request(JSON.stringify({type:'email.clicked',data:{}})))).status).toBe(400)
  expect(mock.client).not.toHaveBeenCalled()
 })
})
