import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { BroadcastEditorPage } from '../../src/features/broadcasts/components/broadcast-editor-page'
import type { Broadcast } from '../../src/types/database'
import '../../src/app/globals.css'
const broadcast={id:'fixture',name:'Synthetic campaign — engagement review',status:'sent',channel:'email',email_subject:'Property information',email_body:'Synthetic content. No live recipients.',stats:{total:3,sent:3,failed:0},recipient_filter:{all:true},sent_at:'2026-10-05T14:00:00Z'} as Broadcast
function App(){const [draft,setDraft]=useState(false);return <main className="p-6 max-w-7xl mx-auto"><p className="mb-4">Local synthetic fixture. All writes and sends disabled.</p><button className="border rounded p-2 mb-4" onClick={()=>setDraft(!draft)}>{draft?'View sent campaign':'View selected-recipient draft'}</button><p id="navigation"/><BroadcastEditorPage key={String(draft)} broadcast={draft?{...broadcast,name:'Selected-recipient draft',status:'draft',email_body:'',recipient_filter:{contact_ids:['one']}}:broadcast} timezone="America/Vancouver" emailTemplates={[]} smsTemplates={[]} availableTags={[]} availableSources={[]}/></main>}
createRoot(document.getElementById('root')!).render(<App/> )
