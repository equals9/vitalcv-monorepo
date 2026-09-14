/**
 * The signed-in Roles list checked against the clinician's own terms, row by row.
 *
 * What this pins: met / not met / unknown stay three answers on the row; a hard miss is
 * stated on the row and the role's actions remain; nothing is filtered, hidden, or
 * reordered; an unknown never counts as met; "no terms" is said once for the list, not per
 * row; before the account store answers no verdict is shown; no score renders.
 */
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpportunityGrid } from '@/components/mobile/ClinicianPanels';
import { evaluateConstraintFit, statedConstraintKeys } from '@/lib/matcha/constraintFit';
import type { MatchaPreferences } from '@/lib/matcha/preferences';

const { trackOnceMock } = vi.hoisted(() => ({ trackOnceMock: vi.fn(async () => undefined) }));

const termsState = vi.hoisted(() => ({
  preferences: {} as Record<string, unknown>,
  loaded: true,
  sync: 'synced' as string,
}));

vi.mock('@/lib/mobile/analytics', () => ({
  trackClinicianEvent: vi.fn(async () => undefined),
  trackClinicianEventOncePerSession: trackOnceMock,
}));

vi.mock('@/components/matcha/useMatchaPreferences', () => ({
  useMatchaPreferences: () => ({
    preferences: termsState.preferences,
    loaded: termsState.loaded,
    sync: termsState.sync,
  }),
}));

vi.mock('@/components/mobile/ClinicianMobileProvider', () => ({
  useClinicianMobile: () => ({
    data: { workspace: { personProfile: { npi: null } }, activeApplications: [] },
    applySubmitted: () => undefined,
    selectOpportunity: () => undefined,
    selectedOpportunityId: null,
  }),
}));

