'use client'

/**
 * The clinician's terms on the Discover deck.
 *
 * DiscoverSurface reads the account-scoped preferences once and provides them here; the
 * card face and the detail sheet consume them without the deck machine learning anything
 * about terms. No provider (isolated renders, fixture tests) means no terms block at all.
 */

import { createContext, useContext } from 'react'

import { TermsCheckStrip, TermsCheckSummary, TermsRecordUnavailable } from '@/components/matcha/TermsCheck'
import { evaluateConstraintFit, statedConstraintKeys } from '@/lib/matcha/constraintFit'
import type { MatchaPreferences } from '@/lib/matcha/preferences'
import type { OpportunityCardData } from './types'

export interface DeckTerms {
  preferences: MatchaPreferences
  loaded: boolean
}

export const DeckTermsContext = createContext<DeckTerms | null>(null)

export function useDeckTerms(): DeckTerms | null {
  return useContext(DeckTermsContext)
}

/**
 * The terms check for one card. Renders nothing until the store has answered or when no
 * terms are stated (the deck-level note covers those); with terms but no record it says
 * the check was unavailable; with both it reports met / not met / unknown per term.
 *
 * `face` is the fixed-height card front: the verdict and each term's answer on two lines.
 * `sheet` is the detail sheet: the full strip with reasons and settling questions.
 */
export function DeckTermsBlock({
  opportunity,
  variant,
}: {
  opportunity: OpportunityCardData
  variant: 'face' | 'sheet'
}) {
  const terms = useDeckTerms()
  if (!terms || !terms.loaded) return null
  if (statedConstraintKeys(terms.preferences).length === 0) return null
  if (!opportunity.record) return <TermsRecordUnavailable skin="mdk" />
  const fit = evaluateConstraintFit(terms.preferences, opportunity.record)
  return variant === 'face'
    ? <TermsCheckSummary fit={fit} skin="mdk" />
    : <TermsCheckStrip fit={fit} skin="mdk" />
}
