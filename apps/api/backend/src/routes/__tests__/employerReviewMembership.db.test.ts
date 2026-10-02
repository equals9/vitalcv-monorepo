/**
 * W0-15 — employer-review mutations require organisation membership, over
 * HTTP, against a REAL database.
 *
 *   POST /api/employer-review/:entityId/{accept,request-refresh,
 *        route-to-review,share-packet,confirm-start}
 *   POST /api/employer-review/batch
 *
 * The platform-role RBAC flag is left at its default, so these cases prove
 * the membership gate holds on its own:
 *
 *   - a signed-in clinician (no organisation, no membership) → 403 on every
 *     mutation, a denied-mutation audit row, and no EmployerAcceptance row
 *   - a self-serve employer (active ADMIN membership, User.organizationId set,
 *     created by the real org-setup service) → 201 and one row keyed to their
 *     organisation; a second accept → 409 (duplicate guard retained)
 *   - the same employer against a BLOCKED passport → 422 and no row
 *     (blocked-passport refusal retained)
 *
 * Only live-source and side-channel services are mocked (passport build,
 * trust score, SEAL / learning emitters, container issuance). Prisma, the
 * route, the membership resolver and the acceptance recorder are real.
 */

import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

jest.mock('../../services/entity/passportService', () => ({
  buildPassport: jest.fn(),
  buildPassportByNpi: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../services/trust/trustScoreV1', () => ({
  computeTrustScoreV1: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../services/trust/trustStateEngine', () => ({
  ...jest.requireActual('../../services/trust/trustStateEngine'),
  getCachedTrustState: jest.fn().mockResolvedValue(null),
  computeClinicianTrustState: jest.fn(async () => null),
}));
jest.mock('../../services/seal/sealEventCapture', () => ({
  captureAdvisoryEvent: jest.fn(),
  captureEmployerDecision: jest.fn().mockResolvedValue(undefined),
  captureStartOutcome: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/feedback/prismaEventStore', () => ({ emitLearningEvent: jest.fn() }));
jest.mock('../../services/feedback/decisionSignalService', () => ({
  captureDecisionSignal: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/trust/container/trustContainerIssuance', () => ({
  issueTrustContainerManifestEntry: jest.fn(),
}));
jest.mock('../../services/entity/employerPacket', () => ({ buildEmployerEvidencePacket: jest.fn() }));
jest.mock('../../services/entity/employerPacketExport', () => ({
  createEmployerEvidencePacketZipStream: jest.fn(),
}));
jest.mock('../../services/activation/applicationStartCommandService', () => ({
  confirmStartByAcceptance: jest.fn(),
}));

import { buildPassport } from '../../services/entity/passportService';
import { upsertOrgProfile } from '../../services/opportunities/opportunityService';
import { errorHandler } from '../../middleware/errorHandler';
import { registerEmployerActionRoutes } from '../employerActions';

const prisma = new PrismaClient();
const buildPassportMock = buildPassport as jest.Mock;

const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
const EMPLOYER = `review-employer-${suffix}`;
const EMPLOYER_DOMAIN = `review-clinic-${suffix}.org`;
const CLINICIAN = `review-clinician-${suffix}`;
// Check-digit-invalid (Luhn over 80840 + NPI fails) — cannot name anyone.
const SUBJECT_NPI = '1234567897';

let organizationId: string;
let entityId: string;

function readyPassport() {
  return {
    entityId,
    decisionPosture: { status: 'READY', blockers: [], missing: [] },
    sourceCoverage: { checks: [] },
  };
}

function blockedPassport() {
  return {
    entityId,
    decisionPosture: {
      status: 'BLOCKED',
      blockers: ['oig_exclusion_match'],
      missing: [{ sourceId: 'oig' }],
    },
    sourceCoverage: { checks: [] },
  };
}

/** Verified-identity stand-in — the same shape verifiedIdentityMiddleware sets. */
function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    const verified = req.headers['x-test-verified-user'];
    if (typeof verified === 'string' && verified.length > 0) {
      (req as unknown as { verifiedAuth: unknown }).verifiedAuth = {
        outcome: 'verified_match',
        verifiedUserId: verified,
      };
    }
    next();
  });
  app.use(express.json());
  registerEmployerActionRoutes(app);
  app.use(errorHandler);
  return app;
}

