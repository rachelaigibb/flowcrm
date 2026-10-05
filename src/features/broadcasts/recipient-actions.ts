"use server"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { revalidatePath } from "next/cache"
import { attachEngagement } from "./engagement-store"
import type { BroadcastRecipient } from "@/types/database"

export async function getBroadcastHistory(id: string) {
 const {supabase,orgId,subAccountId}=await getUserContext()
 const rows: BroadcastRecipient[] = []
 for (let offset=0;;offset+=500) {
  const {data,error}=await supabase.from('broadcast_recipients').select('*').eq('broadcast_id',id).eq('org_id',orgId).eq('sub_account_id',subAccountId).order('id').range(offset,offset+499)
  if(error)return {data:[],error:error.message}
  rows.push(...(data??[]) as BroadcastRecipient[])
  if((data?.length??0)<500)break
 }
 try { return {data:await attachEngagement(supabase,rows),error:undefined} }
 catch { return {data:[],error:'Engagement could not be loaded. Confirm reporting setup and refresh.'} }

}
export async function updateBroadcastOutcome(id:string,ids:string[],outcome:BroadcastRecipient['follow_up_status']) {
 if(!['not_followed_up','followed_up','interested','declined','replied'].includes(outcome)||!ids.length||ids.length>500)return {error:'Invalid selection'}
 const {supabase,orgId,subAccountId}=await getUserContext()
 const {error}=await supabase.from('broadcast_recipients').update({follow_up_status:outcome}).eq('broadcast_id',id).eq('org_id',orgId).eq('sub_account_id',subAccountId).in('id',ids)
 revalidatePath(`/broadcasts/${id}`)
 return {error:error?.message}
}
export async function createBroadcastTasks(id:string,ids:string[],due:string) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!ids.length||ids.length>500)return {error:'Select recipients and a valid date'}
 const {supabase,orgId,subAccountId}=await getUserContext()
 const {data:b}=await supabase.from('broadcasts').select('id').eq('id',id).eq('org_id',orgId).eq('sub_account_id',subAccountId).single()
 if(!b)return {error:'Broadcast not found'}
 const {data,error}=await supabase.rpc('create_broadcast_followups',{p_broadcast:id,p_recipients:ids,p_due:due})
 revalidatePath('/tasks');revalidatePath(`/broadcasts/${id}`)
 return {count:data as number,error:error?.message}
}
export async function createBroadcastFollowupDraft(id:string,ids:string[]) {
 if(!ids.length||ids.length>500)return {error:'Select recipients first'}
 const {supabase,orgId,subAccountId}=await getUserContext()
 const {data:b}=await supabase.from('broadcasts').select('*').eq('id',id).eq('org_id',orgId).eq('sub_account_id',subAccountId).single()
 if(!b || b.channel!=='email')return {error:'Email broadcast not found'}
 const {data:rows,error}=await supabase.from('broadcast_recipients').select('contact_id,follow_up_status').eq('broadcast_id',id).eq('org_id',orgId).eq('sub_account_id',subAccountId).eq('status','sent').in('id',ids).not('contact_id','is',null).not('follow_up_status','in','(declined,replied)')
 if(error)return {error:error.message}
 const contactIds=(rows??[]).map(r=>r.contact_id)
 if(!contactIds.length)return {error:'No eligible sent recipients selected'}
 const {data:contacts,error:ce}=await supabase.from('contacts').select('id,tags').eq('org_id',orgId).eq('sub_account_id',subAccountId).in('id',contactIds).in('consent_status',['explicit','implied']).not('email','is',null)
 if(ce)return {error:ce.message}
 const eligible=(contacts??[]).filter(c=>!(c.tags??[]).includes('do-not-contact')).map(c=>c.id)
 if(!eligible.length)return {error:'No eligible recipients remain'}
 const {data:d,error:de}=await supabase.from('broadcasts').insert({org_id:orgId,sub_account_id:subAccountId,name:`Follow-up — ${b.name}`,channel:'email',status:'draft',email_subject:`Follow-up: ${b.email_subject??b.name}`,email_body:'',recipient_filter:{contact_ids:eligible},stats:{total:0,sent:0,failed:0}}).select('id').single()
 revalidatePath('/broadcasts')
 return {id:d?.id,error:de?.message}
}

export async function markBroadcastCallFollowup(id:string,contactId:string) {
 const {supabase,orgId,subAccountId}=await getUserContext()
 const {error}=await supabase.from('broadcast_recipients').update({follow_up_status:'followed_up'}).eq('broadcast_id',id).eq('contact_id',contactId).eq('org_id',orgId).eq('sub_account_id',subAccountId).eq('status','sent').eq('follow_up_status','not_followed_up')
 revalidatePath('/calls');revalidatePath(`/broadcasts/${id}`)
 return {error:error?.message}
}
