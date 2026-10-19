import { expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Contact } from '@/types/database'
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}))
vi.mock('@/features/contacts/actions',()=>({deleteContact:vi.fn()}))
vi.mock('@/features/contacts/components/create-contact-dialog',()=>({CreateContactDialog:()=>null}))
vi.mock('@/features/contacts/components/import-csv-dialog',()=>({ImportCSVDialog:()=>null}))
import { ContactsPage } from '@/features/contacts/components/contacts-page'
it('filters actual contact rows using OR, AND, and cleared tags',async()=>{
 const contacts=[['One',['Buyer']],['Both',['Buyer','Touch Base']],['Neither',[]]].map(([name,tags],i)=>({id:String(i),first_name:name,last_name:'Fixture',tags,created_at:'2026-10-19T12:00:00Z'})) as Contact[]
 render(<ContactsPage contacts={contacts} tagColors={[]}/> )
 fireEvent.click(screen.getByRole('button',{name:'Tags'}))
 await screen.findByLabelText('Contact tag matching')
 fireEvent.click(screen.getByRole('checkbox',{name:'Buyer'}))
 fireEvent.click(screen.getByRole('checkbox',{name:'Touch Base'}))
 expect(screen.getByText('One Fixture')).toBeInTheDocument()
 expect(screen.getByText('Both Fixture')).toBeInTheDocument()
 expect(screen.queryByText('Neither Fixture')).not.toBeInTheDocument()
 fireEvent.change(screen.getByLabelText('Contact tag matching'),{target:{value:'all'}})
 expect(screen.queryByText('One Fixture')).not.toBeInTheDocument()
 expect(screen.getByText('Both Fixture')).toBeInTheDocument()
 fireEvent.click(screen.getByRole('checkbox',{name:'Buyer'}))
 fireEvent.click(screen.getByRole('checkbox',{name:'Touch Base'}))
 expect(screen.getByText('Neither Fixture')).toBeInTheDocument()
})