async function cleanUpSuiteRows(): Promise<void> {
  const userIds = (await prisma.user.findMany({
    where: { clerkUserId: { in: [EMPLOYER, CLINICIAN] } },
    select: { id: true },
  })).map(({ id }) => id);
  const organizationIds = [organizationId].filter(Boolean);
  const organizationProfileIds = (await prisma.organizationProfile.findMany({
    where: { organizationId: { in: organizationIds } },
    select: { id: true },
  })).map(({ id }) => id);

  await prisma.employerAcceptance.deleteMany({ where: { clinicianNpi: SUBJECT_NPI } });
  await prisma.auditEvent.deleteMany({ where: { clinicianId: SUBJECT_NPI } });
  await prisma.auditEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationAccessRequest.deleteMany({
    where: { clerkUserId: { in: [EMPLOYER, CLINICIAN] } },
  });
  await prisma.workspaceMembership.deleteMany({
    where: { organizationProfileId: { in: organizationProfileIds } },
  });
  await prisma.organizationProfile.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.personProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
  if (entityId) {
    await prisma.vcvEntity.deleteMany({ where: { id: entityId } });
  }
}

beforeAll(async () => {
  // The employer is created by the REAL self-serve org setup: it writes the
  // active ADMIN membership and User.organizationId together.
  await prisma.user.create({
    data: {
      clerkUserId: EMPLOYER,
      email: `admin@${EMPLOYER_DOMAIN}`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });
  const created = await upsertOrgProfile(EMPLOYER, {
    name: `Review Clinic ${suffix}`,
    website: `https://${EMPLOYER_DOMAIN}`,
    facilityType: 'hospital',
    statesCovered: ['CA'],
    hiringTypes: ['permanent'],
  });
  organizationId = created.organizationId;

  // A signed-in clinician: a User row, no organisation, no membership.
  await prisma.user.create({
    data: {
      clerkUserId: CLINICIAN,
      email: `${CLINICIAN}@clinician.test`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });

  const entity = await prisma.vcvEntity.create({
    data: {
      id: randomUUID(),
      entityType: 'PERSON',
      canonicalId: `test-person-${suffix}`,
      displayName: `Fixture Subject ${suffix}`,
      npi: SUBJECT_NPI,
    },
  });
  entityId = entity.id;
});

afterAll(async () => {
  await cleanUpSuiteRows();
  await prisma.$disconnect();
});

beforeEach(() => {
  buildPassportMock.mockReset();
  buildPassportMock.mockResolvedValue(readyPassport());
});

async function acceptanceRows() {
  return prisma.employerAcceptance.findMany({ where: { clinicianNpi: SUBJECT_NPI } });
}

async function deniedRows(actorClerkId: string) {
  const rows = await prisma.auditEvent.findMany({
    where: { type: 'EMPLOYER_REVIEW_MUTATION_DENIED', clinicianId: SUBJECT_NPI },
  });
  return rows.filter((row) => {
    const metadata = row.metadata as { actor?: { actorId?: string }; runtimeTrust?: { actor?: { actorId?: string } } } | null;
    const actorId = metadata?.actor?.actorId ?? metadata?.runtimeTrust?.actor?.actorId;
    return actorId === actorClerkId;
  });
}

describe('employer-review mutations — organisation membership (platform-role RBAC flag at its default)', () => {
  it('runs with the platform-role RBAC flag at its default, so the membership gate is proven on its own', () => {
    expect(process.env.VERIFIER_RBAC_ENFORCED ?? '').not.toMatch(/^(true|1)$/i);
  });

  it.each([
    ['accept', (id: string) => `/api/employer-review/${id}/accept`, {}],
    ['request-refresh', (id: string) => `/api/employer-review/${id}/request-refresh`, {}],
    ['route-to-review', (id: string) => `/api/employer-review/${id}/route-to-review`, {}],
    ['share-packet', (id: string) => `/api/employer-review/${id}/share-packet`, {}],
    ['confirm-start', (id: string) => `/api/employer-review/${id}/confirm-start`, {
      startedAt: '2026-03-25T18:00:00.000Z', role: 'RN', facility: 'Providence',
    }],
  ] as const)(
    '%s: a signed-in clinician with no organisation membership gets 403 and writes no acceptance',
    async (_action, pathFor, body) => {
      const before = (await acceptanceRows()).length;
      const deniedBefore = (await deniedRows(CLINICIAN)).length;

      const res = await request(buildApp())
        .post(pathFor(entityId))
        .set('x-test-verified-user', CLINICIAN)
        .send(body);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('organization membership');

      expect((await acceptanceRows()).length).toBe(before);
      const denied = await deniedRows(CLINICIAN);
      expect(denied.length).toBe(deniedBefore + 1);
      const latest = denied[denied.length - 1].metadata as { denialReason?: string };
      expect(latest.denialReason).toBe('organization_membership_required');
    },
  );

  it('batch accept: the clinician is refused per entity and nothing is written', async () => {
    const before = (await acceptanceRows()).length;

    const res = await request(buildApp())
      .post('/api/employer-review/batch')
      .set('x-test-verified-user', CLINICIAN)
      .send({ action: 'accept', entityIds: [entityId] });

    expect(res.status).toBe(200);
    expect(res.body.summary.succeeded).toBe(0);
    expect(res.body.summary.failed).toBe(1);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].ok).toBe(false);
    expect(res.body.results[0].status).toBe(403);
    expect((await acceptanceRows()).length).toBe(before);
  });

  it('a self-serve employer with an active ADMIN membership records the acceptance keyed to their organisation', async () => {
    expect(await acceptanceRows()).toHaveLength(0);

    const res = await request(buildApp())
      .post(`/api/employer-review/${entityId}/accept`)
      .set('x-test-verified-user', EMPLOYER)
      .send({ role: 'Hospitalist', facility: 'Review Clinic' });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);

    const rows = await acceptanceRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].employerId).toBe(organizationId);
    expect(rows[0].acceptedBy).toBe(EMPLOYER);
    expect(rows[0].status).toBe('ACCEPTED');
  });

  it('keeps the duplicate guard: the same organisation accepting again gets 409 and no second row', async () => {
    const res = await request(buildApp())
      .post(`/api/employer-review/${entityId}/accept`)
      .set('x-test-verified-user', EMPLOYER)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('already_accepted');
    expect(await acceptanceRows()).toHaveLength(1);
  });

  it('keeps the blocked-passport refusal for a member: 422 and no row', async () => {
    // Clear the member's own acceptance so the duplicate guard does not mask
    // the passport gate; the blocked passport must be what refuses this one.
    await prisma.employerAcceptance.deleteMany({ where: { clinicianNpi: SUBJECT_NPI } });
    buildPassportMock.mockResolvedValue(blockedPassport());

    const res = await request(buildApp())
      .post(`/api/employer-review/${entityId}/accept`)
      .set('x-test-verified-user', EMPLOYER)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('acceptance_blocked');
    expect(await acceptanceRows()).toHaveLength(0);
  });

  it('a deactivated membership no longer qualifies the employer', async () => {
    const orgProfile = await prisma.organizationProfile.findUnique({
      where: { organizationId },
      select: { id: true },
    });
    await prisma.workspaceMembership.updateMany({
      where: { organizationProfileId: orgProfile!.id },
      data: { active: false },
    });
    try {
      const res = await request(buildApp())
        .post(`/api/employer-review/${entityId}/accept`)
        .set('x-test-verified-user', EMPLOYER)
        .send({});
      expect(res.status).toBe(403);
      expect(await acceptanceRows()).toHaveLength(0);
    } finally {
      await prisma.workspaceMembership.updateMany({
        where: { organizationProfileId: orgProfile!.id },
        data: { active: true },
      });
    }
  });
});
