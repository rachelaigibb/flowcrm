import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { summarizeEngagement } from '@/features/broadcasts/engagement'
const mocks = vi.hoisted(() => ({ history: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/features/broadcasts/recipient-actions', () => ({ getBroadcastHistory: mocks.history, retrySelectedRateFailures: vi.fn(), updateBroadcastOutcome: vi.fn(), createBroadcastTasks: vi.fn(), createBroadcastFollowupDraft: vi.fn() }))
import { BroadcastRecipientList } from '@/features/broadcasts/components/broadcast-recipient-list'
describe('recipient unsubscribe display', () => {
  it('shows unique current count, local dates and an intersecting filter without changing manual outcomes', async () => {
    const base = { company: null, address: 'fixture@example.invalid', status: 'sent', follow_up_status: 'interested', engagement: summarizeEngagement([]) }
    mocks.history.mockResolvedValue({ data: [
      { ...base, id: 'a', contact_id: 'a', contact_name: 'Withdrawn dated', consent: { status: 'withdrawn', withdrawnAt: '2026-10-06T17:02:54Z' } },
      { ...base, id: 'b', contact_id: 'b', contact_name: 'Withdrawn undated', consent: { status: 'withdrawn', withdrawnAt: null } },
      { ...base, id: 'c', contact_id: 'c', contact_name: 'Active', consent: { status: 'explicit', withdrawnAt: null } },
    ] })
    render(<BroadcastRecipientList id="campaign" total={3} channel="email" timezone="America/Vancouver" />)
    await waitFor(() => expect(screen.getByText(/2 recipients currently unsubscribed/)).toBeInTheDocument())
    expect(screen.getByText(/not attribution to this campaign/)).toBeInTheDocument()
    expect(screen.getByText(/Withdrawn .*10:02:54/)).toBeInTheDocument()
    expect(screen.getByText('Withdrawal date unknown')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Consent filter'), { target: { value: 'withdrawn' } })
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
    expect(screen.getByText('2 recipients match these filters.')).toBeInTheDocument()
    expect(screen.getAllByText('Interested', { selector: 'td' })).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Open in Contacts' })).toHaveAttribute('href', expect.stringContaining('consent=withdrawn'))
    fireEvent.change(screen.getByLabelText('Engagement filter'), { target: { value: 'clicked' } })
    expect(screen.getByText('No recipients match these filters.')).toBeInTheDocument()
    expect(screen.getByText(/2 recipients currently unsubscribed/)).toBeInTheDocument()
  })
  it('does not show a false zero when consent loading fails', async () => {
    mocks.history.mockResolvedValue({ data: [], error: 'Current consent unavailable' })
    render(<BroadcastRecipientList id="campaign" total={3} channel="email" />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Current consent unavailable'))
    expect(screen.queryByText(/recipients currently unsubscribed/)).not.toBeInTheDocument()
  })
})
