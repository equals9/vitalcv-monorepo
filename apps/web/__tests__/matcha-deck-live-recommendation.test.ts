import { describe, expect, it } from 'vitest'

import {
  relativePosted,
  toDeckRecommendation,
  toDeckRecommendations,
} from '@/lib/matcha-deck/liveRecommendation'

const NOW = Date.parse('2026-07-17T00:00:00.000Z')

function match(overrides: Record<string, unknown> = {}) {
  return {
    opportunityId: 'opp-uuid-1',
    opportunity: {
      id: 'opp-uuid-1',
      title: 'Hospitalist',
      organization: 'Northstar Medical',
      state: 'CA',
      specialty: 'Internal Medicine',
      hiringType: 'permanent',
      remote: false,
      postedAt: '2026-07-14T00:00:00.000Z',
      payMin: 150,
      payMax: 180,
      credentialRequirements: ['CA physician license'],
      // Emitted by the backend's live mapper from the integrated-apply rule.
      applicationMode: 'vitalcv',
      ...(overrides.opportunity as Record<string, unknown> | undefined),
    },
    explanation: {
      matchBand: 'NEAR_CLEAR',
      matchScore: 72,
      fitReasons: [
        // Real engine output (#724): an NPPES-taxonomy specialty is source-checked.
        { dimension: 'specialty', label: 'Internal Medicine specialty checked · NPPES', positive: true },
        { dimension: 'state', label: 'CA license on file, not source-checked', positive: true },
        { dimension: 'location', label: 'CA is in preferred locations', positive: true },
      ],
      blockers: [],
      ...(overrides.explanation as Record<string, unknown> | undefined),
    },
  }
}

describe('live recommendation mapper — identity + shape', () => {
  it('maps a well-formed match into a deck recommendation', () => {
    const rec = toDeckRecommendation(match(), 0)
    expect(rec).not.toBeNull()
    expect(rec!.recommendationId).toBe('live-opp-uuid-1')
    expect(rec!.opportunity.title).toBe('Hospitalist')
    expect(rec!.opportunity.employerName).toBe('Northstar Medical')
    expect(rec!.explanation.overallLabel).toBe('promising')
  })

  it('drops a match with no opportunity id rather than rendering it', () => {
    expect(toDeckRecommendation({ opportunity: { title: 'X' } }, 0)).toBeNull()
    expect(toDeckRecommendation({ opportunityId: 'x' }, 0)).toBeNull()
  })

  it('filters unmappable matches out of the batch', () => {
    const recs = toDeckRecommendations([match(), { junk: true }, null, match({ opportunity: { id: 'opp-2', title: 'Nocturnist' } })])
    expect(recs).toHaveLength(2)
  })
})

describe('live recommendation mapper — honesty', () => {
  it('never fabricates compensation when the listing did not disclose it', () => {
    const rec = toDeckRecommendation(
      match({ opportunity: { id: 'opp-uuid-1', title: 'Hospitalist', organization: 'N', payMin: undefined, payMax: undefined } }),
      0,
    )
    expect(rec!.opportunity.compensation).toBeUndefined()
  })

  it('keeps a disclosed pay range with source provenance', () => {
    const rec = toDeckRecommendation(match(), 0)
    expect(rec!.opportunity.compensation).toMatchObject({ min: 150, max: 180, provenance: 'source_listing' })
  })

  it('routes an "on file, not source-checked" fit to needsReview, never confirmed', () => {
    const rec = toDeckRecommendation(match(), 0)
    expect(rec!.explanation.confirmed.every((r) => /\bchecked\b/i.test(r.label) && !/not (?:source-)?checked/i.test(r.label))).toBe(true)
    expect(rec!.explanation.needsReview.some((r) => /not source-checked/i.test(r.label))).toBe(true)
  })

  it('routes an NPPES source-checked specialty into confirmed (engine #724 ↔ mapper contract)', () => {
    const rec = toDeckRecommendation(match(), 0)
    expect(
      rec!.explanation.confirmed.some(
        (r) => r.label === 'Internal Medicine specialty checked · NPPES' && r.kind === 'source_backed',
      ),
    ).toBe(true)
    // …while the unverified license claim stays out of confirmed.
    expect(rec!.explanation.needsReview.some((r) => /CA license on file/i.test(r.label))).toBe(true)
  })

  it('a source-checked fit does reach confirmed', () => {
    const rec = toDeckRecommendation(
      match({
        explanation: {
          matchBand: 'CLEAR',
          matchScore: 90,
          fitReasons: [{ dimension: 'state', label: 'CA license checked', positive: true }],
          blockers: [],
        },
      }),
      0,
    )
    expect(rec!.explanation.confirmed).toHaveLength(1)
    expect(rec!.explanation.confirmed[0].kind).toBe('source_backed')
  })

  it('blocks apply when a hard blocker is present, with an honest reason', () => {
    const rec = toDeckRecommendation(
      match({
        explanation: {
          matchBand: 'PARTIAL',
          matchScore: 40,
          fitReasons: [],
          blockers: [{ label: 'DEA registration', severity: 'hard', actionLabel: 'Add DEA' }],
        },
      }),
      0,
    )
    expect(rec!.actions.canApply).toBe(false)
    expect(rec!.actions.applyBlockReason).toBeTruthy()
    expect(rec!.explanation.blockers).toHaveLength(1)
  })

  it('missing optional fields become unknown, not invented values', () => {
    const rec = toDeckRecommendation(
      { opportunityId: 'opp-3', opportunity: { id: 'opp-3', title: 'Locums IM' }, explanation: { matchBand: 'PARTIAL', matchScore: 30, fitReasons: [], blockers: [] } },
      0,
    )
    expect(rec!.opportunity.employerName).toBe('Employer not provided')
    expect(rec!.opportunity.compensation).toBeUndefined()
    expect(rec!.opportunity.city).toBeUndefined()
    expect(rec!.freshness.label).toBe('Posting date not provided')
  })
})

describe('live recommendation mapper — freshness', () => {
  it('formats a relative posted label', () => {
    expect(relativePosted(NOW, NOW)).toBe('Posted today')
    expect(relativePosted(NOW - 86_400_000, NOW)).toBe('Posted yesterday')
    expect(relativePosted(NOW - 3 * 86_400_000, NOW)).toBe('Posted 3 days ago')
    expect(relativePosted(NOW - 10 * 86_400_000, NOW)).toBe('Posted 1 week ago')
  })
})

describe('live recommendation mapper — integrated apply boundary', () => {
  it('offers apply on an employer-posted role the server marked integrated', () => {
    const rec = toDeckRecommendation(match(), 0)
    expect(rec!.actions.canApply).toBe(true)
    expect(rec!.actions.applyBlockReason).toBeUndefined()
  })

  it('never offers apply on a feed-carried role, however clean the blockers, and says where to apply', () => {
    const rec = toDeckRecommendation(match({ opportunity: { applicationMode: 'external' } }), 0)
    expect(rec!.explanation.blockers).toHaveLength(0)
    expect(rec!.actions.canApply).toBe(false)
    expect(rec!.actions.applyBlockReason).toMatch(/employer’s own posting/)
  })

  it('treats a match the server did not mark as not applyable — the deck never infers the mode', () => {
    const rec = toDeckRecommendation(match({ opportunity: { applicationMode: undefined } }), 0)
    expect(rec!.actions.canApply).toBe(false)
    expect(rec!.actions.applyBlockReason).toMatch(/not available/)
  })
})
