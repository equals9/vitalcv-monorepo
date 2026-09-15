// @vitest-environment jsdom

/**
 * Bundle 1 — what the signed-in opportunity card actually RENDERS.
 *
 * The sibling suite (integrated-apply-boundary.test.ts) covers the pure
 * decision functions. This one renders OpportunityGrid, because the defect
 * being fixed was not a wrong helper — it was a surface that never asked the
 * helper at all. Only a rendering assertion fails when a surface stops asking.
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { trackOnceMock } = vi.hoisted(() => ({ trackOnceMock: vi.fn(async () => undefined) }));

vi.mock('@/lib/mobile/analytics', () => ({
  trackClinicianEvent: vi.fn(async () => undefined),
  trackClinicianEventOncePerSession: trackOnceMock,
}));

vi.mock('@/components/auth/RoleContext', () => ({
  useRoleContext: () => ({
    isLoaded: true,
    isSignedIn: true,
    clerkRole: 'CLINICIAN',
    persona: 'CLINICIAN',
    role: 'clinician',
    landingRoute: '/holder/home',
    isClinician: true,
    isEmployer: false,
    clinicianNpi: '1558395511',
    employerOrgId: null,
    workspace: null,
    refresh: async () => undefined,
  }),
}));

let searchParams = new URLSearchParams();
const routerReplace = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  usePathname: () => '/holder/opportunities',
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: vi.fn(), replace: routerReplace }),
  notFound: () => {
    throw new Error('notFound');
  },
}));

import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import { OpportunityGrid } from '../components/mobile/ClinicianPanels';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

function opportunity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'opp_feed',
    organizationId: 'org_feed',
    organizationName: 'Ingested Placeholder Health',
    organizationSlug: 'ingested-placeholder',
    title: 'ICU Nurse',
    specialty: 'ICU',
    hiringType: 'contract',
    state: 'OR',
    payRange: '$3,600/week',
    requirementLevel: 'L2',
    description: 'Carried listing',
    remote: false,
    status: 'ACTIVE',
    createdAt: '2026-08-18T10:00:00.000Z',
    application: null,
    match: null,
    ...overrides,
  };
}

function data(opportunities: ReturnType<typeof opportunity>[]): ClinicianMobileData {
  return {
    signedIn: true,
    workspace: { personProfile: { npi: '1558395511' } },
    applications: [],
    opportunities,
    trustState: null,
    trustHistory: [],
    matches: [],
    refreshedAt: '2026-08-18T12:00:00.000Z',
    profileCompleteness: null,
    proof: null,
    blockers: [],
    activeApplications: [],
    availableOpportunities: opportunities,
    notifications: [],
    recommendedAction: null,
  } as unknown as ClinicianMobileData;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function render(opportunities: ReturnType<typeof opportunity>[]) {
  const mobileData = data(opportunities);
  await act(async () => {
    root.render(
      <ClinicianMobileProvider initialData={mobileData}>
        <OpportunityGrid opportunities={mobileData.availableOpportunities as never} />
      </ClinicianMobileProvider>,
    );
  });
  return container;
}

beforeEach(() => {
  searchParams = new URLSearchParams();
  trackOnceMock.mockClear();
  routerReplace.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('OpportunityGrid — integrated apply boundary', () => {
  it('offers the employer’s own listing, not an apply path, for a feed-carried role', async () => {
    const view = await render([
      opportunity({
        isFeedListing: true,
        applicationMode: 'external',
        source: { url: 'https://employer.example/careers/icu' },
      }),
    ]);

    expect(view.textContent).toContain('View original listing');
    expect(view.textContent).not.toContain('Apply now');

    const link = view.querySelector('a[href="https://employer.example/careers/icu"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('never renders a dead control when the feed row has no recorded source page', async () => {
    const view = await render([
      opportunity({ isFeedListing: true, applicationMode: 'external', source: null }),
    ]);

    expect(view.textContent).not.toContain('Apply now');
    // Every anchor still points somewhere.
    for (const anchor of Array.from(view.querySelectorAll('a'))) {
      expect(anchor.getAttribute('href')).toBeTruthy();
    }
  });

  it('still offers Apply now for an employer-authored role', async () => {
    const view = await render([
      opportunity({ id: 'opp_employer', isFeedListing: false, applicationMode: 'vitalcv' }),
    ]);

    expect(view.textContent).toContain('Apply now');
    expect(view.textContent).not.toContain('View original listing');
  });

  it('does not open the apply modal from an ?apply= deep link to a feed-carried role', async () => {
    searchParams = new URLSearchParams('apply=opp_feed');

    const view = await render([
      opportunity({
        isFeedListing: true,
        applicationMode: 'external',
        source: { url: 'https://employer.example/careers/icu' },
      }),
    ]);

    // The modal is what seals a packet; it must not mount for a feed row.
    expect(view.querySelector('#apply-modal-title')).toBeNull();
    expect(view.textContent).not.toContain('Apply now');
  });
});
