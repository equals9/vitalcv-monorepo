// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import ClinicianLaunchTracker from '../components/mobile/ClinicianLaunchTracker';
import ClinicianReadinessSurface from '../components/mobile/ClinicianReadinessSurface';
import ClinicianUpdatesSurface from '../components/mobile/ClinicianUpdatesSurface';
import ClinicianAlertsSurface from '../components/mobile/ClinicianAlertsSurface';
import ClinicianApplicationDetailSurface from '../components/mobile/ClinicianApplicationDetailSurface';
import ClinicianBlockerDetailSurface from '../components/mobile/ClinicianBlockerDetailSurface';
import { OpportunityGrid } from '../components/mobile/ClinicianPanels';
import { WalletPassport } from '../components/wallet/WalletPassport';
import {
  ActivateOnboardingStep,
  NpiOnboardingStep,
} from '../components/onboarding/OnboardingFlowSteps';
import type { RoleContextValue } from '../components/auth/RoleContext';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

const {
  trackClinicianEventMock,
  trackClinicianEventOncePerSessionMock,
  routerReplaceMock,
  routerPushMock,
} = vi.hoisted(() => ({
  trackClinicianEventMock: vi.fn(async () => undefined),
  trackClinicianEventOncePerSessionMock: vi.fn(async () => undefined),
  routerReplaceMock: vi.fn(),
  routerPushMock: vi.fn(),
}));

let mockPathname = '/holder/home';
let roleContextValue: RoleContextValue = {
  isLoaded: true,
  isSignedIn: true,
  clerkRole: 'CLINICIAN',
  persona: 'CLINICIAN',
  role: 'clinician',
  landingRoute: '/holder/home',
  isClinician: true,
  isEmployer: false,
  clinicianNpi: '1234567890',
  employerOrgId: null,
  workspace: null,
  refresh: async () => undefined,
};

vi.mock('@/lib/mobile/analytics', () => ({
  trackClinicianEvent: trackClinicianEventMock,
  trackClinicianEventOncePerSession: trackClinicianEventOncePerSessionMock,
}));

vi.mock('@/components/auth/RoleContext', () => ({
  useRoleContext: () => roleContextValue,
  // OpportunityGrid now reads the clinician's terms through useMatchaPreferences,
  // which asks for the optional context so an isolated render does not throw.
  useOptionalRoleContext: () => roleContextValue,
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(), usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
  }),
  notFound: () => {
    throw new Error('notFound');
  },
}));

function buildApplication(id = 'app_1') {
  return {
    id,
    opportunityId: 'opp_1',
    status: 'PENDING',
    createdAt: '2026-03-20T10:00:00.000Z',
    updatedAt: '2026-03-20T10:30:00.000Z',
    reviewedAt: null,
    reviewNote: null,
    employer: { organizationId: 'org_1', name: 'Providence' },
    opportunity: {
      id: 'opp_1',
      organizationId: 'org_1',
      organizationName: 'Providence',
      title: 'Travel ICU Nurse',
      specialty: 'ICU',
      hiringType: 'contract',
      state: 'OR',
      payRange: '$3,600/week',
      status: 'ACTIVE',
    },
    provider: {
      npi: '1234567890',
      fullName: 'Ada Lovelace',
      specialty: 'ICU',
      stateOfPractice: 'OR',
    },
    readiness: {
      readinessScore: 88,
      readinessLevel: 'L2' as const,
      readinessStatus: 'Mostly ready - minor gaps remain',
      gapSummary: ['DEA registration not verified'],
      keyCredentials: ['License'],
      trustSignals: ['NPI identity verified'],
    },
    latestRecommendation: {
      actionType: 'CONTINUE_REVIEW',
      label: 'Continue review',
      explanation: 'Employer review is active.',
    },
    timeline: [],
    systemBehavesAutonomously: false,
  };
}

