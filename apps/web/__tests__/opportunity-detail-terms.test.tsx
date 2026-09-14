/**
 * The "Your terms" section on the signed-in role detail: the clinician's stated terms
 * checked against the role record, with met / not met / unknown kept distinct, a hard
 * miss stated as the heading without hiding the role or its actions, and an honest
 * loading state before the account store has answered.
 */
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OpportunityDetailSurface from '@/app/holder/opportunities/[id]/OpportunityDetailSurface';
import type { OpportunitySummary } from '@/lib/launch/marketplace';
import type { MatchaPreferences } from '@/lib/matcha/preferences';

const clinicianMobileState = vi.hoisted(() => ({
  opportunities: [] as Array<Record<string, unknown>>,
}));

const termsState = vi.hoisted(() => ({
  preferences: {} as Record<string, unknown>,
  loaded: true,
  sync: 'synced' as string,
}));

vi.mock('@/components/mobile/ClinicianMobileProvider', () => ({
  useClinicianMobile: () => ({
    data: { opportunities: clinicianMobileState.opportunities },
  }),
}));

vi.mock('@/components/workbench/CaptureInWorkbench', () => ({
  CaptureInWorkbench: () => null,
}));

vi.mock('@/components/matcha/useMatchaPreferences', () => ({
  useMatchaPreferences: () => ({
    preferences: termsState.preferences,
    loaded: termsState.loaded,
    sync: termsState.sync,
  }),
}));

const ID = '11111111-1111-1111-1111-111111111111';

function opportunity(overrides: Partial<OpportunitySummary> = {}): OpportunitySummary {
  return {
    id: ID,
    organizationId: 'org-1',
    organizationName: 'Example clinical organization',
    organizationSlug: 'example-clinical-organization',
    title: 'Acute Care Nurse Practitioner',
    specialty: 'Critical Care',
    profession: 'advanced_practice',
    schedule: 'not_stated',
    hiringType: 'perm',
    state: 'TX',
    payRange: null,
    requirementLevel: 'L1',
    description: null,
    remote: false,
    status: 'ACTIVE',
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:05:00.000Z',
    source: {
      kind: 'public_feed',
      label: 'Listed on greenhouse',
      updatedAt: '2026-09-01T08:05:00.000Z',
      url: 'https://job-boards.greenhouse.io/example/jobs/123',
      fetchedAt: '2026-09-01T08:06:00.000Z',
    },
    isFeedListing: true,
    availability: {
      state: 'open',
      confidence: 'recent_observation',
      observedAt: '2026-09-01T08:06:00.000Z',
      limitation: 'Confirm the current listing at its source before acting.',
    },
    applicationMode: 'external',
    compensationProvenance: {
      state: 'not_supplied',
      method: 'not_supplied',
      sourceLabel: 'Listed on greenhouse',
      observedAt: '2026-09-01T08:06:00.000Z',
    },
    ...overrides,
  };
}

function render(prefs: MatchaPreferences, overrides: Partial<OpportunitySummary> = {}) {
  termsState.preferences = prefs as Record<string, unknown>;
  clinicianMobileState.opportunities = [{ ...opportunity(overrides), application: null, match: null }];
  return renderToStaticMarkup(<OpportunityDetailSurface opportunityId={ID} />);
}

describe('signed-in role detail — your terms', () => {
  beforeEach(() => {
    termsState.loaded = true;
    termsState.sync = 'synced';
  });

  it('states a hard miss as the heading and keeps the role and its action visible', () => {
    const html = render({ preferredStates: ['CA', 'WA'], hardConstraints: ['location'] });
    expect(html).toContain('data-constraint-verdict="hard_not_met"');
    expect(html).toContain('This role fails a term you marked non-negotiable.');
    expect(html).toContain('data-constraint-key="location"');
    expect(html).toContain('data-constraint-status="not_met"');
    expect(html).toContain('data-constraint-hard="true"');
    expect(html).toContain('Non-negotiable');
    // Not silently relaxed, and not hidden: the person still decides.
    expect(html).toContain('View original listing');
    expect(html).toContain('Acute Care Nurse Practitioner');
  });

  it('shows an unstated term as unknown with the question that would settle it', () => {
    const html = render({ employmentTypes: ['part_time'], minimumSalary: 150000 });
    expect(html).toContain('data-constraint-verdict="no_hard_terms"');
    expect(html).toContain('data-constraint-key="employment_type"');
    expect(html).toContain('data-constraint-status="unknown"');
    expect(html).toContain('Next: Ask whether the role is full-time, part-time or per diem.');
    expect(html).toContain('Not supplied by source');
    expect(html).not.toContain('data-constraint-status="met"');
    expect(html).not.toContain('data-constraint-status="not_met"');
  });

  it('keeps met, not met and unknown as three distinct rows on one role', () => {
    const html = render(
      { preferredStates: ['TX'], employmentTypes: ['full_time'], minimumSalary: 150000, hardConstraints: ['location', 'employment_type'] },
      { schedule: 'part_time' },
    );
    expect(html).toContain('data-constraint-key="location" data-constraint-status="met" data-constraint-hard="true"');
    expect(html).toContain('data-constraint-key="employment_type" data-constraint-status="not_met" data-constraint-hard="true"');
    expect(html).toContain('data-constraint-key="compensation" data-constraint-status="unknown" data-constraint-hard="false"');
    expect(html).toContain('data-constraint-verdict="hard_not_met"');
  });

  it('with no terms set, points to where terms are set instead of inventing any', () => {
    const html = render({});
    expect(html).toContain('data-constraint-verdict="no_terms"');
    expect(html).toContain('You have not set any terms yet.');
    expect(html).toContain('href="/holder/matcha/onboarding"');
    expect(html).not.toContain('data-constraint-key=');
  });

  it('before the account store answers, says so rather than showing an empty verdict', () => {
    termsState.loaded = false;
    const html = render({ preferredStates: ['CA'], hardConstraints: ['location'] });
    expect(html).toContain('data-constraint-verdict="loading"');
    expect(html).toContain('Loading your saved terms');
    expect(html).not.toContain('data-constraint-key=');
    expect(html).not.toContain('fails a term');
  });

  it('discloses a degraded account read next to the terms it is using', () => {
    termsState.sync = 'degraded';
    const html = render({ preferredStates: ['TX'] });
    expect(html).toContain('held in this browser only');
  });

  it('never scores, ranks, or pronounces eligibility', () => {
    const html = render({ preferredStates: ['CA'], hardConstraints: ['location'] });
    expect(html).not.toMatch(/\b\d{1,3}% (fit|match)|ready now|you are eligible|not eligible|Verified\b/);
  });
});
