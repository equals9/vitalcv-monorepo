/**
 * Bundle 1 — the integrated-apply boundary, against a REAL database.
 *
 * The acceptance gate this proves: a feed-copied listing cannot enter
 * "Apply with VitalCV", and refusing writes NOTHING.
 *
 * The second half is the point. A refusal that still recorded a consent audit
 * row, a half-built application, or a sealed packet would be worse than the
 * defect it replaced — the clinician would hold a consent receipt for a
 * disclosure that never happened. So every refusal asserts the absence of
 * rows in the three tables the happy path writes for this clinician:
 * applications, application_packets, and audit_events (counted across ALL
 * audit types, not just consent, so a stray event of any kind still fails).
 *
 * The employer-authored case runs in the SAME suite deliberately: a guard that
 * refuses everything also passes a red-means-red test. The positive case is
 * what proves the guard is a boundary rather than an off switch.
 *
 * Only the evidence resolver is mocked — it performs network I/O (NPPES). The
 * database, transaction and uniqueness constraints are real, because the
 * question under test is what is durably written.
 */

import { PrismaClient } from '@prisma/client';

const trustStateMock = jest.fn();
jest.mock('../../trust/trustStateEngine', () => ({
  ...jest.requireActual('../../trust/trustStateEngine'),
  computeClinicianTrustState: (npi: string) => trustStateMock(npi),
}));

// Downstream side effects are out of scope for this bundle's contract.
jest.mock('../../billing/billingEngine', () => ({ processApplicationBilling: jest.fn() }));
jest.mock('../../actions/actionEngineService', () => ({ refreshActionRecommendations: jest.fn() }));

import { applyToOpportunity } from '../applicationService';

const prisma = new PrismaClient();

/**
 * Sanctioned synthetic NPI: check-digit-invalid and absent from NPPES, so it
 * can never name a real registrant. See the 15583955xx family.
 */
const NPI = '1558395511';
const CLERK_USER = 'user_integrated_apply_boundary_test';

function trustState() {
  return {
    npi: NPI,
    identityVerified: true,
    licensureStatus: 'verified' as const,
    exclusionClear: true,
    credentialCount: 1,
    readiness_level: 'L2' as const,
    readiness_status: 'Provisional — licensure pending',
    readiness_score: 70,
    gap_summary: ['State licensure requires source access'],
    methodology_version: '243.3',
    computed_at: '2026-08-16T11:05:00.000Z',
    computedAt: '2026-08-16T11:05:00.000Z',
    trustBand: 'L2' as const,
    trustScore: 70,
    gaps: ['State licensure requires source access'],
    facts: [
      {
        factType: 'identity',
        source: 'NPPES',
        status: 'source_backed',
        verifiedAt: '2026-08-16T11:00:00.000Z',
        expiresAt: '2026-11-14T11:00:00.000Z',
        details: 'NPI active · name match',
      },
    ],
  };
}

let organizationId: string;
let feedOrganizationId: string;
let employerPostedOpportunityId: string;
let feedOpportunityId: string;
let namelessOrgOpportunityId: string;

async function countWrites() {
  const [applications, packets, consentEvents] = await Promise.all([
    prisma.application.count({ where: { clerkUserId: CLERK_USER } }),
    prisma.applicationPacket.count({ where: { clerkUserId: CLERK_USER } }),
    prisma.auditEvent.count({ where: { clinicianId: CLERK_USER } }),
  ]);
  return { applications, packets, consentEvents };
}

beforeAll(async () => {
  const stamp = Date.now();

  const org = await prisma.organization.create({
    data: { name: 'Boundary Test Health', slug: `boundary-test-${stamp}` },
  });
  organizationId = org.id;

  // The ingestion runner attaches feed rows to a placeholder organization that
  // carries the employer's name without that employer having claimed it here.
  const feedOrg = await prisma.organization.create({
    data: { name: 'Ingested Placeholder Health', slug: `boundary-feed-${stamp}` },
  });
  feedOrganizationId = feedOrg.id;

  const employerPosted = await prisma.opportunity.create({
    data: {
      organizationId,
      title: 'Hospitalist',
      specialty: 'Internal Medicine',
      state: 'CA',
      status: 'ACTIVE',
      hiringType: 'PERMANENT',
      // listingSource intentionally omitted: createOpportunity never sets it,
      // so the column default is what a real employer-posted row carries.
    },
  });
  employerPostedOpportunityId = employerPosted.id;

  const feedListing = await prisma.opportunity.create({
    data: {
      organizationId: feedOrganizationId,
      title: 'Hospitalist',
      specialty: 'Internal Medicine',
      state: 'CA',
      status: 'ACTIVE',
      hiringType: 'PERMANENT',
      listingSource: 'public_feed',
      sourceFeed: 'boundary-test-feed',
      sourceRef: `boundary-test-ref-${stamp}`,
    },
  });
  feedOpportunityId = feedListing.id;

  const namelessOrg = await prisma.organization.create({
    data: { name: '', slug: `boundary-nameless-${stamp}` },
  });
  const namelessOpportunity = await prisma.opportunity.create({
    data: {
      organizationId: namelessOrg.id,
      title: 'Hospitalist',
      specialty: 'Internal Medicine',
      state: 'CA',
      status: 'ACTIVE',
      hiringType: 'PERMANENT',
    },
  });
  namelessOrgOpportunityId = namelessOpportunity.id;

  const user = await prisma.user.create({
    data: { clerkUserId: CLERK_USER, email: `${CLERK_USER}@example.com` },
  });
  await prisma.personProfile.create({ data: { userId: user.id, npi: NPI } });
});

