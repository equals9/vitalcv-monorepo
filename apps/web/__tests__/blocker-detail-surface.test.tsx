import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import ClinicianBlockerDetailSurface from '../components/mobile/ClinicianBlockerDetailSurface';
import HolderBlockerDetailPage from '../app/holder/blockers/[blockerId]/page';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    redirect: vi.fn(), usePathname: () => '/holder/blockers/missing_credential%3Aapp_1%3Aopp_1%3Astate-license-evidence-missing',
  };
});

function buildSampleData(): ClinicianMobileData {
  return {
    signedIn: true,
    workspace: {
      personProfile: {
        npi: '1234567890',
        firstName: 'Ada',
        lastName: 'Lovelace',
        specialty: 'ICU',
        stateOfPractice: 'OR',
        completeness: 88,
      },
    },
    trustState: null,
    applications: [],
    opportunities: [],
    missingForHigherMatches: [],
    refreshedAt: '2026-03-20T10:30:00.000Z',
    profileCompleteness: null,
    trustHistory: [],
    notifications: [],
    blockers: [
      {
        id: 'missing_credential:app_1:opp_1:state-license-evidence-missing',
        type: 'missing_credential',
        title: 'Credential evidence missing',
        label: 'State license evidence missing',
        detail: 'State license evidence missing',
        explanation: 'Upload the current state license so this application can keep moving.',
        href: '/holder/blockers/missing_credential%3Aapp_1%3Aopp_1%3Astate-license-evidence-missing',
        nextActionLabel: 'Upload evidence',
        nextActionHref: '/holder/blockers/missing_credential%3Aapp_1%3Aopp_1%3Astate-license-evidence-missing',
        occurredAt: '2026-03-20T10:30:00.000Z',
        relatedApplicationId: 'app_1',
        relatedOpportunityId: 'opp_1',
        priority: 10,
      },
    ],
    activeApplications: [
      {
        id: 'app_1',
        opportunityId: 'opp_1',
        status: 'REVIEWED',
        createdAt: '2026-03-19T08:00:00.000Z',
        updatedAt: '2026-03-20T10:30:00.000Z',
        reviewedAt: '2026-03-20T10:30:00.000Z',
        reviewNote: 'Waiting for updated state license.',
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
        provider: null,
        readiness: {
          readinessScore: 84,
          readinessLevel: 'L2',
          readinessStatus: 'Mostly ready - missing evidence',
          gapSummary: ['State license evidence missing'],
          keyCredentials: ['Oregon license'],
          trustSignals: ['NPI identity verified'],
        },
        latestRecommendation: {
          actionType: 'UPLOAD_EVIDENCE',
          label: 'Upload updated evidence',
          explanation: 'Resolve the missing document to keep review moving.',
        },
        timeline: [],
        systemBehavesAutonomously: false,
      },
    ],
    availableOpportunities: [],
    recommendedAction: {
      kind: 'resolve_gap',
      title: 'Resolve what is left',
      description: 'State license evidence missing',
      href: '/holder/blockers/missing_credential%3Aapp_1%3Aopp_1%3Astate-license-evidence-missing',
      ctaLabel: 'Resolve blocker',
    },
  };
}

describe('ClinicianBlockerDetailSurface', () => {
  it('shows the payoff and upload path for a blocker when upload is enabled', () => {
    const markup = renderToStaticMarkup(
      <ClinicianMobileProvider initialData={buildSampleData()}>
        <ClinicianBlockerDetailSurface
          blockerId="missing_credential:app_1:opp_1:state-license-evidence-missing"
          evidenceUploadEnabled
        />
      </ClinicianMobileProvider>,
    );

    expect(markup).toContain('Why this is worth doing now');
    expect(markup).toContain('Upload what clears this blocker');
    expect(markup).toContain('Related application');
    expect(markup).toContain('What happens after upload');
  });
});

// ── Upload panel is flag-gated on this page too ──────────────────────────────
//
// The panel's second mount. The surface is a client component, so the page
// reads EVIDENCE_UPLOAD_ENABLED on the server and passes the decision down.
// The surface defaults to hidden, so a mount that forgets the prop fails
// closed. When hidden, an upload blocker shows a plain "not available yet"
// notice instead of the generic next-action button, whose link would point
// straight back at this page.

