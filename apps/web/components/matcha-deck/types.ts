/**
 * MATCHA Deck — recommendation contract types.
 *
 * This is the client-facing contract for MATCHA Discover. The deck renders
 * DeckRecommendation objects and never invents data: every field is either
 * provided by the recommendation source or rendered as unknown. Fixture
 * data (J1) implements this same contract and is visibly labeled.
 */

import type { ConstraintOpportunity } from '@/lib/matcha/constraintFit'

export type MatchReasonKind =
  | 'source_backed' // backed by a named source check (NPPES, OIG/LEIE, …)
  | 'preference' // matches a clinician-stated preference
  | 'inferred' // inferred from profile/evidence, not source-confirmed
  | 'needs_review' // requirement exists; clinician evidence needs action/review
  | 'unknown' // listing does not provide this information
  | 'blocker' // known blocker for this clinician

export interface MatchReason {
  id: string
  kind: MatchReasonKind
  /** Short human label, e.g. "Internal Medicine specialty aligns". */
  label: string
  /** Origin of the reason, e.g. "NPPES taxonomy", "Stated preference". */
  origin?: string
  /** Optional longer explanation shown when the reason is inspected. */
  detail?: string
}

export type DeckOverallLabel = 'strong' | 'promising' | 'possible' | 'limited'

export interface DeckExplanation {
  overallLabel: DeckOverallLabel
  confirmed: MatchReason[]
  preferences: MatchReason[]
  needsReview: MatchReason[]
  unknown: MatchReason[]
  blockers: MatchReason[]
}

export interface ListingFreshness {
  postedAt?: string
  ingestedAt?: string
  lastConfirmedAt?: string
  lastMaterialChangeAt?: string
  expiresAt?: string
  /** Pre-formatted honest label, e.g. "Posted 3 days ago" or "Posting date unknown". */
  label: string
  stale: boolean
}

export type WorkArrangement = 'onsite' | 'remote' | 'hybrid' | 'multi_site' | 'unknown'

export interface CompensationRange {
  min?: number
  max?: number
  period: 'year' | 'hour'
  currency: 'USD'
  /** Where the number came from. Unknown compensation is rendered as unknown, never zero. */
  provenance: 'employer_provided' | 'source_listing' | 'unknown'
}

/**
 * The role record facts a terms check reads, carried from the canonical opportunity
 * projection (`/api/opportunities/:id`) — the engine's match payload does not state
 * schedule, pay unit, pay provenance, or sponsorship, and a check on the engine payload
 * alone would report those as unknown when the record does state them. Absent when the
 * record could not be read; the deck then says so rather than reporting unknowns.
 */
export type OpportunityRecordFacts = ConstraintOpportunity

export interface OpportunityCardData {
  opportunityId: string
  title: string
  employerName: string
  facilityName?: string
  city?: string
  state?: string
  workArrangement: WorkArrangement
  compensation?: CompensationRange
  employmentType?: string
  specialty?: string
  scheduleSummary?: string
  callExpectations?: string
  description?: string
  licenseRequirements?: string[]
  experienceRequirements?: string[]
  sponsorship?: 'available' | 'not_available' | 'unknown'
  benefits?: string[]
  record?: OpportunityRecordFacts
}

export interface DeckRecommendation {
  recommendationId: string
  opportunity: OpportunityCardData
  /** Version of the opportunity the clinician saw; preserved through Apply. */
  opportunityVersion: string
  explanation: DeckExplanation
  freshness: ListingFreshness
  actions: {
    canExpressInterest: boolean
    canApply: boolean
    applyBlockReason?: string
  }
  /** True only for visibly test-only fixture decks (J1). */
  isFixture?: boolean
}

/** Decisions a clinician can make on a card. Right swipe = interested. */
export type DeckDecision = 'passed' | 'interested' | 'priority'

/**
 * Canonical signal actions (persisted from J2 onward). The deck emits these;
 * J1 keeps them in memory behind the same contract.
 */
export type DeckSignalAction =
  | 'viewed'
  | 'details_opened'
  | 'passed'
  | 'interested'
  | 'priority'
  | 'restored'

export interface DeckSignal {
  action: DeckSignalAction
  recommendationId: string
  opportunityId: string
  opportunityVersion: string
}

export type MatchaDeckSourceMode = 'live' | 'preview_fixture' | 'empty'

/**
 * Serializable server-to-client source boundary. Server components select the
 * mode; the client never decides whether preview fixtures are allowed.
 */
export interface DeckSourcePayload {
  mode: MatchaDeckSourceMode
  sourceLabel: string
  recommendations: DeckRecommendation[]
  emptyMessage?: string
  /**
   * The clinician's home/practice state (2-letter), when known — used only to
   * offer the "Near me" discovery mode (J6). Absent ⇒ that mode is hidden.
   */
  homeState?: string
}

/** Runtime adapter consumed by the interactive deck. */
export interface DeckSource {
  mode: MatchaDeckSourceMode
  /** Human label for the deck's data source, shown when the deck is not live. */
  sourceLabel: string
  isFixture: boolean
  emptyMessage?: string
  load(): Promise<DeckRecommendation[]>
}
