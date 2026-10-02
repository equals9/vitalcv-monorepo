/**
 * POST /api/credentials/ingest reads only the caller's own extraction.
 *
 * The ingest route turns a stored document extraction into a
 * CandidateCredential for the caller. Before this guard it looked the
 * extraction up by id alone, so any signed-in account that learned a document
 * id could ingest another account's upload under its own profile. The route
 * now passes the caller's identity into the store, and an id that is not the
 * caller's resolves to 404 with no credential written.
 *
 * The credentials route module has a wide import graph; everything that
 * touches Prisma or the network is mocked so this exercises the route's own
 * behaviour and nothing else.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../obs/logger', () => ({ log: jest.fn() }));

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../services/documents/documentStore', () => ({
  getExtraction: jest.fn(),
}));

jest.mock('../../services/documents/credentialIngestion', () => ({
  ingestCredential: jest.fn(),
  confirmCredential: jest.fn(),
  listCredentials: jest.fn(),
}));

import { ingestCredential } from '../../services/documents/credentialIngestion';
import { getExtraction } from '../../services/documents/documentStore';
import { registerCredentialRoutes } from '../credentials';

const getMock = getExtraction as jest.Mock;
const ingestMock = ingestCredential as jest.Mock;

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerCredentialRoutes(app);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/credentials/ingest owner scoping', () => {
  it('asks the store for the caller’s copy and 404s without writing when there is none', async () => {
    getMock.mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/api/credentials/ingest')
      .set('x-clerk-user-id', 'user_b')
      .send({ documentId: 'doc-owned-by-user-a' });

    expect(res.status).toBe(404);
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('doc-owned-by-user-a', 'user_b');
    expect(ingestMock).not.toHaveBeenCalled();
  });

  it('ingests the owner’s own extraction under the owner', async () => {
    const extraction = {
      documentId: 'doc-owned-by-user-a',
      documentType: 'MEDICAL_LICENSE',
      extractedFields: [],
      overallConfidence: 0,
      rawOcrText: '',
      processingTimeMs: 1,
    };
    getMock.mockResolvedValue(extraction);
    ingestMock.mockResolvedValue({ credentialId: 'cred-1', status: 'UNVERIFIED' });

    const res = await request(buildApp())
      .post('/api/credentials/ingest')
      .set('x-clerk-user-id', 'user_a')
      .send({ documentId: 'doc-owned-by-user-a' });

    expect(res.status).toBe(201);
    expect(getMock).toHaveBeenCalledWith('doc-owned-by-user-a', 'user_a');
    expect(ingestMock).toHaveBeenCalledWith('user_a', extraction);
  });

  it('rejects an anonymous ingest before touching the store', async () => {
    const res = await request(buildApp())
      .post('/api/credentials/ingest')
      .send({ documentId: 'doc-owned-by-user-a' });

    expect(res.status).toBe(401);
    expect(getMock).not.toHaveBeenCalled();
    expect(ingestMock).not.toHaveBeenCalled();
  });
});
