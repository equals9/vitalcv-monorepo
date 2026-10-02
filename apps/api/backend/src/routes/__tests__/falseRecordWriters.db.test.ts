/**
 * False-record writers — the apply path over HTTP, through the REAL middleware
 * stack, against a REAL database. Wave 0, items W0-01 and W0-02.
 *
 * What this suite proves:
 *   - a feed-carried listing cannot seal an application packet, and the
 *     refusal writes NOTHING (no application, no packet, no audit row);
 *   - an employer-posted listing whose organization was set up still seals
 *     one, naming the real recipient — the guard is a boundary, not an off
 *     switch;
 *   - identity comes from the verified session: an anonymous request and a
 *     bare identity header are refused before anything is read, and a
 *     verified token decides who applies even when a header names someone
 *     else;
 *   - the NPI the packet names is the profile's; a body NPI is ignored;
 *   - a pending, self-asserted NPI claim is a request, not authority — it
 *     gets the ownership 403 and seals nothing;
 *   - the identity-tier and availability gates still hold.
 *
 * The stack is the one app.ts mounts, in order: the real
 * `createVerifiedIdentityMiddleware` in shadow mode (RS256 tokens minted
 * against a local keypair and checked by the production `createTokenVerifier`,
 * so issuer, expiry, signature and the algorithm allowlist all run), the
 * tenant turnstile, the JSON parser, the real route registration, and the real
 * error handler. Only the evidence resolver (network I/O) and two downstream
 * side-effect services are mocked. `bindPlatformAdmin` is not mounted: it is
 * not on the apply path's authorization chain.
 *
 * The second half of every refusal is the point. A refusal that still
 * recorded a consent audit row, a half-built application, or a sealed packet
 * would be worse than the defect it replaced — the clinician would hold a
 * consent receipt for a disclosure that never happened. So every refusal
 * asserts the absence of rows in the three tables the happy path writes.
 */

import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { SignJWT, generateKeyPair } from 'jose';

// The middleware reads its mode from the validated env. Shadow mode runs the
// verifier when a bearer is present and leaves `verifiedAuth` for the route,
// which is what production runs under until the enforce flip.
jest.mock('../../config/env', () => {
  const actual = jest.requireActual('../../config/env') as typeof import('../../config/env');
  let loaded: ReturnType<typeof actual.loadEnv> | null = null;
  return {
    ...actual,
    env: () => {
      if (!loaded) {
        try {
          loaded = actual.env();
        } catch {
          loaded = actual.loadEnv();
        }
      }
      return {
        ...loaded,
        CLERK_JWT_VERIFICATION: 'shadow',
        CLERK_ISSUER: 'https://clerk.false-record-writers.test',
        CLERK_AUTHORIZED_PARTIES: [],
      };
    },
  };
});

const mockTrustState = jest.fn();
jest.mock('../../services/trust/trustStateEngine', () => ({
  ...jest.requireActual('../../services/trust/trustStateEngine'),
  computeClinicianTrustState: (npi: string) => mockTrustState(npi),
}));

// Downstream side effects are out of scope for this suite's contract.
jest.mock('../../services/billing/billingEngine', () => ({ processApplicationBilling: jest.fn() }));
jest.mock('../../services/actions/actionEngineService', () => ({
  refreshActionRecommendations: jest.fn(),
}));

import { createTokenVerifier, createVerifiedIdentityMiddleware, type TokenVerifier } from '../../middleware/verifiedIdentity';
import { requireTenantContextOrReadAccess } from '../../middleware/tenantGuard';
import { errorHandler } from '../../middleware/errorHandler';
import { registerApplicationRoutes } from '../applications';

const ISSUER = 'https://clerk.false-record-writers.test';
const prisma = new PrismaClient();

/*
 * Sanctioned synthetic NPIs: check-digit-invalid and absent from NPPES, so
 * they can never name a real registrant (the 15583955xx family). Each is
 * unique to this suite so a sibling suite that crashed before cleanup cannot
 * collide on the profile's unique NPI column.
 */
const OWNER_NPI = '1558395560';
const FOREIGN_NPI = '1558395561';
const LOW_TIER_NPI = '1558395562';
const PENDING_NPI = '1558395563';

