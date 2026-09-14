/**
 * MATCHA Deck fixtures — VISIBLY test-only sample data (PR J1).
 *
 * These are not real listings, employers, or match results. Every fixture
 * carries isFixture: true, every employer name says "Sample", and the deck
 * renders a persistent sample-data banner plus a per-card Sample chip while
 * a fixture source is active. Live MATCHA recommendations replace this
 * source in PR J3 behind the same DeckSource contract.
 */

import { createDeckSourcePayload } from './sourceBoundary'
import type { DeckRecommendation } from './types'

export const FIXTURE_SOURCE_LABEL = 'Sample deck — these are not real listings'

function fixture(rec: Omit<DeckRecommendation, 'isFixture'>): DeckRecommendation {
  return {
    ...rec,
    isFixture: true,
    actions: {
      ...rec.actions,
      canApply: false,
      applyBlockReason: 'Sample listing — Apply with VitalCV is available on live roles.',
    },
  }
}

export const FIXTURE_RECOMMENDATIONS: DeckRecommendation[] = [
  fixture({
    recommendationId: 'fx-rec-001',
    opportunityVersion: 'fx-v1',
    opportunity: {
      opportunityId: 'fx-opp-001',
      title: 'Hospitalist',
      employerName: 'Sample Health System',
      facilityName: 'Sample Medical Center',
      city: 'Mountain View',
      state: 'CA',
      workArrangement: 'onsite',
      compensation: { min: 310000, max: 345000, period: 'year', currency: 'USD', provenance: 'source_listing' },
      // The canonical record facts a terms check reads (sample values, not a listing).
      record: {
        state: 'CA',
        remote: false,
        schedule: 'full_time',
        payRangeMin: 310000,
        payRangeMax: 345000,
        payUnit: 'year',
        compensationProvenance: { state: 'supplied', method: 'source_text', sourceLabel: 'Sample posting', observedAt: null },
        visaSponsorshipStatus: 'not_stated',
      },
      employmentType: 'Full time',
      specialty: 'Internal Medicine',
      scheduleSummary: '7 on / 7 off',
      callExpectations: undefined,
      description:
        'Sample listing for interaction testing. A hospitalist role covering inpatient medicine with a block schedule, closed ICU, and a rounding census in the mid-teens. This text exists to exercise the detail layout and is not a real job.',
      licenseRequirements: ['California physician license'],
      experienceRequirements: ['Residency in Internal Medicine'],
      sponsorship: 'unknown',
      benefits: ['Health coverage', 'CME allowance'],
    },
    explanation: {
      overallLabel: 'strong',
      confirmed: [
        {
          id: 'fx-r-001a',
          kind: 'source_backed',
          label: 'Internal Medicine specialty aligns',
          origin: 'NPPES taxonomy (sample)',
        },
        {
          id: 'fx-r-001b',
          kind: 'source_backed',
          label: 'No federal exclusion found',
          origin: 'OIG/LEIE check (sample)',
        },
        {
          id: 'fx-r-001c',
          kind: 'source_backed',
          label: 'NPI identity ready',
          origin: 'NPPES registry (sample)',
        },
      ],
      preferences: [
        { id: 'fx-r-001d', kind: 'preference', label: 'California location preference', origin: 'Stated preference (sample)' },
        { id: 'fx-r-001e', kind: 'preference', label: 'Block schedule preferred', origin: 'Stated preference (sample)' },
      ],
      needsReview: [
        {
          id: 'fx-r-001f',
          kind: 'needs_review',
          label: 'California license needs source access',
          origin: 'Readiness snapshot (sample)',
        },
      ],
      unknown: [{ id: 'fx-r-001g', kind: 'unknown', label: 'Call frequency not provided', origin: 'Listing omits this field' }],
      blockers: [],
    },
    freshness: { label: 'Posted 3 days ago (sample)', stale: false, postedAt: '2026-07-13T00:00:00.000Z' },
    actions: { canExpressInterest: true, canApply: true },
  }),
  fixture({
    recommendationId: 'fx-rec-002',
    opportunityVersion: 'fx-v1',
    opportunity: {
      opportunityId: 'fx-opp-002',
      title: 'Emergency Medicine Physician',
      employerName: 'Sample Regional Hospital',
      city: 'Reno',
      state: 'NV',
      workArrangement: 'onsite',
      compensation: { min: 280000, max: 320000, period: 'year', currency: 'USD', provenance: 'source_listing' },
      employmentType: 'Full time',
      specialty: 'Emergency Medicine',
      scheduleSummary: '14 shifts / month',
      description:
        'Sample listing for interaction testing. Community emergency department with 42,000 annual visits and double physician coverage during peak hours. Not a real job.',
      licenseRequirements: ['Nevada physician license'],
      sponsorship: 'unknown',
    },
    explanation: {
      overallLabel: 'promising',
      confirmed: [
        { id: 'fx-r-002a', kind: 'source_backed', label: 'No federal exclusion found', origin: 'OIG/LEIE check (sample)' },
        { id: 'fx-r-002b', kind: 'source_backed', label: 'NPI identity ready', origin: 'NPPES registry (sample)' },
      ],
      preferences: [{ id: 'fx-r-002c', kind: 'preference', label: 'Shift-based schedule preferred', origin: 'Stated preference (sample)' }],
      needsReview: [
        { id: 'fx-r-002d', kind: 'needs_review', label: 'Nevada license not on file', origin: 'Readiness snapshot (sample)' },
        { id: 'fx-r-002e', kind: 'needs_review', label: 'Specialty alignment needs confirmation', origin: 'Readiness snapshot (sample)' },
      ],
      unknown: [{ id: 'fx-r-002f', kind: 'unknown', label: 'Compensation model not specified', origin: 'Listing omits this field' }],
      blockers: [],
    },
    freshness: { label: 'Posted 1 week ago (sample)', stale: false, postedAt: '2026-07-09T00:00:00.000Z' },
    actions: { canExpressInterest: true, canApply: true },
  }),
  fixture({
    recommendationId: 'fx-rec-003',
    opportunityVersion: 'fx-v1',
    opportunity: {
      opportunityId: 'fx-opp-003',
      title: 'Telehealth Family Medicine Physician',
      employerName: 'Sample Virtual Care Group',
      workArrangement: 'remote',
      employmentType: 'Part time',
      record: {
        state: '',
        remote: true,
        schedule: 'part_time',
        payRangeMin: null,
        payRangeMax: null,
        payUnit: 'unknown',
        compensationProvenance: { state: 'not_supplied', method: 'not_supplied', sourceLabel: 'Sample posting', observedAt: null },
        visaSponsorshipStatus: 'not_stated',
      },
      specialty: 'Family Medicine',
      scheduleSummary: 'Flexible blocks, evenings available',
      description:
        'Sample listing for interaction testing. Fully remote primary-care panel with asynchronous follow-ups; state coverage depends on licensure. Not a real job.',
      licenseRequirements: ['Any active state physician license', 'Multi-state licensure a plus'],
      sponsorship: 'not_available',
    },
    explanation: {
      overallLabel: 'possible',
      confirmed: [{ id: 'fx-r-003a', kind: 'source_backed', label: 'NPI identity ready', origin: 'NPPES registry (sample)' }],
      preferences: [{ id: 'fx-r-003b', kind: 'preference', label: 'Remote work preferred', origin: 'Stated preference (sample)' }],
      needsReview: [],
      unknown: [
        { id: 'fx-r-003c', kind: 'unknown', label: 'Compensation not provided', origin: 'Listing omits this field' },
        { id: 'fx-r-003d', kind: 'unknown', label: 'Panel size not provided', origin: 'Listing omits this field' },
      ],
      blockers: [
        {
          id: 'fx-r-003e',
          kind: 'blocker',
          label: 'Family Medicine specialty not found in profile',
          origin: 'Readiness snapshot (sample)',
        },
      ],
    },
    freshness: { label: 'Posting date unknown (sample)', stale: false },
    actions: { canExpressInterest: true, canApply: false, applyBlockReason: 'Specialty mismatch needs review before applying.' },
  }),
  fixture({
    recommendationId: 'fx-rec-004',
    opportunityVersion: 'fx-v2',
    opportunity: {
      opportunityId: 'fx-opp-004',
      title: 'Nocturnist',
      employerName: 'Sample University Medical Center',
      city: 'Sacramento',
      state: 'CA',
      workArrangement: 'onsite',
      compensation: { min: 340000, max: 380000, period: 'year', currency: 'USD', provenance: 'source_listing' },
      employmentType: 'Full time',
      specialty: 'Internal Medicine',
      scheduleSummary: '7 on / 14 off, nights',
      description:
        'Sample listing for interaction testing. Academic nocturnist line with teaching exposure and procedure support overnight. Not a real job.',
      licenseRequirements: ['California physician license'],
      experienceRequirements: ['Residency in Internal Medicine', 'Night coverage experience preferred'],
      sponsorship: 'available',
      benefits: ['Health coverage', 'Retirement match', 'Relocation support'],
    },
    explanation: {
      overallLabel: 'strong',
      confirmed: [
        { id: 'fx-r-004a', kind: 'source_backed', label: 'Internal Medicine specialty aligns', origin: 'NPPES taxonomy (sample)' },
        { id: 'fx-r-004b', kind: 'source_backed', label: 'No federal exclusion found', origin: 'OIG/LEIE check (sample)' },
      ],
      preferences: [{ id: 'fx-r-004c', kind: 'preference', label: 'Within preferred region', origin: 'Stated preference (sample)' }],
      needsReview: [
        { id: 'fx-r-004d', kind: 'needs_review', label: 'California license needs source access', origin: 'Readiness snapshot (sample)' },
      ],
      unknown: [],
      blockers: [],
    },
    freshness: { label: 'Updated yesterday (sample)', stale: false, lastMaterialChangeAt: '2026-07-15T00:00:00.000Z' },
    actions: { canExpressInterest: true, canApply: true },
  }),
  fixture({
    recommendationId: 'fx-rec-005',
    opportunityVersion: 'fx-v1',
    opportunity: {
      opportunityId: 'fx-opp-005',
      title: 'Hospitalist — Weekend Program',
      employerName: 'Sample Community Health',
      city: 'Boise',
      state: 'ID',
      workArrangement: 'onsite',
      employmentType: 'Part time',
      specialty: 'Internal Medicine',
      scheduleSummary: 'Fri–Sun blocks',
      description:
        'Sample listing for interaction testing. Weekend-only hospitalist program; census shared across a three-physician pod. Not a real job.',
      licenseRequirements: ['Idaho physician license'],
      sponsorship: 'unknown',
    },
    explanation: {
      overallLabel: 'limited',
      confirmed: [{ id: 'fx-r-005a', kind: 'source_backed', label: 'Internal Medicine specialty aligns', origin: 'NPPES taxonomy (sample)' }],
      preferences: [],
      needsReview: [{ id: 'fx-r-005b', kind: 'needs_review', label: 'Idaho license not on file', origin: 'Readiness snapshot (sample)' }],
      unknown: [
        { id: 'fx-r-005c', kind: 'unknown', label: 'Compensation not provided', origin: 'Listing omits this field' },
        { id: 'fx-r-005d', kind: 'unknown', label: 'Call expectations not provided', origin: 'Listing omits this field' },
      ],
      blockers: [{ id: 'fx-r-005e', kind: 'blocker', label: 'Outside stated location preference', origin: 'Stated preference (sample)' }],
    },
    freshness: { label: 'Posted 6 weeks ago (sample)', stale: true, postedAt: '2026-06-03T00:00:00.000Z' },
    actions: { canExpressInterest: true, canApply: true },
  }),
  fixture({
    recommendationId: 'fx-rec-006',
    opportunityVersion: 'fx-v1',
    opportunity: {
      opportunityId: 'fx-opp-006',
      title: 'Primary Care Physician',
      employerName: 'Sample Coastal Clinic Network',
      city: 'Santa Cruz',
      state: 'CA',
      workArrangement: 'hybrid',
      compensation: { min: 240000, max: 270000, period: 'year', currency: 'USD', provenance: 'source_listing' },
      employmentType: 'Full time',
      specialty: 'Internal Medicine',
      scheduleSummary: '4-day week, 1 remote day',
      description:
        'Sample listing for interaction testing. Outpatient panel with integrated behavioral health and a four-day week. Not a real job.',
      licenseRequirements: ['California physician license'],
      benefits: ['Health coverage', 'Loan repayment program'],
      sponsorship: 'unknown',
    },
    explanation: {
      overallLabel: 'promising',
      confirmed: [
        { id: 'fx-r-006a', kind: 'source_backed', label: 'Internal Medicine specialty aligns', origin: 'NPPES taxonomy (sample)' },
        { id: 'fx-r-006b', kind: 'source_backed', label: 'NPI identity ready', origin: 'NPPES registry (sample)' },
      ],
      preferences: [
        { id: 'fx-r-006c', kind: 'preference', label: 'California location preference', origin: 'Stated preference (sample)' },
        { id: 'fx-r-006d', kind: 'preference', label: 'Hybrid arrangement acceptable', origin: 'Stated preference (sample)' },
      ],
      needsReview: [
        { id: 'fx-r-006e', kind: 'needs_review', label: 'California license needs source access', origin: 'Readiness snapshot (sample)' },
      ],
      unknown: [{ id: 'fx-r-006f', kind: 'unknown', label: 'Panel size not provided', origin: 'Listing omits this field' }],
      blockers: [],
    },
    freshness: { label: 'Posted 5 days ago (sample)', stale: false, postedAt: '2026-07-11T00:00:00.000Z' },
    actions: { canExpressInterest: true, canApply: true },
  }),
]

export const PREVIEW_FIXTURE_DECK_PAYLOAD = createDeckSourcePayload({
  mode: 'preview_fixture',
  sourceLabel: FIXTURE_SOURCE_LABEL,
  recommendations: FIXTURE_RECOMMENDATIONS,
})
