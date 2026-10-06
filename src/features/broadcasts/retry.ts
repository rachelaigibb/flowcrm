import type { SupabaseClient } from '@supabase/supabase-js'
import { getEmailSettings, renderTemplate, sendEmailToContact } from '@/lib/messaging/send'
import { getBroadcastRecipients, type DeliveryContext } from './deliver'
import { isRetryableRateFailure } from './retry-policy'

// Explicit user action only. Never run from cron or select an entire failed campaign.
export async function retryRateLimitedRecipients(db: SupabaseClient, ctx: DeliveryContext, broadcastId: string, ids: string[]) {
  const selected = [...new Set(ids)]
  if (!selected.length || selected.length > 25) return { error: 'Select 1–25 rate-limited recipients' }
  const {data:b,error:be}=await db.from('broadcasts').select('*').eq('id',broadcastId).eq('org_id',ctx.orgId).eq('sub_account_id',ctx.subAccountId).single()
  if(be || !b || b.channel!=='email' || !['sent','failed'].includes(b.status)) return {error:'Only completed email broadcasts can be retried'}
  const {data:rows,error:re}=await db.from('broadcast_recipients').select('*').eq('broadcast_id',broadcastId).eq('org_id',ctx.orgId).eq('sub_account_id',ctx.subAccountId).in('id',selected)
  if(re || rows?.length!==selected.length || rows.some(r=>!r.contact_id || !isRetryableRateFailure(r))) return {error:'Every selection must be an explicitly rate-rejected, unaccepted recipient'}
  const settings=await getEmailSettings(db,ctx.subAccountId)
  if(!settings?.mailingAddress) return {error:'Original sender configuration unavailable'}
  const {data:sentActivities,error:senderError}=await db.from('activities').select('metadata').eq('org_id',ctx.orgId).eq('sub_account_id',ctx.subAccountId).contains('metadata',{broadcast_id:b.id})
  const originalSenders=(sentActivities??[]).filter(a=>a.metadata?.resend_id).map(a=>a.metadata.from)
  if(senderError || originalSenders.some(from=>from!==`${settings.fromName} <${settings.fromEmail}>`)) return {error:'Sender changed or could not be verified; inspect before retry'}
  const outcomes: {id:string;accepted:boolean;providerId?:string|null;error?:string}[]=[]
  for(const row of rows){
    // Recheck current eligibility for exactly this recorded contact, never audience tags.
    const {data:contacts,error:ce}=await getBroadcastRecipients(db,ctx,{contact_ids:[row.contact_id]},'email')
    const contact=contacts?.[0]
    if(ce || !contact || contact.email!==row.address){outcomes.push({id:row.id,accepted:false,error:'Recipient changed or no longer eligible'});continue}
    const {data:prior,error:ae}=await db.from('activities').select('metadata').eq('contact_id',row.contact_id).eq('org_id',ctx.orgId).eq('sub_account_id',ctx.subAccountId).contains('metadata',{broadcast_id:b.id})
    if(ae || prior?.some(a=>a.metadata?.resend_id)){outcomes.push({id:row.id,accepted:false,error:'Prior acceptance exists or could not be ruled out'});continue}
    const {data:previous,error:pe}=await db.from('broadcast_recipients').select('provider_id').eq('contact_id',row.contact_id).eq('sub_account_id',ctx.subAccountId).not('provider_id','is',null)
    if(pe){outcomes.push({id:row.id,accepted:false,error:'Could not check suppression evidence'});continue}
    if(previous?.length){
      const {data:issues,error:ie}=await db.from('email_delivery_events').select('event_id').in('provider_id',previous.map(r=>r.provider_id)).in('event_type',['email.bounced','email.complained','email.suppressed']).limit(1)
      if(ie || issues?.length){outcomes.push({id:row.id,accepted:false,error:'Suppression evidence exists or could not be checked'});continue}
    }
    // Atomic compare-and-swap prevents double click / concurrent caller duplicates.
    // A crash or uncertain result stays non-retryable; no timeout automatically releases it.
    const {data:claimed,error:claimError}=await db.from('broadcast_recipients').update({status:'pending',error:'Retry in progress; verify provider acceptance before further action'})
      .eq('id',row.id).eq('broadcast_id',b.id).eq('sub_account_id',ctx.subAccountId).eq('status','failed').is('provider_id',null).is('sent_at',null).eq('error',row.error).select('id')
    if(claimError || !claimed?.length){outcomes.push({id:row.id,accepted:false,error:'Recipient already claimed or changed'});continue}
    const result=await sendEmailToContact({supabase:db,...ctx,contact,settings,subject:renderTemplate(b.email_subject,contact),body:renderTemplate(b.email_body,contact),includeSignature:false,marketing:true,activityMetadata:{broadcast_id:b.id,broadcast_name:b.name,retry_reason:row.error}})
    const {error:saveError}=await db.from('broadcast_recipients').update({status:result.ok?'sent':'failed',sent_at:result.ok?new Date().toISOString():null,provider_id:result.ok?result.providerId:null,error:result.ok?null:result.error}).eq('id',row.id).eq('status','pending').eq('sub_account_id',ctx.subAccountId)
    outcomes.push({id:row.id,accepted:result.ok,...(result.ok?{providerId:result.providerId}: {error:result.error}),...(saveError?{error:'Result persistence uncertain; do not retry. Check provider ID.'}:{})})
  }
  // Recompute from durable snapshots. Do not change audience/content/schedule or sent_at.
  const {data:all,error:allError}=await db.from('broadcast_recipients').select('status').eq('broadcast_id',b.id).eq('sub_account_id',ctx.subAccountId)
  if(allError || !all) return {error:'Retry completed; recipient summary could not be read',outcomes}
  if(all){
    const {error:statsError}=await db.from('broadcasts').update({stats:{...b.stats,total:all.length,sent:all.filter(r=>r.status==='sent').length,failed:all.filter(r=>r.status==='failed').length}}).eq('id',b.id).eq('sub_account_id',ctx.subAccountId)
    if(statsError)return {error:'Retry results recorded; summary refresh failed',outcomes}
  }
  return {outcomes}
}
