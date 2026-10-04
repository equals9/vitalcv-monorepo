/**
 * /api/documents/* fails closed and reads only the caller's own documents.
 *
 * Two outcomes pinned here:
 *
 * 1. When document reading is unavailable (no provider, provider fault,
 *    timeout) the parse route answers 503 with a plain sentence and stores
 *    NOTHING. Before this guard the pipeline substituted a fixture licence on
 *    every fault and the route stored it as a durable artifact with a 200.
 *
 * 2. The stored-extraction reads (`GET /api/documents/:id`,
 *    `POST /api/documents/verify`) pass the caller's identity into the store,
 *    so a document id belonging to another account resolves to 404. Before
 *    this guard the lookup was by id alone.
 *
 * The route is exercised through supertest against the real handlers; only
 * the pipeline, store, audit, verifier, logger and rate limiter are mocked.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../obs/logger', () => ({ log: jest.fn() }));

jest.mock('../../middleware/rateLimitFactory', () => ({
  credentialStatusRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
  documentIntelligenceRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../services/ai/documentPipeline', () => {
  const actual = jest.requireActual('../../services/ai/documentPipeline');
  return {
    ...actual,
    documentPipeline: {
      extractFromDocument: jest.fn(),
      classifyDocumentType: actual.documentPipeline.classifyDocumentType,
    },
  };
});

jest.mock('../../services/documents/documentStore', () => {
  const actual = jest.requireActual('../../services/documents/documentStore');
  return {
    ...actual,
    storeExtraction: jest.fn(),
    getExtraction: jest.fn(),
  };
});

jest.mock('../../services/documents/documentAudit', () => ({
  auditParse: jest.fn(),
  auditVerify: jest.fn(),
}));

jest.mock('../../services/ai/sourceVerifier', () => ({
  sourceVerifier: { verifyDocument: jest.fn() },
}));

import { DocumentReadingUnavailableError, documentPipeline } from '../../services/ai/documentPipeline';
import { sourceVerifier } from '../../services/ai/sourceVerifier';
import { auditParse, auditVerify } from '../../services/documents/documentAudit';
import { getExtraction, storeExtraction } from '../../services/documents/documentStore';
import { registerDocumentRoutes } from '../documents';

const extractMock = documentPipeline.extractFromDocument as jest.Mock;
const storeMock = storeExtraction as jest.Mock;
const getMock = getExtraction as jest.Mock;
const auditParseMock = auditParse as jest.Mock;
const auditVerifyMock = auditVerify as jest.Mock;
const verifyMock = sourceVerifier.verifyDocument as jest.Mock;

const FIXTURE_MARKERS = ['Medical Board of California', 'A123456', 'Jane A. Smith'];

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerDocumentRoutes(app);
  return app;
}

function sampleExtraction() {
  return {
    documentId: 'doc-owned-by-user-a',
    documentType: 'MEDICAL_LICENSE' as const,
    extractedFields: [{ field: 'licenseNumber', value: 'X0000000', confidence: 0.9 }],
    overallConfidence: 0.9,
    rawOcrText: 'synthetic',
    processingTimeMs: 1,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/documents/parse fails closed', () => {
  it('answers 503 with plain copy and stores nothing when reading is unavailable', async () => {
    extractMock.mockRejectedValue(
      new DocumentReadingUnavailableError('no document provider is configured'),
    );

    const res = await request(buildApp())
      .post('/api/documents/parse')
      .set('x-clerk-user-id', 'user_a')
      .attach('file', Buffer.from('not-a-real-image'), { filename: 'licence.png', contentType: 'image/png' });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('document_reading_unavailable');
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message).toMatch(/unavailable/i);
    // Truth contract: the failure copy may not read as a verification outcome.
    expect(res.body.message).not.toMatch(/verified/i);

    // No document shape leaks — nothing the client could mistake for a reading.
    const body = JSON.stringify(res.body);
    expect(res.body).not.toHaveProperty('extractedFields');
    expect(res.body).not.toHaveProperty('documentType');
    expect(res.body).not.toHaveProperty('rawOcrText');
    for (const marker of FIXTURE_MARKERS) expect(body).not.toContain(marker);

    expect(storeMock).not.toHaveBeenCalled();
    expect(auditParseMock).not.toHaveBeenCalled();
  });

  it('an unrelated handler error is still a 500 and still stores nothing', async () => {
    extractMock.mockRejectedValue(new Error('disk full'));

    const res = await request(buildApp())
      .post('/api/documents/parse')
      .set('x-clerk-user-id', 'user_a')
      .attach('file', Buffer.from('x'), { filename: 'licence.png', contentType: 'image/png' });

    expect(res.status).toBe(500);
    expect(storeMock).not.toHaveBeenCalled();
    expect(auditParseMock).not.toHaveBeenCalled();
  });

  it('a successful reading is stored under the caller, not under anything in the body', async () => {
    const extraction = sampleExtraction();
    extractMock.mockResolvedValue(extraction);
    storeMock.mockResolvedValue(extraction.documentId);

    const res = await request(buildApp())
      .post('/api/documents/parse')
      .set('x-clerk-user-id', 'user_a')
      .attach('file', Buffer.from('x'), { filename: 'licence.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(storeMock).toHaveBeenCalledTimes(1);
    expect(storeMock.mock.calls[0][0]).toBe('user_a');
    expect(auditParseMock).toHaveBeenCalledTimes(1);
  });
});

describe('stored-extraction reads are owner-scoped', () => {
  it('GET /api/documents/:id asks the store for the caller’s copy and 404s when there is none', async () => {
    getMock.mockResolvedValue(null);

    const res = await request(buildApp())
      .get('/api/documents/doc-owned-by-user-a')
      .set('x-clerk-user-id', 'user_b');

    expect(res.status).toBe(404);
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('doc-owned-by-user-a', 'user_b');
    expect(JSON.stringify(res.body)).not.toContain('X0000000');
  });

  it('GET /api/documents/:id returns the owner’s own document', async () => {
    const extraction = sampleExtraction();
    getMock.mockResolvedValue(extraction);

    const res = await request(buildApp())
      .get('/api/documents/doc-owned-by-user-a')
      .set('x-clerk-user-id', 'user_a');

    expect(res.status).toBe(200);
    expect(getMock).toHaveBeenCalledWith('doc-owned-by-user-a', 'user_a');
    expect(res.body.documentId).toBe('doc-owned-by-user-a');
  });

  it('POST /api/documents/verify asks the store for the caller’s copy and 404s before any verification', async () => {
    getMock.mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/api/documents/verify')
      .set('x-clerk-user-id', 'user_b')
      .send({ documentId: 'doc-owned-by-user-a' });

    expect(res.status).toBe(404);
    expect(getMock).toHaveBeenCalledWith('doc-owned-by-user-a', 'user_b');
    expect(verifyMock).not.toHaveBeenCalled();
    expect(auditVerifyMock).not.toHaveBeenCalled();
  });
});
