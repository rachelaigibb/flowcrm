import type { BroadcastRecipient } from '../../src/types/database'
import { summarizeEngagement } from '../../src/features/broadcasts/engagement'
const base={org_id:'fixture',sub_account_id:'fixture',broadcast_id:'fixture',provider_id:null,company:'Synthetic fixture',address:'fixture@example.invalid',status:'sent',sent_at:'2026-10-05T14:00:00Z',error:null,follow_up_status:'not_followed_up',follow_up_task_id:null,historical:false} as BroadcastRecipient
export const fixtureRows=[
 {...base,id:'one',contact_id:'one',contact_name:'Alex Clicked',engagement:summarizeEngagement([{event_id:'a',provider_id:'p',event_type:'email.clicked',occurred_at:'2026-10-05T15:00:00Z',link:'https://example.com/brochure'},{event_id:'b',provider_id:'p',event_type:'email.delivered',occurred_at:'2026-10-05T14:01:00Z',link:null}])},
 {...base,id:'two',contact_id:'two',contact_name:'Sam Unknown',historical:true,engagement:summarizeEngagement([])},
 {...base,id:'three',contact_id:'three',contact_name:'Pat Bounced',engagement:summarizeEngagement([{event_id:'c',provider_id:'q',event_type:'email.bounced',occurred_at:'2026-10-05T14:01:00Z',link:null}])}
]
export async function getBroadcastHistory(){return {data:fixtureRows}}
export async function getRecipientCount(){return {count:1}}
export async function updateBroadcast(){return {error:'Fixture: saving is disabled'}}
export async function createBroadcastFollowupDraft(){document.querySelector('#navigation')!.textContent='Fixture follow-up selected';return {id:'fixture-draft'}}
export async function createBroadcastTasks(){return {error:'Fixture: task creation is disabled'}}
export async function updateBroadcastOutcome(){return {error:'Fixture: outcomes are disabled'}}
export async function sendBroadcast(){throw new Error('Fixture: sending disabled')}
export const sendBroadcastTest=sendBroadcast
export const scheduleBroadcast=sendBroadcast
export const unscheduleBroadcast=sendBroadcast
