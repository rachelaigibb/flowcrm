// @vitest-environment node
// Opt-in cross-repository test: CA_INQUIRY_WORKTREE points at the reviewed website candidate.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'
const root=process.env.CA_INQUIRY_WORKTREE
const suite=root?describe:describe.skip
suite('website intake transport contract',()=>{
 it('forwards submission identity and avoids duplicate fallback mail',async()=>{
  const source=readFileSync(`${root}/src/lib/crm/leads.ts`,'utf8')
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const bodies:Record<string,unknown>[]=[];let emails=0
  const exports:Record<string,unknown>={}
  const context={exports,require:(name:string)=>name==='@/lib/site'?{site:{email:'owner@example.invalid'}}:{sendEmail:async()=>{emails++;return {sent:true}}},process:{env:{FLOWCRM_ENABLED:'true',FLOWCRM_INTAKE_URL:'https://fixture.invalid/api/intake',FLOWCRM_INTAKE_KEY:'synthetic-key'}},console:{log:()=>{},error:()=>{}},AbortSignal,fetch:async(_url:string,options:{body:string})=>{bodies.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,duplicate:true,notified:false})}}}
  vm.runInNewContext(compiled,context)
  const deliver=exports.deliverLead as (lead:unknown)=>Promise<{crm:boolean}>
  const lead={name:'Fixture',email:'fixture@example.invalid',source:'contact-form',submissionId:'10000000-0000-4000-8000-000000000001'}
  expect((await deliver(lead)).crm).toBe(true)
  expect(bodies[0]).toMatchObject({submission_id:lead.submissionId,source:'rachelgibbrealtor.ca:contact-form'})
  expect(emails).toBe(0)
  Object.assign(context.process.env,{FLOWCRM_INTAKE_KEY:'',FLOWCRM_SUPABASE_URL:'https://legacy.invalid',FLOWCRM_SUPABASE_SERVICE_KEY:'synthetic-legacy-key',FLOWCRM_ORG_ID:'org',FLOWCRM_SUB_ACCOUNT_ID:'workspace'})
  expect((await deliver(lead)).crm).toBe(false)
  expect(bodies).toHaveLength(1) // no fallback to the contact-only legacy writer
  expect(emails).toBe(1) // existing internal notification fallback, mocked
 })
})

suite('website inquiry endpoint',()=>{
 it('requires inquiry IDs, preserves retries, and does not claim acceptance when CRM fails',async()=>{
  const {createRequire}=await import('node:module');const require=createRequire(import.meta.url)
  const source=readFileSync(`${root}/src/app/api/leads/route.ts`,'utf8')
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const exports:Record<string,unknown>={};const delivered:unknown[]=[];let crm=false
  vm.runInNewContext(compiled,{exports,require:(name:string)=>{
    if(name==='zod')return require(`${root}/node_modules/zod`)
    if(name==='next/server')return {NextResponse:{json:(body:unknown,init?:ResponseInit)=>Response.json(body,init)}}
    if(name==='@/lib/rate-limit')return {rateLimit:()=>true,clientKey:()=> 'fixture'}
    if(name==='@/lib/crm/leads')return {deliverLead:async(lead:unknown)=>{delivered.push(lead);return {crm,emailed:true}}}
    throw new Error(name)
  }})
  const post=exports.POST as (request:Request)=>Promise<Response>
  const payload={name:'Fixture',email:'fixture@example.invalid',consent:true,source:'contact-form'}
  const req=(body:unknown)=>new Request('https://fixture.invalid/api/leads',{method:'POST',body:JSON.stringify(body)})
  expect((await post(req(payload))).status).toBe(400);expect(delivered).toHaveLength(0)
  const withId={...payload,submission_id:'10000000-0000-4000-8000-000000000001'}
  expect((await post(req(withId))).status).toBe(503)
  crm=true;expect((await post(req(withId))).status).toBe(200)
  expect(delivered[0]).toMatchObject({submissionId:withId.submission_id})
  expect(delivered[1]).toEqual(delivered[0])
  expect((await post(req({...payload,source:'deal-list'}))).status).toBe(200)
 })
})
