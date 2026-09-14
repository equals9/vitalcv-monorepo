/**
 * The clinician's terms on the Discover deck: the card face and detail sheet check the
 * card's canonical record against the stated terms; a card with no record says the check
 * was unavailable rather than reporting unknowns; no provider means no terms block; the
 * deck-level note is said once and never per card.
 */
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { DeckDetailSheet } from '@/components/matcha-deck/DeckDetailSheet'
import { DeckTermsContext } from '@/components/matcha-deck/DeckTerms'
import { MatchaDeckCard } from '@/components/matcha-deck/MatchaDeckCard'
import { FIXTURE_RECOMMENDATIONS } from '@/components/matcha-deck/fixtures'
import type { DeckRecommendation } from '@/components/matcha-deck/types'
import type { MatchaPreferences } from '@/lib/matcha/preferences'

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => true }
})

const byId = (id: string): DeckRecommendation => {
  const rec = FIXTURE_RECOMMENDATIONS.find((r) => r.recommendationId === id)
  if (!rec) throw new Error(`fixture missing: ${id}`)
  return rec
}

function withTerms(preferences: MatchaPreferences, node: React.ReactNode, loaded = true) {
  return renderToStaticMarkup(
    <DeckTermsContext.Provider value={{ preferences, loaded }}>{node}</DeckTermsContext.Provider>,
  )
}

describe('Discover deck — the card checked against the clinician\'s terms', () => {
  it('reports met / not met / unknown from the card record, with a hard miss stated', () => {
    const html = withTerms(
      { preferredStates: ['TX'], minimumSalary: 300000, visaSponsorshipNeeded: true, hardConstraints: ['location'] },
      <MatchaDeckCard recommendation={byId('fx-rec-001')} />,
    )
    expect(html).toContain('data-constraint-verdict="hard_not_met"')
    expect(html).toContain('data-constraint-key="location" data-constraint-status="not_met" data-constraint-hard="true"')
    expect(html).toContain('data-constraint-key="compensation" data-constraint-status="met"')
    expect(html).toContain('data-constraint-key="visa_sponsorship" data-constraint-status="unknown"')
    expect(html).toContain('This role fails a term you marked non-negotiable.')
    // The face is the summary: no reasons or questions (the sheet carries them).
    expect(html).not.toContain('The role is in CA. You named TX.')
    expect(html).toContain('mdk-terms--face')
    // The card face keeps its own content around the summary.
    expect(html).toContain('Hospitalist')
    expect(html).toContain('mdk-chip--sample')
  })

  it('a remote record with no state stays unknown for location; as a hard term it carries the licensure question', () => {
    const soft = withTerms({ preferredStates: ['CA'] }, <MatchaDeckCard recommendation={byId('fx-rec-003')} />)
    expect(soft).toContain('data-constraint-key="location" data-constraint-status="unknown"')
    expect(soft).not.toContain('Location: Met')
    // A soft unknown has no lead line on the card (the detail carries every question);
    // the first unsettled non-negotiable term does.
    expect(soft).not.toContain('data-constraint-lead')
    const hard = withTerms(
      { preferredStates: ['CA'], hardConstraints: ['location'] },
      <DeckDetailSheet recommendation={byId('fx-rec-003')} onClose={() => undefined} onDecide={() => undefined} />,
    )
    expect(hard).toContain('data-constraint-verdict="hard_unknown"')
    expect(hard).toContain('Ask which state licensure the remote role requires.')
  })

  it('a card with no canonical record says the check was unavailable — no per-term unknowns', () => {
    const html = withTerms({ preferredStates: ['CA'], hardConstraints: ['location'] }, <MatchaDeckCard recommendation={byId('fx-rec-002')} />)
    expect(html).toContain('data-constraint-verdict="record_unavailable"')
    expect(html).toContain('the role record was not available')
    expect(html).not.toContain('data-constraint-key=')
    expect(html).not.toContain('Unknown')
  })

  it('renders no terms block without a provider, before the store answers, or with no terms stated', () => {
    const bare = renderToStaticMarkup(<MatchaDeckCard recommendation={byId('fx-rec-001')} />)
    expect(bare).not.toContain('data-constraint-verdict')
    const loading = withTerms({ preferredStates: ['TX'] }, <MatchaDeckCard recommendation={byId('fx-rec-001')} />, false)
    expect(loading).not.toContain('data-constraint-verdict')
    const none = withTerms({}, <MatchaDeckCard recommendation={byId('fx-rec-001')} />)
    expect(none).not.toContain('data-constraint-verdict')
    expect(none).not.toContain('Set your terms')
  })

  it('the detail sheet carries the same check beside the role facts', () => {
    const html = withTerms(
      { minimumSalary: 400000, hardConstraints: ['compensation'] },
      <DeckDetailSheet recommendation={byId('fx-rec-001')} onClose={() => undefined} onDecide={() => undefined} />,
    )
    expect(html).toContain('data-constraint-verdict="hard_not_met"')
    expect(html).toContain('data-constraint-key="compensation" data-constraint-status="not_met"')
    expect(html).toContain('The top of the stated range is below your $400,000 minimum.')
    // Actions are untouched by the miss.
    expect(html).toContain('Interested')
    expect(html).toContain('Pass')
  })

  it('renders no score, percentage, or eligibility wording in the strip', () => {
    const html = withTerms(
      { preferredStates: ['TX'], minimumSalary: 300000, employmentTypes: ['full_time'], hardConstraints: ['location'] },
      <MatchaDeckCard recommendation={byId('fx-rec-001')} />,
    )
    const strip = html.slice(html.indexOf('mdk-terms--face'), html.indexOf('mdk-card-foot'))
    expect(strip.length).toBeGreaterThan(0)
    expect(strip).not.toMatch(/\d+\s?%/)
    expect(strip).not.toMatch(/\b(score|eligible|ineligible|qualified)\b/i)
    expect(strip).not.toContain('Verified')
  })
})
