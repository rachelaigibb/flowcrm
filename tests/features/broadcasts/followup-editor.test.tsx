import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { Broadcast } from '@/types/database'
const mocks=vi.hoisted(()=>({save:vi.fn().mockResolvedValue({}),count:vi.fn().mockResolvedValue({data:1})}))
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}))
vi.mock('@/features/broadcasts/actions',()=>({updateBroadcast:mocks.save,getRecipientCount:mocks.count,sendBroadcast:vi.fn(),sendBroadcastTest:vi.fn(),scheduleBroadcast:vi.fn(),unscheduleBroadcast:vi.fn()}))
vi.mock('@/features/broadcasts/components/broadcast-recipient-list',()=>({BroadcastRecipientList:()=>null}))
beforeEach(()=>{mocks.count.mockReset().mockImplementation(async filter=>({data:filter.all?3:filter.tags?.length||filter.sources?.length||filter.contact_ids?.length?1:0}));mocks.save.mockClear()})
import { BroadcastEditorPage } from '@/features/broadcasts/components/broadcast-editor-page'
describe('selected recipient follow-up editor',()=>{
 it('allows drafting subject and body while saving the fixed audience',async()=>{
  const b={id:'draft',name:'Follow-up',status:'draft',channel:'email',email_subject:'Follow-up',email_body:'',recipient_filter:{contact_ids:['selected']},stats:{total:0,sent:0,failed:0}} as Broadcast
  await act(async()=>{render(<BroadcastEditorPage broadcast={b} emailTemplates={[]} smsTemplates={[]} availableTags={[]} availableSources={[]}/> )})
  expect(screen.getByText('1 recipient')).toBeInTheDocument()
  expect(mocks.count).toHaveBeenCalledWith({contact_ids:['selected']},'email')
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

const emptyDraft={id:'empty',name:'New broadcast',status:'draft',channel:'email',email_subject:'Ready',email_body:'Body',recipient_filter:{},stats:{total:0,sent:0,failed:0}} as Broadcast
it('starts with zero; selection, deselection and explicit all control count and sending',async()=>{
 await act(async()=>{render(<BroadcastEditorPage broadcast={emptyDraft} emailTemplates={[]} smsTemplates={[]} availableTags={['Selected tag']} availableSources={['Selected source']}/>)})
 expect(screen.getByText('0 recipients')).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Send Now'})).toBeDisabled()
 expect(mocks.count).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('checkbox',{name:'Selected tag'}))
 expect(screen.getByRole('button',{name:'Send Now'})).toBeDisabled()
 await waitFor(()=>expect(screen.getByText('1 recipient')).toBeInTheDocument())
 expect(screen.getByRole('button',{name:'Send Now'})).toBeEnabled()
 fireEvent.click(screen.getByRole('checkbox',{name:'Selected tag'}))
 expect(screen.getByText('0 recipients')).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Send Now'})).toBeDisabled()
 fireEvent.click(screen.getByRole('checkbox',{name:'Send to all contacts'}))
 await waitFor(()=>expect(screen.getByText('3 recipients')).toBeInTheDocument())
 fireEvent.click(screen.getByRole('checkbox',{name:'Send to all contacts'}))
 expect(screen.getByText('0 recipients')).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Save Draft'}))
 await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith('empty',expect.objectContaining({recipient_filter:{}})))
})
it('does not enable sending after a stale count resolves for a deselected audience',async()=>{
 let resolveCount:(value:{data:number})=>void=()=>{}
 mocks.count.mockImplementation(()=>new Promise(resolve=>{resolveCount=resolve}))
 await act(async()=>{render(<BroadcastEditorPage broadcast={emptyDraft} emailTemplates={[]} smsTemplates={[]} availableTags={['Tag']} availableSources={[]}/>)})
 fireEvent.click(screen.getByRole('checkbox',{name:'Tag'}))
 fireEvent.click(screen.getByRole('checkbox',{name:'Tag'}))
 await act(async()=>{resolveCount({data:100})})
 expect(screen.getByText('0 recipients')).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Send Now'})).toBeDisabled()
})
it('keeps an empty fixed selection disabled on remount even with all set',async()=>{
 const props={broadcast:{...emptyDraft,recipient_filter:{contact_ids:[],all:true}},emailTemplates:[],smsTemplates:[],availableTags:[],availableSources:[]}
 const first=render(<BroadcastEditorPage {...props}/>);first.unmount()
 render(<BroadcastEditorPage {...props}/>)
 expect(screen.getByText('0 recipients')).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Send Now'})).toBeDisabled()
 expect(screen.getByRole('button',{name:'Schedule'})).toBeDisabled()
 expect(mocks.count).not.toHaveBeenCalled()
})
it('keeps sending disabled when count lookup fails',async()=>{
 mocks.count.mockRejectedValue(new Error('offline'))
 render(<BroadcastEditorPage broadcast={{...emptyDraft,recipient_filter:{all:true}}} emailTemplates={[]} smsTemplates={[]} availableTags={[]} availableSources={[]}/>)
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Recipient count unavailable'))
 expect(screen.getByRole('button',{name:'Send Now'})).toBeDisabled()
})
