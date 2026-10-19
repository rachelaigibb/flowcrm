import { createRoot } from 'react-dom/client'
import { ContactsPage } from '../../src/features/contacts/components/contacts-page'
import type { Contact } from '../../src/types/database'
import '../../src/app/globals.css'
const contacts = ['Zulu', 'Alpha', 'Middle'].map((name, i) => ({
 id: String(i), first_name: name, last_name: 'Fixture', email: `${name.toLowerCase()}@example.invalid`,
 phone: '555-0100', company: 'Synthetic company', source: 'Referral',
 tags: i === 0 ? ['Buyer'] : i === 1 ? ['Buyer','Touch Base'] : [],
 created_at: `2026-10-${19-i}T12:00:00Z`,
})) as Contact[]
createRoot(document.getElementById('root')!).render(<main className="p-6 min-w-0"><p className="mb-4">Synthetic local contacts. No production records or writes.</p><ContactsPage contacts={contacts} tagColors={[]}/></main>)
