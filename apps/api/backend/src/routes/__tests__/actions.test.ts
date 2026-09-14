import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { registerActionsRoutes } from '../actions';

// The action engine only surfaces findings whose lastSeenAt falls inside its
// 180-day window (actionEngineService.ts, loadActionStorylines). Pinned calendar
// dates aged out of that window on 2026-09-11 and the suite went red on every
// branch. Anchor the fixture to the run clock so it cannot rot again.
const FIXTURE_NOW = Date.now();
const FIRST_SEEN_AT = new Date(FIXTURE_NOW - 2 * 86_400_000);
const LAST_SEEN_AT = new Date(FIXTURE_NOW - 1 * 86_400_000);

function buildApp() {
  const app = express();
  app.use(express.json());
  registerActionsRoutes(app);
  return app;
}

async function resetState(): Promise<void> {
  await prisma.actionStatusEvent.deleteMany({});
  await prisma.actionRecommendation.deleteMany({});
  await prisma.predictionInsight.deleteMany({});
  await prisma.findingStatusEvent.deleteMany({});
  await prisma.findingEntityLink.deleteMany({});
  await prisma.findingEvidenceLink.deleteMany({});
  await prisma.investigatorFinding.deleteMany({});
  await prisma.personProfile.deleteMany({});
  await prisma.user.deleteMany({});
}

async function seedFinding(input: {
  findingId: string;
  findingType: string;
  severity: 'critical' | 'medium';
  metadata: Record<string, unknown>;
  entityLinks: Array<{
    entityType: string;
    entityId: string;
    entityLabel: string;
    relationship: string;
  }>;
  summary: string;
}): Promise<void> {
  await prisma.investigatorFinding.create({
    data: {
      findingId: input.findingId,
      investigatorId: `${input.findingType}_monitor`,
      findingType: input.findingType,
      scope: 'provider',
      severity: input.severity,
      status: 'new',
      title: input.summary,
      summary: input.summary,
      explanation: input.summary,
      confidence: input.severity === 'critical' ? 0.93 : 0.79,
      priorityScore: input.severity === 'critical' ? 0.95 : 0.62,
      trustImpact: 0.9,
      freshness: 0.81,
      novelty: 0.75,
      entityImportance: 0.8,
      graphCentrality: 0.71,
      entityIds: [...new Set(input.entityLinks.map((entity) => entity.entityId))],
      audienceRoles: ['operations', 'compliance'],
      supportingEvidence: [{
        evidenceId: `${input.findingId}:evidence`,
        sourceId: 'TEST',
        sourceLabel: 'TEST',
        snippet: input.summary,
      }] as Prisma.InputJsonValue,
      rankBreakdown: {} as Prisma.InputJsonValue,
      metadata: input.metadata as Prisma.InputJsonValue,
      storylineKey: `${input.findingType}:${input.entityLinks[0]!.entityId}`,
      dedupeKey: input.findingId,
      firstSeenAt: FIRST_SEEN_AT,
      lastSeenAt: LAST_SEEN_AT,
      createdAt: FIRST_SEEN_AT,
      updatedAt: LAST_SEEN_AT,
      occurrenceCount: 1,
      entityLinks: {
        create: input.entityLinks.map((entity) => ({
          entityType: entity.entityType,
          entityId: entity.entityId,
          entityLabel: entity.entityLabel,
          relationship: entity.relationship,
          metadata: {},
        })),
      },
      statusEvents: {
        create: [{
          fromStatus: null,
          toStatus: 'new',
          note: 'Seeded for FE19 action route test.',
          metadata: {},
        }],
      },
    },
  });
}

