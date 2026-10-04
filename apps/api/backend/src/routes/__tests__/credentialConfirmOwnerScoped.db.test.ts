/**
 * Credential confirmation is scoped to its owner.
 *
 * `PATCH /api/credentials/:id/confirm` merges the caller's corrections into a
 * CandidateCredential's extracted fields and advances its status. It may act
 * only on a credential that belongs to the signed-in caller. Any other id —
 * another account's, one that does not exist, one that is not even a UUID —
 * is a 404, and the stored row is left exactly as it was.
 *
 * Real Postgres and the real route handler (supertest over loopback). The
 * assertion that matters is read back from the database, not from the
 * response: a 404 that still wrote the row would pass a response-only test.
 *
 * Owner key: on this branch the document lane writes the caller's Clerk id
 * into `clinicianId` (`ingestCredential`), and it is the only writer of this
 * table in the API, so that is the owner a confirmation is checked against.
 */
import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

import { registerCredentialRoutes } from '../credentials';

const prisma = new PrismaClient();

// Distinct per run so a crashed run's leftovers cannot shadow these cases.
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const OWNER = `user_confirm_owner_${RUN}`;
const OTHER = `user_confirm_other_${RUN}`;
const CANDIDATE_KEY = `cred-confirm-scope-${RUN}`;

const ORIGINAL_DATA = {
  documentType: 'MEDICAL_LICENSE',
  extractedFields: [
    { field: 'licenseNumber', value: 'X0000000', confidence: 0.4 },
    { field: 'licenseState', value: 'ZZ', confidence: 0.4 },
  ],
  overallConfidence: 0.4,
  processingTimeMs: 1,
};

let credentialId = '';

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerCredentialRoutes(app);
  return app;
}

async function readRow() {
  return prisma.candidateCredential.findUnique({ where: { id: credentialId } });
}

async function cleanup(): Promise<void> {
  await prisma.candidateCredential.deleteMany({
    where: { clinicianId: { in: [OWNER, OTHER] } },
  });
}

beforeAll(async () => {
  await cleanup();
  const row = await prisma.candidateCredential.create({
    data: {
      candidateCredentialId: CANDIDATE_KEY,
      clinicianId: OWNER,
      status: 'UNVERIFIED',
      data: ORIGINAL_DATA,
    },
  });
  credentialId = row.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('PATCH /api/credentials/:id/confirm is owner-scoped', () => {
  it('a second account gets 404 and the row is unchanged', async () => {
    const before = await readRow();

    const res = await request(buildApp())
      .patch(`/api/credentials/${credentialId}/confirm`)
      .set('x-clerk-user-id', OTHER)
      .send({ corrections: { licenseNumber: 'CHANGED-BY-OTHER' } });

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('X0000000');
    expect(res.body).not.toHaveProperty('status');

    const after = await readRow();
    expect(after).not.toBeNull();
    expect(after?.status).toBe('UNVERIFIED');
    expect(after?.clinicianId).toBe(OWNER);
    expect(after?.data).toEqual(ORIGINAL_DATA);
    expect(after).toEqual(before);
  });

  it('an anonymous request gets 401 and the row is unchanged', async () => {
    const res = await request(buildApp())
      .patch(`/api/credentials/${credentialId}/confirm`)
      .send({ corrections: { licenseNumber: 'CHANGED-ANON' } });

    expect(res.status).toBe(401);
    const after = await readRow();
    expect(after?.status).toBe('UNVERIFIED');
    expect(after?.data).toEqual(ORIGINAL_DATA);
  });

  it('a well-formed id that does not exist is a 404, the same answer a non-owner gets', async () => {
    const res = await request(buildApp())
      .patch('/api/credentials/00000000-0000-4000-8000-000000000000/confirm')
      .set('x-clerk-user-id', OWNER)
      .send({ corrections: {} });

    expect(res.status).toBe(404);
  });

  it('an id that is not a UUID is a 404, not a database error', async () => {
    const res = await request(buildApp())
      .patch('/api/credentials/definitely-not-an-id/confirm')
      .set('x-clerk-user-id', OWNER)
      .send({ corrections: {} });

    expect(res.status).toBe(404);
    // No database error text reaches the client (the 404 body echoes the id,
    // so the sample id deliberately contains none of these words).
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|invalid|syntax|column|uuid/i);
  });

  // Last: this one writes.
  it('the owner can confirm: corrections merge and status advances', async () => {
    const res = await request(buildApp())
      .patch(`/api/credentials/${credentialId}/confirm`)
      .set('x-clerk-user-id', OWNER)
      .send({ corrections: { licenseNumber: 'Y1111111' } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'PENDING_VERIFICATION' });

    const after = await readRow();
    expect(after?.status).toBe('PENDING_VERIFICATION');
    const fields = (after?.data as { extractedFields: Array<{ field: string; value: string }> }).extractedFields;
    expect(fields.find((f) => f.field === 'licenseNumber')?.value).toBe('Y1111111');
    expect(fields.find((f) => f.field === 'licenseState')?.value).toBe('ZZ');
  });
});
