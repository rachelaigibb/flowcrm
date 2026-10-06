// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Resend, CreateEmailResponse } from 'resend'
import { createPacedSender } from '@/lib/resend/send-paced'
const ok={data:{id:'accepted'},error:null,headers:null} as CreateEmailResponse
const rate={data:null,error:{name:'rate_limit_exceeded',statusCode:429,message:'Too many requests'},headers:{'retry-after':'2'}} as CreateEmailResponse
const payload={from:'a@example.com',to:'b@example.com',subject:'same',text:'same'}
function setup(responses: (CreateEmailResponse|Error)[]) {
 let now=0;const starts:number[]=[];const keys:string[]=[];const payloads:unknown[]=[]
 const send=createPacedSender(async ms=>{now+=ms},()=>now,()=>0)
 const client={emails:{send:async(p:unknown,o:{idempotencyKey:string})=>{starts.push(now);keys.push(o.idempotencyKey);payloads.push(p);const result=responses.shift()??ok;if(result instanceof Error)throw result;return result}}} as unknown as Resend
 return {send,client,starts,keys,payloads}
}
describe('paced Resend sends',()=>{
 it('serializes concurrent callers with at least600ms spacing',async()=>{const t=setup([]);await Promise.all([1,2,3].map(i=>t.send(t.client,payload,String(i))));expect(t.starts).toEqual([0,600,1200])})
 it('honors shared-account429 retry-after with the exact same payload and key',async()=>{const t=setup([rate,rate,ok]);await t.send(t.client,payload,'stable');expect(t.starts).toEqual([0,2000,4000]);expect(new Set(t.keys).size).toBe(1);expect(t.payloads.every(p=>p===payload)).toBe(true)})
 it('bounds rate retries to4 attempts',async()=>{const t=setup([rate,rate,rate,rate]);expect((await t.send(t.client,payload,'stable')).error?.statusCode).toBe(429);expect(t.starts).toHaveLength(4)})
 it('does not shorten long provider waits or retry quota/auth/5xx errors',async()=>{for(const error of [{...rate,headers:{'retry-after':'120'}},{...rate,error:{name:'daily_quota_exceeded',statusCode:429,message:'quota'}},{...rate,error:{name:'internal_server_error',statusCode:500,message:'unknown'}}] as CreateEmailResponse[]){const t=setup([error]);await t.send(t.client,payload,'stable');expect(t.starts).toHaveLength(1)}})
 it('never retries transport ambiguity and allows later independent calls',async()=>{const t=setup([new Error('timeout'),ok]);await expect(t.send(t.client,payload,'one')).rejects.toThrow('timeout');await t.send(t.client,payload,'two');expect(t.keys).toEqual(['one','two'])})
})