afterAll(async () => {
  await prisma.applicationPacket.deleteMany({ where: { clerkUserId: CLERK_USER } });
  await prisma.application.deleteMany({ where: { clerkUserId: CLERK_USER } });
  await prisma.auditEvent.deleteMany({ where: { clinicianId: CLERK_USER } });
  await prisma.opportunity.deleteMany({
    where: { id: { in: [employerPostedOpportunityId, feedOpportunityId, namelessOrgOpportunityId] } },
  });
  await prisma.personProfile.deleteMany({ where: { npi: NPI } });
  await prisma.user.deleteMany({ where: { clerkUserId: CLERK_USER } });
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: 'boundary-' } },
  });
  await prisma.$disconnect();
});

beforeEach(async () => {
  trustStateMock.mockReset();
  trustStateMock.mockResolvedValue(trustState());
  await prisma.applicationPacket.deleteMany({ where: { clerkUserId: CLERK_USER } });
  await prisma.application.deleteMany({ where: { clerkUserId: CLERK_USER } });
  await prisma.auditEvent.deleteMany({ where: { clinicianId: CLERK_USER } });
});

describe('integrated apply boundary (real DB)', () => {
  it('refuses a feed-copied listing, saying where the application actually happens', async () => {
    // Asserting the MESSAGE, not just the 409: this endpoint already throws
    // three other 409s, so a status-only assertion cannot tell the feed
    // refusal from "no longer accepting applications" or a missing NPI.
    await expect(
      applyToOpportunity({ opportunityId: feedOpportunityId, clerkUserId: CLERK_USER }),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('employer’s own job posting'),
    });
  });

  it('writes NOTHING when it refuses a feed listing', async () => {
    await expect(
      applyToOpportunity({ opportunityId: feedOpportunityId, clerkUserId: CLERK_USER }),
    ).rejects.toThrow();

    // No application, no immutable packet, and — the one that would be worst —
    // no consent audit row claiming the clinician disclosed to the placeholder.
    expect(await countWrites()).toEqual({ applications: 0, packets: 0, consentEvents: 0 });
  });

  it('does not resolve clinician evidence for a refused listing', async () => {
    // Refusing after computing trust state would mean a disclosure that cannot
    // be delivered still triggered evidence resolution about the clinician.
    await expect(
      applyToOpportunity({ opportunityId: feedOpportunityId, clerkUserId: CLERK_USER }),
    ).rejects.toThrow();

    expect(trustStateMock).not.toHaveBeenCalled();
  });

  it('refuses when no recipient name resolves, and writes nothing', async () => {
    await expect(
      applyToOpportunity({ opportunityId: namelessOrgOpportunityId, clerkUserId: CLERK_USER }),
    ).rejects.toMatchObject({
      status: 409,
      // A distinct reason must carry distinct text — swapping the two
      // messages must not pass.
      message: expect.stringContaining('not currently accepting applications through VitalCV'),
    });

    expect(await countWrites()).toEqual({ applications: 0, packets: 0, consentEvents: 0 });
  });

  it('still seals an employer-authored application, naming the real recipient', async () => {
    // The guard is a boundary, not an off switch.
    const application = await applyToOpportunity({
      opportunityId: employerPostedOpportunityId,
      clerkUserId: CLERK_USER,
    });

    expect(application.id).toBeTruthy();

    const packet = await prisma.applicationPacket.findFirstOrThrow({
      where: { applicationId: application.id },
      orderBy: { packetVersion: 'desc' },
    });
    expect(packet.recipient).toBe('Boundary Test Health');
    expect(packet.employerOrgId).toBe(organizationId);

    const written = await countWrites();
    expect(written.applications).toBe(1);
    expect(written.packets).toBe(1);
    // Consent is recorded as a durable audit row, never a boolean.
    expect(written.consentEvents).toBeGreaterThan(0);
  });

  it('still returns an ALREADY-SEALED application after the row is re-stamped as a feed row', async () => {
    // Eligibility governs sealing a new disclosure. It must never retroactively
    // hide a disclosure the clinician properly made: the guard sits after the
    // idempotent fast path precisely so this read keeps working.
    const sealed = await applyToOpportunity({
      opportunityId: employerPostedOpportunityId,
      clerkUserId: CLERK_USER,
    });

    await prisma.opportunity.update({
      where: { id: employerPostedOpportunityId },
      data: { listingSource: 'public_feed' },
    });

    try {
      const reread = await applyToOpportunity({
        opportunityId: employerPostedOpportunityId,
        clerkUserId: CLERK_USER,
      });
      expect(reread.id).toBe(sealed.id);

      // And it did NOT reseal: still exactly one packet.
      expect((await countWrites()).packets).toBe(1);
    } finally {
      await prisma.opportunity.update({
        where: { id: employerPostedOpportunityId },
        data: { listingSource: 'employer_posted' },
      });
    }
  });

  it('refuses a NEW application on a listing that is later re-stamped as a feed row', async () => {
    // Ingestion can adopt an existing row. Eligibility is read at apply time,
    // never cached from when the row was created.
    await prisma.opportunity.update({
      where: { id: employerPostedOpportunityId },
      data: { listingSource: 'public_feed' },
    });

    try {
      await expect(
        applyToOpportunity({ opportunityId: employerPostedOpportunityId, clerkUserId: CLERK_USER }),
      ).rejects.toMatchObject({ status: 409 });
      expect(await countWrites()).toEqual({ applications: 0, packets: 0, consentEvents: 0 });
    } finally {
      await prisma.opportunity.update({
        where: { id: employerPostedOpportunityId },
        data: { listingSource: 'employer_posted' },
      });
    }
  });
});
