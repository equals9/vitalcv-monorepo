/**
 * Live MATCHA match → deck recommendation mapper (PR J3).
 *
 * Turns one entry of the `/api/matcha/opportunities/:npi` response into a
 * `DeckRecommendation` the deck already renders. Two jobs:
 *   1. opportunity fields → OpportunityCardData (honest: unknown stays unknown)
 *   2. engine explanation → the five-group taxonomy (via explanationMapper)
 *
 * Pure and defensive: the live payload is loosely typed at the proxy boundary,
 * so every field is read through a guard and anything absent is simply omitted
 * rather than defaulted to a fabricated value. No compensation is invented;
 * an undisclosed pay range is left undefined so the card says "not provided".
 */

import type {
  CompensationRange,
  DeckRecommendation,
  ListingFreshness,
  OpportunityCardData,
  OpportunityRecordFacts,
  WorkArrangement,
} from '@/components/matcha-deck/types'
import type { OpportunitySummary } from '@/lib/launch/marketplace'
import { mapEngineExplanation, type EngineExplanation } from './explanationMapper'

interface LiveMatch {
  opportunityId?: unknown
  opportunity?: Record<string, unknown>
  explanation?: Record<string, unknown>
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function bool(value: unknown): boolean {
  return value === true
}

function strList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.map(str).filter((s): s is string => !!s)
  return items.length > 0 ? items : undefined
}

/** Work arrangement from the opportunity's `remote` flag — the only signal the model carries. */
function workArrangement(opp: Record<string, unknown>): WorkArrangement {
  return bool(opp.remote) ? 'remote' : 'onsite'
}

/**
 * Compensation only when the listing actually disclosed a range. payMin/payMax
 * are the structured columns; when absent we do NOT parse the free-text
 * payRange into numbers (that invites fabrication) — we leave compensation
 * undefined so the card renders "Compensation not provided".
 */
function compensation(opp: Record<string, unknown>): CompensationRange | undefined {
  const min = num(opp.payMin)
  const max = num(opp.payMax)
  if (min === undefined && max === undefined) return undefined
  return {
    min,
    max,
    // Engine payMin/payMax are documented as USD/hr for normalization.
    period: 'hour',
    currency: 'USD',
    provenance: 'source_listing',
  }
}

/** Honest freshness from postedAt; never invented. */
function freshness(opp: Record<string, unknown>): ListingFreshness {
  const postedAt = str(opp.postedAt)
  const expiresAt = str(opp.expiresAt)
  if (!postedAt) {
    return { label: 'Posting date not provided', stale: false, expiresAt }
  }
  const posted = Date.parse(postedAt)
  if (!Number.isFinite(posted)) {
    return { label: 'Posting date not provided', stale: false, postedAt, expiresAt }
  }
  return { label: relativePosted(posted), stale: isStale(posted, expiresAt), postedAt, expiresAt }
}

/**
 * A relative "posted" label computed against a caller-provided now. The server
 * loader passes Date.now() once per request; kept as a parameter so this stays
 * a pure function (and testable without clock mocking).
 */
export function relativePosted(postedMs: number, nowMs = Date.now()): string {
  const days = Math.max(0, Math.floor((nowMs - postedMs) / 86_400_000))
  if (days === 0) return 'Posted today'
  if (days === 1) return 'Posted yesterday'
  if (days < 7) return `Posted ${days} days ago`
  if (days < 14) return 'Posted 1 week ago'
  if (days < 30) return `Posted ${Math.floor(days / 7)} weeks ago`
  if (days < 60) return 'Posted 1 month ago'
  return `Posted ${Math.floor(days / 30)} months ago`
}

function isStale(postedMs: number, expiresAt: string | undefined, nowMs = Date.now()): boolean {
  if (expiresAt) {
    const expires = Date.parse(expiresAt)
    if (Number.isFinite(expires) && expires < nowMs) return true
  }
  // A listing not refreshed in 45+ days is treated as stale (matches the
  // backend opportunityTruth classification horizon).
  return nowMs - postedMs > 45 * 86_400_000
}

/** The opportunity id a live match names, or undefined when it names none. */
export function matchOpportunityId(match: unknown): string | undefined {
  if (!match || typeof match !== 'object') return undefined
  const m = match as LiveMatch
  const opp = m.opportunity && typeof m.opportunity === 'object' ? m.opportunity : undefined
  return str(m.opportunityId) ?? (opp ? str(opp.id) : undefined)
}

/**
 * The subset of the canonical record a terms check reads. Copied field by field so the
 * card never carries the whole projection, and absent when there is no record.
 */