vi.mock('@/components/explore/ApplyModal', () => ({ default: () => null }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/holder/opportunities',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

type Row = Parameters<typeof OpportunityGrid>[0]['opportunities'][number];

function row(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    organizationId: 'org-1',
    organizationName: 'Example clinical organization',
    organizationSlug: 'example-clinical-organization',
    title: `Acute Care Nurse Practitioner ${id}`,
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
    isFeedListing: true,
    applicationMode: 'external',
    compensationProvenance: { state: 'not_supplied', reason: 'Source did not publish pay.' },
    visaSponsorshipStatus: 'not_stated',
    application: null,
    match: null,
    ...overrides,
  } as Row;
}

function render(rows: Row[]) {
  return renderToStaticMarkup(<OpportunityGrid opportunities={rows} heading="Live opportunity feed" />);
}

function setTerms(preferences: MatchaPreferences, extra: Partial<typeof termsState> = {}) {
  termsState.preferences = preferences as Record<string, unknown>;
  termsState.loaded = extra.loaded ?? true;
  termsState.sync = extra.sync ?? 'synced';
}

function verdictOf(html: string, id: string): string | null {
  const article = html.split('<article').find((chunk) => chunk.includes(`Practitioner ${id}`));
  const match = article?.match(/data-constraint-verdict="([a-z_]+)"/);
  return match ? match[1] : null;
}

beforeEach(() => {
  trackOnceMock.mockClear();
  setTerms({});
});

describe('Roles list — the row checked against the clinician\'s terms', () => {
  it('states a hard miss on the row and keeps the role and its actions', () => {
    setTerms({ preferredStates: ['CA'], hardConstraints: ['location'] });
    const html = render([row('A')]);
    expect(verdictOf(html, 'A')).toBe('hard_not_met');
    expect(html).toContain('This role fails a term you marked non-negotiable.');
    expect(html).toContain('data-constraint-key="location" data-constraint-status="not_met" data-constraint-hard="true"');
    expect(html).toContain('The role is in TX. You named CA.');
    // The role is reported on, never removed, and its actions stay.
    expect(html).toContain('Acute Care Nurse Practitioner A');
    expect(html).toContain('Apply now');
    expect(html).toContain('Role details');
  });

  it('keeps unknown distinct from met and carries the settling question', () => {
    setTerms({ minimumSalary: 150000, hardConstraints: ['compensation'] });
    const html = render([row('A')]);
    expect(verdictOf(html, 'A')).toBe('hard_unknown');
    expect(html).toContain('data-constraint-key="compensation" data-constraint-status="unknown"');
    expect(html).toContain('Minimum pay: Unknown');
    expect(html).not.toContain('Minimum pay: Met');
    expect(html).toContain('Next: Ask the source for the pay range before spending time on this role.');
  });

  it('never filters or reorders: a role that fails a hard term stays first', () => {
    setTerms({ preferredStates: ['CA'], hardConstraints: ['location'] });
    const html = render([row('A', { state: 'TX' }), row('B', { state: 'CA' })]);
    expect(verdictOf(html, 'A')).toBe('hard_not_met');
    expect(verdictOf(html, 'B')).toBe('hard_met');
    expect(html.indexOf('Practitioner A')).toBeLessThan(html.indexOf('Practitioner B'));
  });

  it('soft terms report without a hard verdict and without the miss heading', () => {
    setTerms({ preferredStates: ['CA'] });
    const html = render([row('A')]);
    expect(verdictOf(html, 'A')).toBe('no_hard_terms');
    expect(html).toContain('Location: Not met');
    expect(html).not.toContain('fails a term you marked non-negotiable');
  });

  it('says "no terms" once for the list, never per row, and links to set them', () => {
    setTerms({});
    const html = render([row('A'), row('B'), row('C')]);
    expect(html.match(/data-terms-state="no_terms"/g)?.length).toBe(1);
    expect(html).toContain('href="/holder/matcha/onboarding"');
    expect(html).not.toContain('data-constraint-verdict');
    expect(html).not.toContain('Your terms, checked');
  });

  it('shows no verdict before the account store has answered', () => {
    setTerms({ preferredStates: ['CA'], hardConstraints: ['location'] }, { loaded: false });
    const html = render([row('A')]);
    expect(html).toContain('data-terms-state="loading"');
    expect(html).not.toContain('data-constraint-verdict');
    expect(html).not.toContain('Not met');
  });

  it('discloses a degraded store instead of presenting browser-only terms as the account\'s', () => {
    setTerms({ preferredStates: ['TX'] }, { sync: 'degraded' });
    const html = render([row('A')]);
    expect(html).toContain('data-terms-state="degraded"');
    expect(html).toContain('Location: Met');
  });

  it('renders no score, percentage, or eligibility wording', () => {
    setTerms({ preferredStates: ['CA'], minimumSalary: 150000, employmentTypes: ['full_time'], visaSponsorshipNeeded: true, hardConstraints: ['location', 'compensation'] });
    const html = render([row('A')]);
    const strip = html.slice(html.indexOf('Your terms'), html.indexOf('Posted'));
    expect(strip).not.toMatch(/\d+\s?%/);
    expect(strip).not.toMatch(/\b(score|eligible|ineligible|qualified)\b/i);
    expect(strip).not.toContain('Verified');
  });
});

describe('statedConstraintKeys agrees with the evaluator', () => {
  const cases: MatchaPreferences[] = [
    {},
    { preferredStates: ['CA'] },
    { preferredStates: [' '], minimumSalary: 1 },
    { minimumSalary: Number.NaN, employmentTypes: [] },
    { employmentTypes: ['locums'], visaSponsorshipNeeded: false },
    { visaSponsorshipNeeded: true, preferredStates: ['tx'], minimumSalary: 200000, employmentTypes: ['per_diem'] },
  ];
  for (const prefs of cases) {
    it(`for ${JSON.stringify(prefs)}`, () => {
      const stated = statedConstraintKeys(prefs);
      const evaluated = evaluateConstraintFit(prefs, row('X')).results.map((r) => r.key).sort();
      expect([...stated].sort()).toEqual(evaluated);
    });
  }
});