async function seedActionFixtures(): Promise<void> {
  const user = await prisma.user.create({
    data: {
      clerkUserId: 'action-user-1',
      email: 'action-test@vitalcv.local',
      role: 'CLINICIAN',
      status: 'ACTIVE',
    },
  });
  await prisma.personProfile.create({
    data: {
      userId: user.id,
      npi: '1234567890',
      firstName: 'Ada',
      lastName: 'Lovelace',
      specialty: 'Cardiology',
      stateOfPractice: 'CA',
    },
  });

  await seedFinding({
    findingId: 'finding-trust-decline',
    findingType: 'trust_decline',
    severity: 'critical',
    summary: 'Ada Lovelace trust score dropped and credential freshness is stale.',
    metadata: {
      npi: '1234567890',
      staleDimensions: [{ claimClass: 'licensure' }],
      graphCentrality: 0.71,
    },
    entityLinks: [
      {
        entityType: 'provider',
        entityId: '1234567890',
        entityLabel: 'Ada Lovelace',
        relationship: 'subject',
      },
      {
        entityType: 'institution',
        entityId: 'mayo-clinic',
        entityLabel: 'Mayo Clinic',
        relationship: 'affiliated_with',
      },
    ],
  });

  await seedFinding({
    findingId: 'finding-network-emergence',
    findingType: 'network_emergence',
    severity: 'medium',
    summary: 'Ada Lovelace entered a new collaboration cluster.',
    metadata: {
      npi: '1234567890',
      graphCentrality: 0.71,
    },
    entityLinks: [{
      entityType: 'provider',
      entityId: '1234567890',
      entityLabel: 'Ada Lovelace',
      relationship: 'subject',
    }],
  });

  await prisma.predictionInsight.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000201',
        predictionId: 'pred-trust-decline',
        predictionType: 'TRUST_SCORE_DECLINE',
        targetEntityType: 'provider',
        targetEntityId: '1234567890',
        targetEntityLabel: 'Ada Lovelace',
        probability: 0.88,
        confidence: 0.86,
        timeHorizon: '90d',
        evidenceSignals: [
          { label: 'stale_sources', value: 2, direction: 'UP', source: 'CLAIM_RECORDS' },
          { label: 'divergence_signals', value: 1, direction: 'UP', source: 'INVESTIGATOR_FINDINGS' },
          { label: 'trust_score_delta', value: -12, direction: 'DOWN', source: 'TRUST_SCORE' },
        ] as Prisma.InputJsonValue,
        explanation: 'Ada Lovelace is likely to experience further trust deterioration within 90d.',
        metadata: {
          graphDegree: 9,
        } as Prisma.InputJsonValue,
        createdAt: LAST_SEEN_AT,
        updatedAt: LAST_SEEN_AT,
      },
      {
        id: '00000000-0000-0000-0000-000000000202',
        predictionId: 'pred-institution-growth',
        predictionType: 'INSTITUTION_RESEARCH_GROWTH',
        targetEntityType: 'institution',
        targetEntityId: 'mayo-clinic',
        targetEntityLabel: 'Mayo Clinic',
        probability: 0.8,
        confidence: 0.79,
        timeHorizon: '90d',
        evidenceSignals: [
          { label: 'research_growth', value: 1.6, direction: 'UP', source: 'OPENALEX' },
          { label: 'contributing_providers', value: 5, direction: 'UP', source: 'OPENALEX' },
        ] as Prisma.InputJsonValue,
        explanation: 'Mayo Clinic research activity is likely to accelerate within 90d.',
        metadata: {} as Prisma.InputJsonValue,
        createdAt: LAST_SEEN_AT,
        updatedAt: LAST_SEEN_AT,
      },
      {
        id: '00000000-0000-0000-0000-000000000203',
        predictionId: 'pred-specialty-pressure',
        predictionType: 'WORKFORCE_SHORTAGE_ESCALATION',
        targetEntityType: 'specialty',
        targetEntityId: 'ca-cardiology',
        targetEntityLabel: 'CA Cardiology',
        probability: 0.84,
        confidence: 0.78,
        timeHorizon: '90d',
        evidenceSignals: [
          { label: 'active_demand', value: 142, direction: 'UP', source: 'OPPORTUNITIES' },
          { label: 'mapped_supply', value: 78, direction: 'FLAT', source: 'PERSON_PROFILES' },
          { label: 'pressure_score', value: 86, direction: 'UP', source: 'OPPORTUNITIES' },
        ] as Prisma.InputJsonValue,
        explanation: 'CA Cardiology is likely to face a deeper workforce shortage within 90d.',
        metadata: {} as Prisma.InputJsonValue,
        createdAt: LAST_SEEN_AT,
        updatedAt: LAST_SEEN_AT,
      },
    ],
  });
}

