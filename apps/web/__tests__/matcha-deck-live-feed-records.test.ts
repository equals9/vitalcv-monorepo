/**
 * The deck's server loader reads each match's canonical record by id and attaches only
 * the facts a terms check reads. A record that cannot be read is absent, not invented;
 * a failed read for one id never drops another id's record; ids are read once each.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'user_test' }) }))
vi.mock('@/lib/server/marketplace-proxy', () => ({
  MARKETPLACE_BACKEND: 'http://backend.test',
  buildMarketplaceHeaders: async () => new Headers(),
}))

const { fetchLaunchOpportunity } = vi.hoisted(() => ({ fetchLaunchOpportunity: vi.fn() }))
vi.mock('@/lib/launch/marketplace', () => ({ fetchLaunchOpportunity }))

function record(id: string, state: string) {
  return {
    id,
    state,
    remote: false,
    schedule: 'per_diem',
    payRangeMin: null,
    payRangeMax: null,
    payUnit: 'unknown',
    compensationProvenance: { state: 'not_supplied', method: 'not_supplied', sourceLabel: 'Feed', observedAt: null },
    visaSponsorshipStatus: 'not_stated',
    title: 'Should not be copied onto the card record',
  }
}

const matches = [
  { opportunityId: 'a', opportunity: { id: 'a', title: 'Role A', state: 'TX' }, explanation: {} },
  { opportunityId: 'b', opportunity: { id: 'b', title: 'Role B', state: 'OR' }, explanation: {} },
  { opportunityId: 'a', opportunity: { id: 'a', title: 'Role A again', state: 'TX' }, explanation: {} },
]

afterEach(() => {
  vi.unstubAllGlobals()
  fetchLaunchOpportunity.mockReset()
})

describe('loadLiveFeed — canonical records per match', () => {
  it('attaches record facts by id, leaves a failed id without one, and reads each id once', async () => {
    fetchLaunchOpportunity.mockImplementation(async (id: string) => {
      if (id === 'a') return record('a', 'TX')
      throw new Error('record service down')
    })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).endsWith('/api/me/workspaces')) {
        return new Response(JSON.stringify({ personProfile: { npi: '1234567893' } }), { status: 200 })
      }
      return new Response(JSON.stringify({ matches, state: 'tx' }), { status: 200 })
    }))

    const { loadLiveFeed } = await import('@/lib/matcha-deck/liveFeed')
    const feed = await loadLiveFeed()
    expect(feed).not.toBeNull()
    const [first, second, third] = feed!.recommendations
    expect(first.opportunity.record).toEqual({
      state: 'TX',
      remote: false,
      schedule: 'per_diem',
      payRangeMin: null,
      payRangeMax: null,
      payUnit: 'unknown',
      compensationProvenance: { state: 'not_supplied', method: 'not_supplied', sourceLabel: 'Feed', observedAt: null },
      visaSponsorshipStatus: 'not_stated',
    })
    expect(second.opportunity.record).toBeUndefined()
    expect(third.opportunity.record).toEqual(first.opportunity.record)
    expect(fetchLaunchOpportunity).toHaveBeenCalledTimes(2)
    expect(fetchLaunchOpportunity.mock.calls.map((c) => c[0]).sort()).toEqual(['a', 'b'])
  })

  it('a null record (404) leaves the card without a record', async () => {
    const { loadMatchRecords } = await import('@/lib/matcha-deck/liveFeed')
    fetchLaunchOpportunity.mockResolvedValue(null)
    const records = await loadMatchRecords([{ opportunityId: 'gone', opportunity: { id: 'gone' } }])
    expect(records.size).toBe(0)
  })
})
