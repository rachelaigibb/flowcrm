import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { Broadcast } from '@/types/database'
const mocks=vi.hoisted(()=>({save:vi.fn().mockResolvedValue({}),count:vi.fn().mockResolvedValue({count:1})}))
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}))
vi.mock('@/features/broadcasts/actions',()=>({updateBroadcast:mocks.save,getRecipientCount:mocks.count,sendBroadcast:vi.fn(),sendBroadcastTest:vi.fn(),scheduleBroadcast:vi.fn(),unscheduleBroadcast:vi.fn()}))
vi.mock('@/features/broadcasts/components/broadcast-recipient-list',()=>({BroadcastRecipientList:()=>null}))
import { BroadcastEditorPage } from '@/features/broadcasts/components/broadcast-editor-page'
describe('selected recipient follow-up editor',()=>{
 it('allows drafting subject and body while saving the fixed audience',async()=>{
  const b={id:'draft',name:'Follow-up',status:'draft',channel:'email',email_subject:'Follow-up',email_body:'',recipient_filter:{contact_ids:['selected']},stats:{total:0,sent:0,failed:0}} as Broadcast
  await act(async()=>{render(<BroadcastEditorPage broadcast={b} emailTemplates={[]} smsTemplates={[]} availableTags={[]} availableSources={[]}/> )})
  expect(screen.getByLabelText('Subject')).toBeEnabled();expect(screen.getByLabelText('Body')).toBeEnabled()
  expect(screen.getByRole('checkbox',{name:'Send to all contacts'})).toHaveAttribute('aria-disabled','true')
  fireEvent.change(screen.getByLabelText('Subject'),{target:{value:'Updated subject'}})
  fireEvent.change(screen.getByLabelText('Body'),{target:{value:'Follow-up text'}})
  fireEvent.click(screen.getByRole('button',{name:'Save Draft'}))
  await waitFor(()=>expect(mocks.save).toHaveBeenCalled())
  expect(mocks.save.mock.calls[0][0]).toBe('draft')
  expect(mocks.save.mock.calls[0][1]).toMatchObject({email_subject:'Updated subject',email_body:'Follow-up text',recipient_filter:{contact_ids:['selected']}})
 })
})
