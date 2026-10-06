import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { BroadcastEditorPage } from '../../src/features/broadcasts/components/broadcast-editor-page'
import type { Broadcast } from '../../src/types/database'
import '../../src/app/globals.css'
const broadcast={id:'fixture',name:'Synthetic campaign — engagement review',status:'sent',channel:'email',email_subject:'Property information',email_body:'Synthetic content. No live recipients.',stats:{total:3,sent:3,failed:0},recipient_filter:{all:true},sent_at:'2026-10-05T14:00:00Z'} as Broadcast
function App(){const [mode,setMode]=useState('sent');return <main className="p-6 max-w-7xl mx-auto"><p className="mb-4">Local synthetic fixture. All writes and sends disabled.</p><div className="flex gap-4 mb-4">{['sent','selected','new'].map(value=><button key={value} className="border rounded p-2" onClick={()=>setMode(value)}>View {value} campaign</button>)}</div><p id="navigation"/><BroadcastEditorPage key={mode} broadcast={mode==='sent'?broadcast:{...broadcast,name:mode==='new'?'New empty draft':'Selected-recipient draft',status:'draft',email_body:'Synthetic ready content',recipient_filter:mode==='new'?{}:{contact_ids:['one']}}} timezone="America/Vancouver" emailTemplates={[]} smsTemplates={[]} availableTags={['Interested']} availableSources={['Website']}/></main>}
createRoot(document.getElementById('root')!).render(<App/> )
