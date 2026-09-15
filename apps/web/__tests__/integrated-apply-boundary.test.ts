/**
 * Bundle 1 — the signed-in half of the integrated-apply boundary.
 *
 * The public explore surfaces have always drawn the distinction between a role
 * an employer posted here and one carried from their own job board. The
 * signed-in surfaces did not: the dashboard's recommended next step offered
 * "Apply now" whenever the match band was strong, and match band says nothing
 * about who posted the role. Since 100% of live inventory is feed-carried,
 * that CTA pointed at an apply flow the server now (correctly) refuses.
 *
 * This suite covers the DECISION FUNCTIONS. The rendered surfaces are covered
 * separately in integrated-apply-boundary-render.test.tsx, which mounts
 * OpportunityGrid — a surface that stops consulting these helpers fails there,
 * not here.
 */

import { describe, expect, it } from 'vitest';

import { buildRecommendedAction } from '../lib/mobile/clinician-state';
import { opportunityApplicationMode } from '../lib/explore/opportunity-display';

type OpportunityCard = Parameters<typeof buildRecommendedAction>[0]['availableOpportunities'][number];

function opportunityCard(overrides: Partial<OpportunityCard> = {}): OpportunityCard {
  return {
    id: 'opp_boundary',
    organizationId: 'org_boundary',
    organizationName: 'Example Health',
    organizationSlug: 'example-health',
    title: 'ICU Nurse',
    specialty: 'ICU',
    hiringType: 'contract',
    state: 'OR',
    payRange: '$3,600/week',
    requirementLevel: 'L2',
    description: 'Live role',
    remote: false,
    status: 'ACTIVE',
    createdAt: '2026-08-18T10:00:00.000Z',
    application: null,
    match: {
      opportunityId: 'opp_boundary',
      band: 'CLEAR',
      score: 95,
      blockers: [],
      fitReasons: ['ICU specialty'],
    },
    ...overrides,
  } as OpportunityCard;
}

const READY_INPUT = {
  trustState: { readinessScore: 80 } as never,
  profileCompleteness: { score: 90 } as never,
  blockers: [],
  activeApplications: [],
};

describe('opportunityApplicationMode', () => {
  it('treats a feed listing as external and an employer-posted role as integrated', () => {
    expect(opportunityApplicationMode({ isFeedListing: true } as never)).toBe('external');
    expect(opportunityApplicationMode({ isFeedListing: false } as never)).toBe('vitalcv');
  });

  it('prefers an explicit applicationMode over the derived one', () => {
    expect(
      opportunityApplicationMode({ applicationMode: 'external', isFeedListing: false } as never),
    ).toBe('external');
  });
});

describe('recommended next step — integrated apply boundary', () => {
  it('does not offer to apply to a feed-carried role, however strong the match', () => {
    const action = buildRecommendedAction({
      ...READY_INPUT,
      availableOpportunities: [opportunityCard({ isFeedListing: true, applicationMode: 'external' } as never)],
    });

    // A CLEAR band on a feed row used to be enough to produce "Apply now".
    expect(action?.ctaLabel).not.toBe('Apply now');
    expect(action?.href).not.toContain('apply=');
  });

  it('still offers to apply to an employer-posted role with a strong match', () => {
    const action = buildRecommendedAction({
      ...READY_INPUT,
      availableOpportunities: [opportunityCard({ isFeedListing: false, applicationMode: 'vitalcv' } as never)],
    });

    // The boundary must not be an off switch.
    expect(action?.ctaLabel).toBe('Apply now');
    expect(action?.href).toContain('apply=');
  });

  it('does not promise a shortest-path-to-action story for a role applied to elsewhere', () => {
    const action = buildRecommendedAction({
      ...READY_INPUT,
      availableOpportunities: [opportunityCard({ isFeedListing: true, applicationMode: 'external' } as never)],
    });

    expect(action?.description ?? '').not.toMatch(/shortest path/i);
  });
});
