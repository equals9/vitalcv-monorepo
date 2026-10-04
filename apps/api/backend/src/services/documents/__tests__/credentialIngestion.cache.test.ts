jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    candidateCredential: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../audit/auditLedger', () => ({
  appendAuditEvent: jest.fn(),
  newTraceId: jest.fn(() => 'trace-cache-test'),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { confirmCredential } from '../credentialIngestion';
import {
  getTrustStateMemoryCache,
  resetTrustStateMemoryCache,
  setTrustStateMemoryCache,
} from '../../trust/trustStateCache';

const prismaMock = prisma as unknown as {
  candidateCredential: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
};

const CRED_ID = '11111111-1111-4111-8111-111111111111';

function buildTrustState(npi: string) {
  return {
    npi,
    identityVerified: true,
    licensureStatus: 'verified' as const,
    exclusionClear: true,
    credentialCount: 2,
    readiness_level: 'L3' as const,
    readiness_status: 'Ready to credential — all evidence verified',
    readiness_score: 100,
    gap_summary: [],
    methodology_version: '243.1',
    computed_at: '2026-03-14T12:00:00.000Z',
    trustBand: 'L3' as const,
    trustScore: 100,
    facts: [],
    gaps: [],
    computedAt: '2026-03-14T12:00:00.000Z',
  };
}

describe('credential ingestion trust-state cache invalidation', () => {
  beforeEach(() => {
    resetTrustStateMemoryCache();
    prismaMock.candidateCredential.findUnique.mockReset();
    prismaMock.candidateCredential.findFirst.mockReset();
    prismaMock.candidateCredential.update.mockReset();
  });

  it('invalidates the memory cache when a credential is updated', async () => {
    const npi = '1234567893';
    setTrustStateMemoryCache(npi, buildTrustState(npi));

    prismaMock.candidateCredential.findFirst.mockResolvedValue({
      id: CRED_ID,
      clinicianId: npi,
      data: {},
      status: 'UNVERIFIED',
    });
    prismaMock.candidateCredential.update.mockResolvedValue({
      id: CRED_ID,
      clinicianId: npi,
      data: {},
      status: 'PENDING_VERIFICATION',
    });

    await confirmCredential(CRED_ID, { licenseNumber: 'RN1234' }, npi);

    expect(getTrustStateMemoryCache(npi)).toBeNull();
  });
});