function recordFacts(record: OpportunitySummary | null | undefined): OpportunityRecordFacts | undefined {
  if (!record) return undefined
  return {
    state: record.state,
    remote: record.remote,
    schedule: record.schedule,
    payRangeMin: record.payRangeMin,
    payRangeMax: record.payRangeMax,
    payUnit: record.payUnit,
    compensationProvenance: record.compensationProvenance,
    visaSponsorshipStatus: record.visaSponsorshipStatus,
  }
}

/**
 * Sponsorship as the deck's three-way label. Only the record's two definite positions
 * become definite here; "case by case" and "not stated" stay unknown, and no record at
 * all stays unknown.
 */
function sponsorshipFromRecord(record: OpportunitySummary | null | undefined): OpportunityCardData['sponsorship'] {
  switch (record?.visaSponsorshipStatus) {
    case 'available':
      return 'available'
    case 'not_available':
      return 'not_available'
    default:
      return 'unknown'
  }
}

function opportunityCard(
  opportunityId: string,
  opp: Record<string, unknown>,
  record?: OpportunitySummary | null,
): OpportunityCardData {
  return {
    opportunityId,
    title: str(opp.title) ?? 'Untitled role',
    employerName: str(opp.organization) ?? 'Employer not provided',
    facilityName: str(opp.facility),
    city: str(opp.city),
    state: str(opp.state),
    workArrangement: workArrangement(opp),
    compensation: compensation(opp),
    employmentType: str(opp.hiringType),
    specialty: str(opp.specialty),
    scheduleSummary: str(opp.scheduleSummary),
    callExpectations: str(opp.callExpectations),
    description: str(opp.description),
    licenseRequirements: strList(opp.credentialRequirements),
    experienceRequirements: strList(opp.experienceRequirements),
    sponsorship: sponsorshipFromRecord(record),
    benefits: strList(opp.benefits),
    record: recordFacts(record),
  }
}

/** Coerce the loosely-typed explanation into the mapper's input, defensively. */
function engineExplanation(raw: Record<string, unknown> | undefined): EngineExplanation {
  const fitReasons = Array.isArray(raw?.fitReasons)
    ? (raw!.fitReasons as unknown[]).flatMap((r) => {
        if (!r || typeof r !== 'object') return []
        const rec = r as Record<string, unknown>
        const label = str(rec.label)
        if (!label) return []
        return [{ dimension: str(rec.dimension) ?? 'unknown', label, positive: bool(rec.positive) }]
      })
    : []
  const blockers = Array.isArray(raw?.blockers)
    ? (raw!.blockers as unknown[]).flatMap((b) => {
        if (!b || typeof b !== 'object') return []
        const rec = b as Record<string, unknown>
        const label = str(rec.label)
        if (!label) return []
        return [{ label, severity: str(rec.severity), actionLabel: str(rec.actionLabel) }]
      })
    : []
  return {
    matchBand: str(raw?.matchBand) ?? 'PARTIAL',
    matchScore: num(raw?.matchScore) ?? 0,
    fitReasons,
    blockers,
  }
}

/**
 * Map one live match to a DeckRecommendation, or null if it lacks the minimum
 * identity to render honestly (no opportunity id). `now` is threaded so
 * freshness stays deterministic within a request.
 */
export function toDeckRecommendation(
  match: LiveMatch | null | undefined,
  index: number,
  record?: OpportunitySummary | null,
): DeckRecommendation | null {
  if (!match || typeof match !== 'object') return null
  const opp = match.opportunity
  if (!opp || typeof opp !== 'object') return null
  const opportunityId = matchOpportunityId(match)
  if (!opportunityId) return null

  const explanation = mapEngineExplanation(engineExplanation(match.explanation), `rec-${index}`)
  const canApply = explanation.blockers.length === 0
  return {
    recommendationId: `live-${opportunityId}`,
    opportunity: opportunityCard(opportunityId, opp, record),
    // The opportunity model has no version column yet; updatedAt/postedAt is
    // the best available "what the clinician saw" pin (see J2 schema note).
    opportunityVersion: str(opp.updatedAt) ?? str(opp.postedAt) ?? 'v0',
    explanation,
    freshness: freshness(opp),
    actions: {
      canExpressInterest: true,
      canApply,
      applyBlockReason: canApply ? undefined : 'Resolve the blocking requirement before applying.',
    },
  }
}

/**
 * Map every live match; `records`, when given, supplies each match's canonical record by
 * opportunity id. A match with no record still renders — its terms check says the record
 * was unavailable instead of inventing unknowns.
 */
export function toDeckRecommendations(
  matches: unknown,
  records?: ReadonlyMap<string, OpportunitySummary>,
): DeckRecommendation[] {
  if (!Array.isArray(matches)) return []
  return matches
    .map((m, i) => {
      const id = matchOpportunityId(m)
      return toDeckRecommendation(m as LiveMatch, i, id ? records?.get(id) ?? null : null)
    })
    .filter((r): r is DeckRecommendation => r !== null)
}