const BLOCKER_ID = 'missing_credential:app_1:opp_1:state-license-evidence-missing';
const SELF_HREF = '/holder/blockers/missing_credential%3Aapp_1%3Aopp_1%3Astate-license-evidence-missing';
const PANEL_HEADING = 'Upload what clears this blocker';
const PANEL_FOOTER = 'What happens after upload';
const UNAVAILABLE = 'Adding documents is not available yet';

function renderSurface(props: { evidenceUploadEnabled?: boolean }, data = buildSampleData()): string {
  return renderToStaticMarkup(
    <ClinicianMobileProvider initialData={data}>
      <ClinicianBlockerDetailSurface blockerId={BLOCKER_ID} {...props} />
    </ClinicianMobileProvider>,
  );
}

async function renderPage(): Promise<string> {
  const element = await HolderBlockerDetailPage({
    params: Promise.resolve({ blockerId: encodeURIComponent(BLOCKER_ID) }),
  });
  return renderToStaticMarkup(
    <ClinicianMobileProvider initialData={buildSampleData()}>{element}</ClinicianMobileProvider>,
  );
}

describe('ClinicianBlockerDetailSurface upload gating', () => {
  it('hides the panel when the prop is omitted (fails closed)', () => {
    const markup = renderSurface({});
    expect(markup).not.toContain(PANEL_HEADING);
    expect(markup).not.toContain(PANEL_FOOTER);
  });

  it('when hidden, says upload is unavailable instead of a button that loops back to this page', () => {
    const markup = renderSurface({ evidenceUploadEnabled: false });
    expect(markup).toContain(UNAVAILABLE);
    expect(markup).not.toContain(`href="${SELF_HREF}"`);
    expect(markup).not.toContain('Do this now');
    // Still somewhere to go.
    expect(markup).toContain('href="/holder/applications/app_1"');
    // Truth contract: the notice is not a verification outcome.
    expect(markup).not.toMatch(/\bverified\b/i);
  });

  it('a blocker that is not an upload blocker keeps its own next action', () => {
    const data = buildSampleData();
    data.blockers[0] = {
      ...data.blockers[0],
      type: 'application_requirement_gap',
      nextActionLabel: 'Review requirements',
      nextActionHref: '/holder/readiness',
    };
    const markup = renderSurface({ evidenceUploadEnabled: false }, data);
    expect(markup).toContain('Do this now');
    expect(markup).toContain('Review requirements');
    expect(markup).not.toContain(UNAVAILABLE);
    expect(markup).not.toContain(PANEL_HEADING);
  });
});

describe('/holder/blockers/[blockerId] passes the server flag down', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.EVIDENCE_UPLOAD_ENABLED;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.EVIDENCE_UPLOAD_ENABLED;
    else process.env.EVIDENCE_UPLOAD_ENABLED = saved;
  });

  it('renders the blocker at all (anti-vacuity)', async () => {
    delete process.env.EVIDENCE_UPLOAD_ENABLED;
    const markup = await renderPage();
    expect(markup).toContain('Why this is worth doing now');
  });

  it('hides the panel when the variable is unset', async () => {
    delete process.env.EVIDENCE_UPLOAD_ENABLED;
    const markup = await renderPage();
    expect(markup).not.toContain(PANEL_HEADING);
    expect(markup).toContain(UNAVAILABLE);
  });

  it.each(['true', '1', 'on', 'ENABLED'])('stays hidden for the non-literal value %s', async (value) => {
    process.env.EVIDENCE_UPLOAD_ENABLED = value;
    const markup = await renderPage();
    expect(markup).not.toContain(PANEL_HEADING);
  });

  it('shows the panel for the literal "enabled"', async () => {
    process.env.EVIDENCE_UPLOAD_ENABLED = 'enabled';
    const markup = await renderPage();
    expect(markup).toContain(PANEL_HEADING);
    expect(markup).not.toContain(UNAVAILABLE);
  });
});
