/**
 * Wave L — batch review actions + org-scoped review queue.
 *
 * Pins the contract that matters:
 *  - batch runs the FULL single-entity semantics per candidate (RBAC shadow,
 *    duplicate guard, BLOCKED fail-closed) and one candidate failing never
 *    aborts the rest;
 *  - every candidate gets its own AuditEvent — denied candidates get the
 *    standard denied-mutation audit, successful ones the action audit;
 *  - the queue is bound server-side to the caller's own registered
 *    organization (uuid + slug), shows only live (unrevoked, unexpired)
 *    shares, dedupes to the latest share per NPI, and labels readiness as
 *    the cached snapshot.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    vcvEntity: { findUnique: jest.fn(), findFirst: jest.fn() },
    employerAcceptance: { findFirst: jest.fn(), create: jest.fn() },
    auditEvent: { create: jest.fn(), findMany: jest.fn() },
    outboxEvent: { upsert: jest.fn() },
    bundleShareEvent: { findMany: jest.fn() },
    organization: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../services/entity/passportService', () => ({
  buildPassport: jest.fn(),
  buildPassportByNpi: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/trust/trustScoreV1', () => ({
  computeTrustScoreV1: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/entity/employerReviewAttribution', () => ({
  resolveEmployerReviewAttribution: jest.fn().mockResolvedValue({
    organizationContextId: null,
    bundleShareEventId: null,
    bundleId: null,
    organizationId: null,
    organizationName: null,
    purposeOfUse: null,
    attributionSource: 'none',
  }),
  normalizeEmployerReviewAttribution: jest.fn((value: unknown) => value ?? null),
  matchesEmployerReviewAttribution: jest.fn(() => true),
}));

jest.mock('../../services/seal/sealEventCapture', () => ({
  captureAdvisoryEvent: jest.fn(),
  captureEmployerDecision: jest.fn(),
  captureStartOutcome: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/feedback/prismaEventStore', () => ({ emitLearningEvent: jest.fn() }));
jest.mock('../../services/feedback/decisionSignalService', () => ({ captureDecisionSignal: jest.fn() }));
jest.mock('../../services/entity/employerPacket', () => ({ buildEmployerEvidencePacket: jest.fn() }));
jest.mock('../../services/entity/employerPacketExport', () => ({
  createEmployerEvidencePacketZipStream: jest.fn(),
}));
jest.mock('../../services/trust/container/trustContainerIssuance', () => ({
  issueTrustContainerManifestEntry: jest.fn(),
}));
jest.mock('../../services/trust/trustStateEngine', () => ({ getCachedTrustState: jest.fn() }));
jest.mock('../../services/opportunities/opportunityService', () => ({ getOrgProfile: jest.fn() }));
jest.mock('../../obs/logger', () => ({ log: jest.fn() }));

// W0-15 — the always-on organisation-membership gate. These route suites
// exercise the per-route contracts, so they run as a member; the gate's own
// outcome (403 + no write) is proven over a real database in
// employerReviewMembership.db.test.ts.
jest.mock('../../services/authz/employerReviewMembership', () => ({
  resolveEmployerReviewMembership: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import { buildPassport } from '../../services/entity/passportService';
import { getCachedTrustState } from '../../services/trust/trustStateEngine';
import { getOrgProfile } from '../../services/opportunities/opportunityService';
import { registerEmployerActionRoutes } from '../employerActions';
import { resolveEmployerReviewMembership } from '../../services/authz/employerReviewMembership';

const ENTITY_A = '11111111-1111-4111-8111-111111111111';
const ENTITY_B = '22222222-2222-4222-8222-222222222222';
const NPI_A = '1111111111';
const NPI_B = '2222222222';

const prismaMock = prisma as unknown as {
  user: { findUnique: jest.Mock };
  vcvEntity: { findUnique: jest.Mock; findFirst: jest.Mock };
  employerAcceptance: { findFirst: jest.Mock; create: jest.Mock };
  auditEvent: { create: jest.Mock; findMany: jest.Mock };
  outboxEvent: { upsert: jest.Mock };
  bundleShareEvent: { findMany: jest.Mock };
  organization: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

const resolveEmployerReviewMembershipMock =
  resolveEmployerReviewMembership as jest.MockedFunction<typeof resolveEmployerReviewMembership>;
const buildPassportMock = buildPassport as jest.Mock;
const getCachedTrustStateMock = getCachedTrustState as jest.Mock;
const getOrgProfileMock = getOrgProfile as jest.Mock;

/** Verified-identity stand-in — see employerActions.test.ts / activation.test.ts. */
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
  app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ error: err.message ?? 'error' });
  });
  return app;
}