describe('action routes', () => {
  beforeEach(async () => {
    await resetState();
    await seedActionFixtures();
  });

  afterAll(async () => {
    await resetState();
    await prisma.$disconnect();
  });

  it('lists FE19-derived actions and supports filtering', async () => {
    const app = buildApp();

    const response = await request(app)
      .get('/api/actions')
      .expect(200);

    expect(response.body.total).toBe(5);
    expect(response.body.actions.map((action: { actionType: string }) => action.actionType)).toEqual(expect.arrayContaining([
      'VERIFY_CREDENTIAL',
      'REVIEW_INSTITUTION',
      'TRACK_SPECIALTY',
    ]));

    const verifyCredential = response.body.actions.find((action: { actionType: string }) => action.actionType === 'VERIFY_CREDENTIAL');
    expect(verifyCredential.explanation).toContain('re-verified');
    expect(verifyCredential.explanation).toContain('stale or conflicting credential signals');

    const filtered = await request(app)
      .get('/api/actions')
      .query({
        actionType: 'VERIFY_CREDENTIAL',
        entity: '1234567890',
      })
      .expect(200);

    expect(filtered.body.total).toBe(1);
    expect(filtered.body.actions[0].actionType).toBe('VERIFY_CREDENTIAL');
    expect(filtered.body.actions[0].targetEntity.entityId).toBe('1234567890');
  });

  it('returns action detail with linked predictions and tracks status updates', async () => {
    const app = buildApp();
    const list = await request(app).get('/api/actions').expect(200);

    const verifyCredential = list.body.actions.find((action: { actionType: string }) => action.actionType === 'VERIFY_CREDENTIAL');
    const reviewInstitution = list.body.actions.find((action: { actionType: string }) => action.actionType === 'REVIEW_INSTITUTION');
    const trackSpecialty = list.body.actions.find((action: { actionType: string }) => action.actionType === 'TRACK_SPECIALTY');

    expect(verifyCredential).toBeDefined();
    expect(reviewInstitution).toBeDefined();
    expect(trackSpecialty).toBeDefined();

    const detail = await request(app)
      .get(`/api/actions/${verifyCredential.actionId}`)
      .expect(200);

    expect(Array.isArray(detail.body.action.linkedPredictions)).toBe(true);

    const saved = await request(app)
      .post(`/api/actions/${reviewInstitution.actionId}/save`)
      .send({ actorId: 'ops-user', note: 'Keep this institution on the watchlist.' })
      .expect(200);
    expect(saved.body.action.status).toBe('in_progress');

    const executed = await request(app)
      .post(`/api/actions/${verifyCredential.actionId}/execute`)
      .send({ actorId: 'ops-user', note: 'Credential review requested.' })
      .expect(200);
    expect(executed.body.action.status).toBe('completed');

    const dismissed = await request(app)
      .post(`/api/actions/${trackSpecialty.actionId}/dismiss`)
      .send({ actorId: 'ops-user', note: 'Not in current staffing scope.' })
      .expect(200);
    expect(dismissed.body.action.status).toBe('skipped');

    const reprioritized = await request(app)
      .patch(`/api/actions/${reviewInstitution.actionId}/status`)
      .send({ status: 'pending', actorId: 'ops-user', note: 'Return to backlog.' })
      .expect(200);
    expect(reprioritized.body.action.status).toBe('pending');

    const updatedDetail = await request(app)
      .get(`/api/actions/${verifyCredential.actionId}`)
      .expect(200);

    expect(updatedDetail.body.action.status).toBe('completed');
    expect(updatedDetail.body.action.statusEvents.length).toBeGreaterThanOrEqual(2);
  });
});
