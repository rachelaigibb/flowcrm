import type { ContactBroadcastTarget, ContactAudiencePreview } from '../../src/features/broadcasts/contact-audience-actions'
export async function getEditableBroadcasts(){return {data:[
 {id:'draft',name:'Synthetic draft',status:'draft',channel:'email',scheduled_at:null},
 {id:'scheduled',name:'Synthetic scheduled',status:'scheduled',channel:'email',scheduled_at:'2026-12-01T20:00:00Z'},
]}}
export async function previewContactAudience(ids:string[],target:ContactBroadcastTarget){
 const eligible=ids.filter(id=>id!=='2')
 const already=target.kind==='existing'&&eligible.includes('0')?1:0
 const data:ContactAudiencePreview={token:JSON.stringify({ids,target}),name:target.kind==='new'?target.name:'Synthetic campaign',channel:target.kind==='new'?target.channel:'email',scheduledAt:target.kind==='existing'&&target.id==='scheduled'?'2026-12-01T20:00:00Z':null,added:eligible.length-already,alreadyIncluded:already,excluded:ids.includes('2')?[{name:'Middle Fixture',reason:'Marketing consent required'}]:[],total:target.kind==='existing'?eligible.length+1-already:eligible.length}
 return {data}
}
export async function addContactsToBroadcast(ids:string[],target:ContactBroadcastTarget,token:string){
 if(token!==JSON.stringify({ids,target}))return {error:'Fixture preview mismatch'}
 document.querySelector('#fixture-confirmation')!.textContent=JSON.stringify({ids,target})
 return {data:{id:target.kind==='new'?'fixture-new':target.id,added:ids.filter(id=>id!=='2').length}}
}