function buildData(overrides: Partial<ClinicianMobileData> = {}): ClinicianMobileData {
  const application = buildApplication();

  return {
    signedIn: true,
    workspace: {
      personProfile: {
        npi: '1234567890',
        firstName: 'Ada',
        lastName: 'Lovelace',
        specialty: 'ICU',
        stateOfPractice: 'OR',
        completeness: 92,
      },
    },
    trustState: {
      npi: '1234567890',
      readinessLevel: 'L2',
      readinessScore: 88,
      readinessStatus: 'Mostly ready - minor gaps remain',
      trustBand: 'L2',
      trustScore: 88,
      gapSummary: ['DEA registration not verified'],
      computedAt: '2026-03-20T10:30:00.000Z',
      cached: false,
    },
    applications: [application],
    opportunities: [
      {
        id: 'opp_1',
        organizationId: 'org_1',
        organizationName: 'Providence',
        organizationSlug: 'providence',
        title: 'Travel ICU Nurse',
        specialty: 'ICU',
        hiringType: 'contract',
        state: 'OR',
        payRange: '$3,600/week',
        requirementLevel: 'L2',
        description: 'Live role',
        remote: false,
        status: 'ACTIVE',
        createdAt: '2026-03-18T10:00:00.000Z',
        application: null,
        match: {
          opportunityId: 'opp_1',
          band: 'CLEAR',
          score: 95,
          blockers: [],
          fitReasons: ['ICU specialty', 'Oregon license'],
        },
      },
    ],
    missingForHigherMatches: ['DEA registration'],
    refreshedAt: '2026-03-20T10:30:00.000Z',
    profileCompleteness: {
      score: 92,
      dimensions: {
        npiVerified: true,
        resumeUploaded: true,
        linksAdded: true,
        workAuthProvided: true,
        credentialsImported: true,
      },
    },
    trustHistory: [
      {
        id: 'history_1',
        npi: '1234567890',
        readinessLevel: 'L2',
        readinessScore: 88,
        readinessStatus: 'Mostly ready - minor gaps remain',
        trustBand: 'L2',
        trustScore: 88,
        gapSummary: ['DEA registration not verified'],
        computedAt: '2026-03-20T10:30:00.000Z',
        cached: false,
        deltaScore: 3,
        deltaBand: 'up',
        previousLevel: 'L1',
        previousScore: 85,
        newGaps: [],
        resolvedGaps: [],
        reason: 'License import completed',
      },
    ],
    notifications: [
      {
        id: 'notification_1',
        type: 'application_status_changed',
        occurredAt: '2026-03-20T10:35:00.000Z',
        title: 'Application reviewed',
        body: 'Travel ICU Nurse is now in review.',
        href: '/holder/applications/app_1',
        ctaLabel: 'Open application',
        relatedBlockerId: 'blocker_1',
        relatedApplicationId: 'app_1',
        relatedOpportunityId: 'opp_1',
      },
    ],
    blockers: [
      {
        id: 'blocker_1',
        type: 'missing_credential',
        title: 'Credential evidence missing',
        label: 'Upload DEA registration',
        detail: 'Upload your DEA registration',
        explanation: 'Employer review is waiting on your DEA registration.',
        href: '/holder/blockers/blocker_1',
        nextActionLabel: 'Upload credential',
        nextActionHref: '/documents',
        occurredAt: '2026-03-20T09:00:00.000Z',
        relatedApplicationId: 'app_1',
        relatedOpportunityId: 'opp_1',
        priority: 10,
      },
    ],
    activeApplications: [application],
    availableOpportunities: [
      {
        id: 'opp_2',
        organizationId: 'org_2',
        organizationName: 'Legacy Health',
        organizationSlug: 'legacy-health',
        title: 'ICU Float Nurse',
        specialty: 'ICU',
        hiringType: 'contract',
        state: 'OR',
        payRange: '$3,800/week',
        requirementLevel: 'L2',
        description: 'Live role',
        remote: false,
        status: 'ACTIVE',
        createdAt: '2026-03-18T10:00:00.000Z',
        application: null,
        match: {
          opportunityId: 'opp_2',
          band: 'CLEAR',
          score: 92,
          blockers: [],
          fitReasons: ['ICU specialty', 'Oregon license'],
        },
      },
    ],
    recommendedAction: {
      kind: 'resolve_gap',
      title: 'Resolve your top blocker',
      description: 'Upload DEA registration',
      href: '/holder/readiness',
      ctaLabel: 'Open readiness',
    },
    ...overrides,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function waitForCondition(
  condition: () => boolean,
  message: string,
  attempts = 20,
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (condition()) {
      return;
    }

    await flush();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  throw new Error(message);
}

async function renderNode(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(node);
  });
  await flush();

  return {
    container,
    root,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function renderWithProvider(node: React.ReactNode, data: ClinicianMobileData = buildData()) {
  return renderNode(
    <ClinicianMobileProvider initialData={data}>
      {node}
    </ClinicianMobileProvider>,
  );
}

function trackNames() {
  return trackClinicianEventMock.mock.calls.map((call) => call[0]);
}

function trackOnceNames() {
  return trackClinicianEventOncePerSessionMock.mock.calls.map((call) => call[1]);
}

async function clickByText(
  container: HTMLElement,
  text: string,
  options?: { index?: number },
) {
  const matches = Array.from(container.querySelectorAll<HTMLElement>('button, a'))
    .filter((node) => node.textContent?.includes(text));
  const element = matches[options?.index ?? 0];
  if (!element) {
    throw new Error(`Unable to find clickable element containing "${text}"`);
  }

  await act(async () => {
    element.click();
  });
}

describe('mobile launch analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('React', React);
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockPathname = '/holder/home';
    roleContextValue = {
      isLoaded: true,
      isSignedIn: true,
      clerkRole: 'CLINICIAN',
      persona: 'CLINICIAN',
      role: 'clinician',
      landingRoute: '/holder/home',
      isClinician: true,
      isEmployer: false,
      clinicianNpi: '1234567890',
      employerOrgId: null,
      workspace: null,
      refresh: async () => undefined,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emits clinician sign-in when the mobile workspace loads', async () => {
    const view = await renderWithProvider(<div>workspace</div>);

    expect(trackOnceNames()).toContain('clinician.sign_in');

    await view.unmount();
  });

  it('emits readiness, alert, status, wallet, and application detail events on their live surfaces', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      npi: '1234567890',
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: true,
      credentialCount: 3,
      readiness_level: 'L2',
      readiness_status: 'Mostly ready - minor gaps remain',
      readiness_score: 88,
      gap_summary: ['DEA registration not verified'],
      computed_at: '2026-03-20T10:30:00.000Z',
      facts: [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    let view = await renderWithProvider(<ClinicianReadinessSurface />);
    expect(trackOnceNames()).toContain('clinician.readiness_viewed');
    await view.unmount();

    view = await renderWithProvider(<ClinicianUpdatesSurface />);
    expect(trackOnceNames()).toContain('clinician.application_status_viewed');
    await view.unmount();

    view = await renderWithProvider(<ClinicianAlertsSurface />);
    expect(trackOnceNames()).toContain('clinician.alert_viewed');
    await view.unmount();

    view = await renderNode(<WalletPassport npi="1234567890" pollIntervalMs={0} />);
    await flush();
    expect(trackOnceNames()).toContain('clinician.wallet_viewed');
    await view.unmount();

    view = await renderWithProvider(
      <ClinicianApplicationDetailSurface
        applicationId="app_1"
        evidenceResult={{ status: 'error', message: 'Application evidence is temporarily unavailable.' }}
      />,
    );
    expect(trackOnceNames()).toContain('clinician.application_detail_viewed');
    await view.unmount();
  });

  it('emits blocker opened and blocker resolved events across the blocker loop', async () => {
    let view = await renderWithProvider(<ClinicianBlockerDetailSurface blockerId="blocker_1" />);
    expect(trackNames()).toContain('clinician.blocker_opened');
    await view.unmount();

    window.localStorage.setItem('vitalcv.mobile.opened-blockers', JSON.stringify([
      {
        id: 'blocker_1',
        type: 'missing_credential',
        label: 'Upload DEA registration',
      },
    ]));

    view = await renderWithProvider(<ClinicianLaunchTracker />, buildData({ blockers: [] }));
    expect(trackNames()).toContain('clinician.blocker_resolved');
    await view.unmount();
  });

  it('emits onboarding started and completed across the onboarding flow', async () => {
    let fetchCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      fetchCalls += 1;
      const url = String(input);

      if (url.endsWith('/api/credentials/ingest-npi')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/clinician/activate')) {
        return new Response(JSON.stringify({
          readinessLevel: 'L3',
          readinessScore: 96,
          readinessStatus: 'Ready to credential',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }));

    let view = await renderNode(<NpiOnboardingStep returnTo={null} guestMode={false} />);
    expect(trackOnceNames()).toContain('clinician.onboarding_started');
    await view.unmount();

    window.sessionStorage.setItem('onboarding_npi', '1234567890');
    view = await renderNode(<ActivateOnboardingStep guestMode={false} returnTo={null} />);
    await flush();
    await flush();

    expect(fetchCalls).toBeGreaterThanOrEqual(2);
    await waitForCondition(
      () => trackNames().includes('clinician.onboarding_completed'),
      'Expected onboarding completion analytics to fire.',
    );
    expect(trackNames()).toContain('clinician.onboarding_completed');

    await view.unmount();
  });

  it('emits opportunity viewed plus apply started and submitted in the apply flow', async () => {
    const submittedApplication = {
      ...buildApplication('app_2'),
      opportunityId: 'opp_2',
      opportunity: {
        id: 'opp_2',
        organizationId: 'org_2',
        organizationName: 'Legacy Health',
        title: 'ICU Float Nurse',
        specialty: 'ICU',
        hiringType: 'contract',
        state: 'OR',
        payRange: '$3,800/week',
        status: 'ACTIVE',
      },
    };

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/trust-state/1234567890') {
        return new Response(JSON.stringify({
          npi: '1234567890',
          readiness_level: 'L2',
          readiness_score: 88,
          readiness_status: 'Mostly ready - minor gaps remain',
          trustBand: 'L2',
          trustScore: 88,
          gap_summary: ['DEA registration not verified'],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === '/api/opportunities/opp_2/apply') {
        return new Response(JSON.stringify(submittedApplication), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }));

    const data = buildData({
      opportunities: [],
      availableOpportunities: [
        {
          id: 'opp_2',
          organizationId: 'org_2',
          organizationName: 'Legacy Health',
          organizationSlug: 'legacy-health',
          title: 'ICU Float Nurse',
          specialty: 'ICU',
          hiringType: 'contract',
          state: 'OR',
          payRange: '$3,800/week',
          requirementLevel: 'L2',
          description: 'Live role',
          remote: false,
          status: 'ACTIVE',
          createdAt: '2026-03-18T10:00:00.000Z',
          application: null,
          match: {
            opportunityId: 'opp_2',
            band: 'CLEAR',
            score: 92,
            blockers: [],
            fitReasons: ['ICU specialty', 'Oregon license'],
          },
        },
      ],
    });

    const view = await renderWithProvider(
      <OpportunityGrid opportunities={data.availableOpportunities} />,
      data,
    );

    await clickByText(view.container, 'Apply now');
    await waitForCondition(
      () => trackNames().includes('clinician.apply_started'),
      'Expected apply-started analytics to fire after opening the apply modal.',
    );

    expect(trackOnceNames()).toContain('clinician.opportunity_viewed');
    expect(trackNames()).toContain('clinician.apply_started');

    const textarea = view.container.querySelector('textarea');
    if (!textarea) {
      throw new Error('ApplyModal textarea not found');
    }
    await act(async () => {
      const input = textarea as HTMLTextAreaElement;
      input.value = 'Ready to start next week.';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const submitButton = view.container.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!submitButton) {
      throw new Error('ApplyModal submit button not found');
    }
    await act(async () => {
      submitButton.click();
    });
    await waitForCondition(
      () => trackNames().includes('clinician.apply_submitted'),
      'Expected apply-submitted analytics to fire after submitting the application.',
    );

    expect(trackNames()).toContain('clinician.apply_submitted');

    await view.unmount();
  });
});