const stamp = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
const OWNER = `user_frw_owner_${stamp}`;
const LOW_TIER = `user_frw_lowtier_${stamp}`;
const PENDING = `user_frw_pending_${stamp}`;
const SUITE_USERS = [OWNER, LOW_TIER, PENDING];

// jose's own key type (KeyLike in v5, CryptoKey in v6) — read off the generator
// so this file does not pin a jose major.
type JoseKeyPair = Awaited<ReturnType<typeof generateKeyPair>>;
let privateKey: JoseKeyPair['privateKey'];
let verifier: TokenVerifier;

let employerOrgId: string;
let feedOrgId: string;
let employerOpportunityId: string;
let feedOpportunityId: string;
let closedOpportunityId: string;

function trustState(npi: string) {
  return {
    npi,
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

async function mint(sub: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

function buildApp() {
  const app = express();
  app.use(createVerifiedIdentityMiddleware({ verifier }));
  app.use(requireTenantContextOrReadAccess);
  app.use(express.json({ limit: '1mb' }));
  registerApplicationRoutes(app);
  app.use(errorHandler);
  return app;
}

async function countWrites(clerkUserId: string) {
  const [applications, packets, auditRows] = await Promise.all([
    prisma.application.count({ where: { clerkUserId } }),
    prisma.applicationPacket.count({ where: { clerkUserId } }),
    prisma.auditEvent.count({ where: { clinicianId: clerkUserId } }),
  ]);
  return { applications, packets, auditRows };
}

const NOTHING = { applications: 0, packets: 0, auditRows: 0 };

async function createClinician(input: {
  clerkUserId: string;
  npi: string;
  verifiedEmail: string;
  ownership: 'verified' | 'pending';
}) {
  const user = await prisma.user.create({
    data: { clerkUserId: input.clerkUserId, email: `${input.clerkUserId}@example.com` },
  });
  await prisma.personProfile.create({
    data: { userId: user.id, npi: input.npi, verifiedEmail: input.verifiedEmail },
  });
  // `npi_ownership.user_id` holds the INTERNAL User.id, never the Clerk subject.
  await prisma.npiOwnership.create({
    data: input.ownership === 'verified'
      ? { userId: user.id, npi: input.npi, verifiedAt: new Date(), verificationMethod: 'ADMIN_VERIFIED' }
      : { userId: user.id, npi: input.npi, verificationMethod: 'CLAIMED' },
  });
  return user;
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  verifier = createTokenVerifier(pair.publicKey, ISSUER);

  // Claimed by an employer who went through setup: the profile is what the
  // integrated-apply rule reads as "somebody is here to receive this".
  const employerOrg = await prisma.organization.create({
    data: {
      name: 'False Record Employer',
      slug: `frw-employer-${stamp}`,
      organizationProfile: { create: { facilityType: 'hospital' } },
    },
  });
  employerOrgId = employerOrg.id;

  // The ingestion runner attaches feed rows to a placeholder organization that
  // carries the employer's name and — deliberately — no profile.
  const feedOrg = await prisma.organization.create({
    data: { name: 'Ingested Placeholder Health', slug: `frw-feed-${stamp}` },
  });
  feedOrgId = feedOrg.id;

  const baseRow = {
    title: 'Hospitalist',
    specialty: 'Internal Medicine',
    state: 'CA',
    hiringType: 'PERMANENT',
  };

  employerOpportunityId = (await prisma.opportunity.create({
    // listingSource intentionally omitted: createOpportunity never sets it, so
    // the column default is what a real employer-posted row carries.
    data: { ...baseRow, organizationId: employerOrgId, status: 'ACTIVE' },
  })).id;

  feedOpportunityId = (await prisma.opportunity.create({
    data: {
      ...baseRow,
      organizationId: feedOrgId,
      status: 'ACTIVE',
      listingSource: 'public_feed',
      sourceFeed: 'frw-test-feed',
      sourceRef: `frw-ref-${stamp}`,
      sourceUrl: 'https://employer.example/careers/hospitalist',
    },
  })).id;

  closedOpportunityId = (await prisma.opportunity.create({
    data: { ...baseRow, organizationId: employerOrgId, status: 'CLOSED' },
  })).id;

  // A work email at an institutional domain puts the profile at the
  // work_email_confirmed tier; a consumer mailbox leaves it at npi_bound.
  await createClinician({
    clerkUserId: OWNER,
    npi: OWNER_NPI,
    verifiedEmail: `owner@frw-hospital-${stamp}.org`,
    ownership: 'verified',
  });
  await createClinician({
    clerkUserId: LOW_TIER,
    npi: LOW_TIER_NPI,
    verifiedEmail: 'lowtier@gmail.com',
    ownership: 'verified',
  });
  await createClinician({
    clerkUserId: PENDING,
    npi: PENDING_NPI,
    verifiedEmail: `pending@frw-hospital-${stamp}.org`,
    ownership: 'pending',
  });
});

afterAll(async () => {
  const userIds = (await prisma.user.findMany({
    where: { clerkUserId: { in: SUITE_USERS } },
    select: { id: true },
  })).map(({ id }) => id);
  const organizationIds = [employerOrgId, feedOrgId].filter(Boolean);

  await prisma.applicationPacket.deleteMany({ where: { clerkUserId: { in: SUITE_USERS } } });
  await prisma.application.deleteMany({ where: { clerkUserId: { in: SUITE_USERS } } });
  await prisma.auditEvent.deleteMany({ where: { clinicianId: { in: SUITE_USERS } } });
  await prisma.npiOwnership.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.personProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { clerkUserId: { in: SUITE_USERS } } });
  await prisma.opportunity.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationProfile.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  mockTrustState.mockReset();
  mockTrustState.mockImplementation(async (npi: string) => trustState(npi));
  // Each case starts from no application: submission is idempotent by design,
  // so a leftover row would turn a refusal case into a fast-path read.
  await prisma.applicationPacket.deleteMany({ where: { clerkUserId: { in: SUITE_USERS } } });
  await prisma.application.deleteMany({ where: { clerkUserId: { in: SUITE_USERS } } });
  await prisma.auditEvent.deleteMany({ where: { clinicianId: { in: SUITE_USERS } } });
});