function wireHappyPersistence() {
  let auditCounter = 0;
  prismaMock.auditEvent.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: `audit-${++auditCounter}`,
    createdAt: new Date('2026-07-05T12:00:00.000Z'),
    ...args.data,
  }));
  prismaMock.outboxEvent.upsert.mockResolvedValue({ id: 'outbox-1' });
  prismaMock.employerAcceptance.create.mockImplementation(async (args: { data: { id: string } }) => ({
    id: args.data.id ?? 'acceptance-1',
  }));
  const tx = {
    employerAcceptance: { create: prismaMock.employerAcceptance.create },
    auditEvent: { create: prismaMock.auditEvent.create },
    outboxEvent: { upsert: prismaMock.outboxEvent.upsert },
    hITLReviewItem: { create: jest.fn().mockResolvedValue({ id: 'hitl-1' }) },
  };
  prismaMock.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue(null); // RBAC shadow mode: logged, never blocks
  resolveEmployerReviewMembershipMock.mockResolvedValue({
    organizationId: 'org-uuid-1',
    organizationProfileId: 'org-profile-uuid-1',
    membershipId: 'membership-uuid-1',
    role: 'ADMIN',
  });
  prismaMock.employerAcceptance.findFirst.mockResolvedValue(null);
  prismaMock.auditEvent.findMany.mockResolvedValue([]);
  prismaMock.vcvEntity.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
    if (args.where.id === ENTITY_A) return { id: ENTITY_A, npi: NPI_A };
    if (args.where.id === ENTITY_B) return { id: ENTITY_B, npi: NPI_B };
    return null;
  });
  prismaMock.vcvEntity.findFirst.mockResolvedValue(null);
  wireHappyPersistence();
});

