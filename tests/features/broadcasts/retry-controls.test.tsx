import {describe,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import {summarizeEngagement} from '@/features/broadcasts/engagement'
const mocks=vi.hoisted(()=>({history:vi.fn(),retry:vi.fn().mockResolvedValue({outcomes:[]})}))
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}))
vi.mock('@/features/broadcasts/recipient-actions',()=>({getBroadcastHistory:mocks.history,retrySelectedRateFailures:mocks.retry,updateBroadcastOutcome:vi.fn(),createBroadcastTasks:vi.fn(),createBroadcastFollowupDraft:vi.fn()}))
import {BroadcastRecipientList} from '@/features/broadcasts/components/broadcast-recipient-list'
describe('explicit retry control',()=>{
 it('requires only rejected selections and confirms the exact selected IDs',async()=>{
  const base={broadcast_id:'campaign',contact_id:'contact',company:null,address:'self@example.com',sent_at:null,provider_id:null,follow_up_status:'not_followed_up',engagement:summarizeEngagement([])}
  mocks.history.mockResolvedValue({data:[{...base,id:'failed',contact_name:'Rejected',status:'failed',error:'Too many requests. You can only make 10 requests per second.'},{...base,id:'accepted',contact_name:'Accepted',status:'sent',provider_id:'provider',sent_at:'2026-10-06',error:null}]})
  vi.spyOn(window,'confirm').mockReturnValue(true)
  render(<BroadcastRecipientList id="campaign" total={2} channel="email"/>)
  const button=screen.getByRole('button',{name:'Retry selected rate-limit failures'})
  expect(button).toBeDisabled()
  await waitFor(()=>expect(screen.getByLabelText('Select Rejected')).toBeInTheDocument())
  fireEvent.click(screen.getByLabelText('Select Accepted'));expect(button).toBeDisabled()
  fireEvent.click(screen.getByLabelText('Select Accepted'));fireEvent.click(screen.getByLabelText('Select Rejected'));expect(button).toBeEnabled()
  fireEvent.click(button)
  await waitFor(()=>expect(mocks.retry).toHaveBeenCalledWith('campaign',['failed']))
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('1 rate-rejected'))
 })
})