// ── W0-01 — feed rows cannot seal a packet ───────────────────────────────────

describe('feed rows cannot seal a packet (W0-01)', () => {
  it('refuses a feed-carried listing with 409, says where to apply, and writes nothing', async () => {
    const res = await request(buildApp())
      .post(`/api/opportunities/${feedOpportunityId}/apply`)
      .set('Authorization', `Bearer ${await mint(OWNER)}`)
      .send({ coverNote: 'Interested.' });

    expect(res.status).toBe(409);
    // The MESSAGE, not just the status: this route throws several 409s, and a
    // status-only assertion cannot tell the feed refusal from "no longer
    // accepting applications" or a missing NPI.
    expect(res.body).toMatchObject({
      error: { message: expect.stringContaining('employer’s own job posting') },
    });
    expect(await countWrites(OWNER)).toEqual(NOTHING);
    // Refusing after computing trust state would mean a disclosure that cannot
    // be delivered still triggered evidence resolution about the clinician.
    expect(mockTrustState).not.toHaveBeenCalled();
  });

  it('seals an application on an employer-posted, claimed listing and names the real recipient', async () => {
    const res = await request(buildApp())
      .post(`/api/opportunities/${employerOpportunityId}/apply`)
      .set('Authorization', `Bearer ${await mint(OWNER)}`)
      .send({ coverNote: 'Interested.', purpose: 'application' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();

    const packet = await prisma.applicationPacket.findFirstOrThrow({
      where: { applicationId: res.body.id },
      orderBy: { packetVersion: 'desc' },
    });
    expect(packet.recipient).toBe('False Record Employer');
    expect(packet.employerOrgId).toBe(employerOrgId);
    expect(packet.clinicianNpi).toBe(OWNER_NPI);

    const written = await countWrites(OWNER);
    expect(written.applications).toBe(1);
    expect(written.packets).toBe(1);
    // Consent is recorded as a durable audit row, never a boolean.
    expect(written.auditRows).toBeGreaterThan(0);
  });
});

// ── W0-02 — identity comes from the verified session ─────────────────────────

describe('identity comes from the verified session (W0-02)', () => {
  it('refuses an anonymous request with 401 and writes nothing', async () => {
    const res = await request(buildApp())
      .post(`/api/opportunities/${employerOpportunityId}/apply`)
      .send({ coverNote: 'Interested.' });

    expect(res.status).toBe(401);
    expect(await countWrites(OWNER)).toEqual(NOTHING);
    expect(mockTrustState).not.toHaveBeenCalled();
  });

  it('refuses a bare identity header with 401 — a header is an assertion, not a session', async () => {
    const res = await request(buildApp())
      .post(`/api/opportunities/${employerOpportunityId}/apply`)
      .set('x-clerk-user-id', OWNER)
      .send({ coverNote: 'Interested.' });

    expect(res.status).toBe(401);
    expect(await countWrites(OWNER)).toEqual(NOTHING);
    expect(mockTrustState).not.toHaveBeenCalled();
  });

  it('applies as the token subject even when a header names someone else', async () => {
    const res = await request(buildApp())
      .post(`/api/opportunities/${employerOpportunityId}/apply`)
      .set('Authorization', `Bearer ${await mint(OWNER)}`)
      .set('x-clerk-user-id', LOW_TIER)
      .send({ coverNote: 'Interested.' });

    expect(res.status).toBe(201);
    const application = await prisma.application.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(application.clerkUserId).toBe(OWNER);
    expect(await countWrites(LOW_TIER)).toEqual(NOTHING);
  });

  it('names the profile NPI in the packet and ignores a body NPI', async () => {
    const res = await request(buildApp())
      .post(`/api/opportunities/${employerOpportunityId}/apply`)
      .set('Authorization', `Bearer ${await mint(OWNER)}`)
      .send({ npi: FOREIGN_NPI, coverNote: 'Interested.' });

    expect(res.status).toBe(201);

    const application = await prisma.application.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(application.npi).toBe(OWNER_NPI);

    const packet = await prisma.applicationPacket.findFirstOrThrow({
      where: { applicationId: res.body.id },
    });
    expect(packet.clinicianNpi).toBe(OWNER_NPI);
    expect(await prisma.applicationPacket.count({ where: { clinicianNpi: FOREIGN_NPI } })).toBe(0);
    // Evidence was resolved for the clinician who applied, not the named one.
    expect(mockTrustState).toHaveBeenCalledWith(OWNER_NPI);
    expect(mockTrustState).not.toHaveBeenCalledWith(FOREIGN_NPI);
  });

  it('refuses a session below the work_email_confirmed tier with 403 and writes nothing', async () => {
    const res = await request(buildApp())
      .post(`/api/opportunities/${employerOpportunityId}/apply`)
      .set('Authorization', `Bearer ${await mint(LOW_TIER)}`)
      .send({ coverNote: 'Interested.' });

    expect(res.status).toBe(403);
    expect(await countWrites(LOW_TIER)).toEqual(NOTHING);
    expect(mockTrustState).not.toHaveBeenCalled();
  });

  it('refuses a pending, self-asserted NPI claim with the ownership 403 and seals nothing', async () => {
    const res = await request(buildApp())
      .post(`/api/opportunities/${employerOpportunityId}/apply`)
      .set('Authorization', `Bearer ${await mint(PENDING)}`)
      .send({ coverNote: 'Interested.' });

    expect(res.status).toBe(403);
    // The stable code the Apply surface routes on, so a pending clinician is
    // sent into verification rather than shown a generic refusal.
    expect(res.body).toMatchObject({ error: { code: 'OWNERSHIP_PENDING' } });
    expect(await countWrites(PENDING)).toEqual(NOTHING);
    expect(mockTrustState).not.toHaveBeenCalled();
  });

  it('refuses a listing that is no longer accepting applications with 409 and writes nothing', async () => {
    const res = await request(buildApp())
      .post(`/api/opportunities/${closedOpportunityId}/apply`)
      .set('Authorization', `Bearer ${await mint(OWNER)}`)
      .send({ coverNote: 'Interested.' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: { message: expect.stringContaining('no longer accepting applications') },
    });
    expect(await countWrites(OWNER)).toEqual(NOTHING);
  });

  // The feed-row 409 through this same stack is the first case of the W0-01
  // block above; it is not duplicated here.
});

// ── W0-15 (lane 3) — Door-B acceptance closes to non-employers ───────────────
//
// The employer-review accept handler and its sibling mutations must require an
// active organisation membership with role VERIFIER or ADMIN before writing an
// EmployerAcceptance. Those cases land in this file, in a describe block below
// this marker, from the lane that owns routes/employerActions.ts and
// services/entity/employerReviewActions.ts. Deliberately not written here.
