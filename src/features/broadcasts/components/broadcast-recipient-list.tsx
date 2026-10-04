"use client"
import {useState,useEffect} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {toast} from 'sonner'
import type {BroadcastRecipient} from '@/types/database'
import {getBroadcastHistory,updateBroadcastOutcome,createBroadcastTasks,createBroadcastFollowupDraft} from '../recipient-actions'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
const outcomes={not_followed_up:'Not followed up',followed_up:'Followed up',interested:'Interested',declined:'Declined',replied:'Replied'}
export function BroadcastRecipientList({id,total,channel,initialStatus}:{id:string;total:number;channel:string;initialStatus?:string}) {
 const router=useRouter();const [rows,setRows]=useState<BroadcastRecipient[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true)
 const [status,setStatus]=useState(initialStatus??'all');
 useEffect(()=>{setStatus(['sent','failed','pending'].includes(initialStatus??'')?initialStatus!:'all')},[initialStatus]);const [outcome,setOutcome]=useState('all');const [selected,setSelected]=useState<Set<string>>(new Set());const [due,setDue]=useState('');const [busy,setBusy]=useState(false)
 async function load(){const r=await getBroadcastHistory(id);setRows(r.data);setError(r.error??'');setLoading(false)}
 useEffect(()=>{getBroadcastHistory(id).then(r=>{setRows(r.data);setError(r.error??'');setLoading(false)})},[id])
 const visible=rows.filter(r=>(status==='all'||r.status===status)&&(outcome==='all'||r.follow_up_status===outcome))
 const ids=visible.filter(r=>selected.has(r.id)).map(r=>r.id)
 async function act(fn:()=>Promise<{error?:string;count?:number;id?:string}>){setBusy(true);try{const r=await fn();if(r.error)toast.error(r.error);else if(r.id)router.push(`/broadcasts/${r.id}`);else{toast.success(r.count===undefined?'Outcome saved':`${r.count} new tasks created; existing or ineligible recipients skipped`);await load()}}catch{toast.error('Could not save. Refresh and check before retrying.')}finally{setBusy(false)}}
 function toggle(key:string){setSelected(prev=>{const next=new Set(prev);if(next.has(key))next.delete(key);else next.add(key);return next})}
 return <section id="recipients" className="rounded-xl border p-4 space-y-4">
  <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">Recipients ({rows.length})</h2><div className="flex gap-3"><Link className="text-sm underline" href={`/contacts?broadcast=${id}&status=${status}`}>Open in Contacts</Link><Link className="text-sm underline" href={`/calls?broadcast=${id}`}>Call sent recipients</Link><Button size="sm" variant="outline" onClick={load}>Refresh</Button></div></div>
  <p className="text-xs text-muted-foreground">Sent means accepted by the email/SMS provider, not confirmed delivery. Test sends are excluded.</p>
  {rows.some(r=>r.historical)||(!loading&&rows.length<total)?<p className="text-sm text-amber-600">Historical detail is incomplete: only recoverable successes are shown. Missing recipients and failures are unknown.</p>:null}
  {error&&<p role="alert" className="text-destructive">{error}</p>}
  <div className="flex flex-wrap gap-3"><label>Send status <select className="border rounded p-1 bg-background" value={status} onChange={e=>setStatus(e.target.value)}>{['all','sent','failed','pending'].map(s=><option key={s} value={s}>{s}</option>)}</select></label><label>Follow-up <select className="border rounded p-1 bg-background" value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="all">All outcomes</option>{Object.entries(outcomes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
  <div className="flex flex-wrap gap-2 items-center"><span className="text-sm">{ids.length} selected</span><Input aria-label="Follow-up date" type="date" className="w-40" value={due} onChange={e=>setDue(e.target.value)}/><Button size="sm" disabled={busy||!ids.length||!due} onClick={()=>act(()=>createBroadcastTasks(id,ids,due))}>Create follow-up tasks</Button><select aria-label="Set follow-up outcome" className="border rounded p-2 bg-background" value="" disabled={busy||!ids.length} onChange={e=>{if(e.target.value)void act(()=>updateBroadcastOutcome(id,ids,e.target.value as BroadcastRecipient['follow_up_status']))}}><option value="">Set outcome…</option>{Object.entries(outcomes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>{channel==='email'&&<Button size="sm" variant="outline" disabled={busy||!ids.length} onClick={()=>act(()=>createBroadcastFollowupDraft(id,ids))}>Prepare follow-up draft</Button>}</div>
  {loading?<p>Loading recipients…</p>:<div className="overflow-x-auto max-h-[32rem]"><table className="w-full text-sm text-left"><thead><tr><th className="p-2"><input aria-label="Select visible recipients" type="checkbox" checked={!!visible.length&&visible.every(r=>selected.has(r.id))} onChange={e=>setSelected(new Set(e.target.checked?visible.map(r=>r.id):[]))}/></th><th>Contact / send address</th><th>Status / send time</th><th>Follow-up</th></tr></thead><tbody>{visible.map(r=><tr key={r.id} className="border-t"><td className="p-2"><input aria-label={`Select ${r.contact_name}`} type="checkbox" checked={selected.has(r.id)} onChange={()=>toggle(r.id)}/></td><td className="p-2">{r.contact_id?<Link className="underline" href={`/contacts/${r.contact_id}`}>{r.contact_name}</Link>:r.contact_name}<div className="text-muted-foreground">{r.company}</div><div className="text-muted-foreground">{r.address}</div></td><td className="p-2">{r.status}<div className="text-xs">{r.sent_at?new Date(r.sent_at).toLocaleString():''}{r.error}</div></td><td className="p-2">{outcomes[r.follow_up_status]}{r.follow_up_task_id&&<div><Link href="/tasks" className="underline text-xs">Follow-up task created</Link></div>}</td></tr>)}</tbody></table>{!visible.length&&<p className="p-4">No recipients match these filters.</p>}</div>}
 </section>
}