describe('POST /api/employer-review/batch', () => {
  it('requires the acting employer identity', async () => {
    const response = await request(buildApp())
      .post('/api/employer-review/batch')
      .send({ action: 'accept', entityIds: [ENTITY_A] });
    expect(response.status).toBe(401);
  });

  it('rejects unknown actions and oversized batches up front', async () => {
    const app = buildApp();

    const badAction = await request(app)
      .post('/api/employer-review/batch')
      .set('x-test-verified-user', 'employer-1')
      .send({ action: 'approve-all', entityIds: [ENTITY_A] });
    expect(badAction.status).toBe(400);

    const oversized = await request(app)
      .post('/api/employer-review/batch')
      .set('x-test-verified-user', 'employer-1')
      .send({
        action: 'accept',
        entityIds: Array.from({ length: 26 }, (_, i) => `${i}0000000-0000-4000-8000-000000000000`),
      });
    expect(oversized.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('fails a BLOCKED candidate closed with its own denied audit while the rest of the batch proceeds', async () => {
    buildPassportMock.mockImplementation(async (entityId: string) => {
      if (entityId === ENTITY_A) {
        return {
          decisionPosture: {
            status: 'BLOCKED',
            blockers: ['OIG exclusion check unavailable'],
            missing: [{ sourceId: 'OIG_LEIE' }],
          },
        };
      }
      return { decisionPosture: { status: 'READY', blockers: [], missing: [] } };
    });

    const response = await request(buildApp())
      .post('/api/employer-review/batch')
      .set('x-test-verified-user', 'employer-1')
      .send({ action: 'accept', entityIds: [ENTITY_A, ENTITY_B], notes: 'pilot cohort triage' });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual({ requested: 2, succeeded: 1, failed: 1 });

    const [blocked, accepted] = response.body.results as Array<Record<string, unknown>>;
    expect(blocked).toMatchObject({
      entityId: ENTITY_A,
      ok: false,
      status: 422,
      error: 'acceptance_blocked',
    });
    expect(accepted).toMatchObject({ entityId: ENTITY_B, ok: true, status: 201 });
    expect(accepted.auditEventId).toBeTruthy();

    // One AuditEvent per candidate: a denied-mutation audit for the blocked
    // candidate, the acceptance audit for the successful one.
    const auditTypes = prismaMock.auditEvent.create.mock.calls.map(
      (call) => (call[0] as { data: { type: string } }).data.type,
    );
    expect(auditTypes).toContain('EMPLOYER_REVIEW_MUTATION_DENIED');
    expect(auditTypes).toContain('EMPLOYER_REVIEW_ACCEPTED');
    expect(prismaMock.employerAcceptance.create).toHaveBeenCalledTimes(1);
  });

  it('fails an already-accepted candidate closed without new persistence side effects', async () => {
    buildPassportMock.mockResolvedValue({ decisionPosture: { status: 'READY', blockers: [], missing: [] } });
    prismaMock.employerAcceptance.findFirst.mockImplementation(async (args: { where: { clinicianNpi: string } }) =>
      args.where.clinicianNpi === NPI_A ? { id: 'existing-acceptance' } : null,
    );

    const response = await request(buildApp())
      .post('/api/employer-review/batch')
      .set('x-test-verified-user', 'employer-1')
      .send({ action: 'accept', entityIds: [ENTITY_A, ENTITY_B] });

    expect(response.status).toBe(200);
    const [duplicate, accepted] = response.body.results as Array<Record<string, unknown>>;
    expect(duplicate).toMatchObject({
      entityId: ENTITY_A,
      ok: false,
      status: 409,
      error: 'already_accepted',
      acceptanceId: 'existing-acceptance',
    });
    expect(accepted).toMatchObject({ entityId: ENTITY_B, ok: true });
    expect(prismaMock.employerAcceptance.create).toHaveBeenCalledTimes(1);
  });

  it('writes one refresh audit per candidate and never consults the passport gate', async () => {
    const response = await request(buildApp())
      .post('/api/employer-review/batch')
      .set('x-test-verified-user', 'employer-1')
      .send({
        action: 'request-refresh',
        entityIds: [ENTITY_A, ENTITY_B],
        staleSources: ['DEA_REGISTRY'],
        message: 'Please refresh your DEA record.',
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual({ requested: 2, succeeded: 2, failed: 0 });
    expect(buildPassportMock).not.toHaveBeenCalled();

    const refreshAudits = prismaMock.auditEvent.create.mock.calls.filter(
      (call) => (call[0] as { data: { type: string } }).data.type === 'EMPLOYER_REVIEW_REFRESH_REQUESTED',
    );
    expect(refreshAudits).toHaveLength(2);
  });

  it('dedupes repeated entity ids and reports unresolvable candidates individually', async () => {
    buildPassportMock.mockResolvedValue({ decisionPosture: { status: 'READY', blockers: [], missing: [] } });

    const response = await request(buildApp())
      .post('/api/employer-review/batch')
      .set('x-test-verified-user', 'employer-1')
      .send({
        action: 'accept',
        entityIds: [ENTITY_B, ENTITY_B, '99999999-9999-4999-8999-999999999999', 'not-a-uuid'],
      });

    expect(response.status).toBe(200);
    const results = response.body.results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.entityId === ENTITY_B)).toHaveLength(1);
    expect(results.find((r) => r.entityId === '99999999-9999-4999-8999-999999999999')).toMatchObject({
      ok: false,
      status: 404,
      error: 'entity_not_found',
    });
    expect(results.find((r) => r.entityId === 'not-a-uuid')).toMatchObject({
      ok: false,
      status: 400,
      error: 'invalid_entity_id',
    });
  });
});

describe('GET /api/employer-review/queue', () => {
  it('requires the acting employer identity', async () => {
    const response = await request(buildApp()).get('/api/employer-review/queue');
    expect(response.status).toBe(401);
  });

  it('refuses callers with no registered employer organization', async () => {
    getOrgProfileMock.mockResolvedValue(null);
    const response = await request(buildApp())
      .get('/api/employer-review/queue')
      .set('x-test-verified-user', 'employer-1');
    expect(response.status).toBe(403);
    expect(prismaMock.bundleShareEvent.findMany).not.toHaveBeenCalled();
  });

  it('serves only the caller organization inbox: live shares, deduped per NPI, snapshot-labeled readiness', async () => {
    getOrgProfileMock.mockResolvedValue({ organizationId: 'org-uuid-1', name: 'Mercy General' });
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-uuid-1',
      slug: 'mercy-general',
      name: 'Mercy General',
    });
    prismaMock.bundleShareEvent.findMany.mockResolvedValue([
      {
        npi: NPI_A,
        subjectEntityId: ENTITY_A,
        sharedAt: new Date('2026-07-05T10:00:00.000Z'),
        purposeOfUse: 'Employment consideration',
        organizationContextId: null,
        bundleId: 'bundle-2',
      },
      {
        npi: NPI_A,
        subjectEntityId: ENTITY_A,
        sharedAt: new Date('2026-07-04T10:00:00.000Z'),
        purposeOfUse: 'Employment consideration',
        organizationContextId: null,
        bundleId: 'bundle-1',
      },
      {
        npi: '3333333333',
        subjectEntityId: null,
        sharedAt: new Date('2026-07-03T10:00:00.000Z'),
        purposeOfUse: 'Credentialing review',
        organizationContextId: null,
        bundleId: 'bundle-0',
      },
    ]);
    getCachedTrustStateMock.mockImplementation(async (npi: string) =>
      npi === NPI_A
        ? {
            readiness_level: 'L2',
            readiness_score: 72,
            readiness_status: 'PARTIAL',
            blockers: ['DEA registration expiring'],
            gaps: [],
            facts: [],
          }
        : null,
    );

    const response = await request(buildApp())
      .get('/api/employer-review/queue')
      .set('x-test-verified-user', 'employer-1');

    expect(response.status).toBe(200);
    expect(response.body.scope).toEqual({
      type: 'organization',
      organizationId: 'org-uuid-1',
      organizationName: 'Mercy General',
    });

    // Scope binding: the query matched the org's uuid AND slug, and only
    // live (unrevoked, unexpired) shares.
    const where = prismaMock.bundleShareEvent.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toEqual({ in: ['org-uuid-1', 'mercy-general'] });
    expect(where.revokedAt).toBeNull();
    expect(where.expiresAt).toHaveProperty('gt');

    const candidates = response.body.candidates as Array<Record<string, unknown>>;
    expect(candidates).toHaveLength(2); // NPI_A deduped to latest share

    const resolved = candidates.find((c) => c.npi === NPI_A)!;
    expect(resolved).toMatchObject({
      entityId: ENTITY_A,
      reviewable: true,
      bundleId: 'bundle-2', // latest share wins
      reviewPath: `/review/${ENTITY_A}`,
    });
    expect(resolved.readiness).toMatchObject({
      level: 'L2',
      score: 72,
      source: 'cached_trust_snapshot',
      topBlockers: ['DEA registration expiring'],
    });
    expect(resolved.headStart).toMatchObject({ hasPriorAcceptances: false });

    const unresolved = candidates.find((c) => c.npi === '3333333333')!;
    expect(unresolved).toMatchObject({ entityId: null, reviewable: false, reviewPath: null, readiness: null });

    expect(typeof response.body.readinessNote).toBe('string');
  });
});
