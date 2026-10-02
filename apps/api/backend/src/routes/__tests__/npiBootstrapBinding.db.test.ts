/**
 * W0-05 — NPI binding truth, over HTTP, against a REAL database.
 *
 *   POST /api/profile/npi/bootstrap → bootstrapNpiIntake → detectNpiType
 *
 * Two accounts and three numbers. The registry (NPPES) is the only thing
 * mocked: it is an external source and the whole point is what the bind does
 * with each of its answers.
 *
 *   - account A binds a number the registry knows            → 201, one row
 *   - account B binds the same number                         → 409, audited,
 *                                                                no row for B
 *   - account B binds a number the registry has not enumerated→ 422, no row
 *   - account B binds while the registry is unreachable       → 502, no row
 *
 * Proven by injection: the refusal cases fail against the previous service.
 *
 * NPIs here are check-digit-INVALID on purpose (NPI consent gate): they cannot
 * name a real registrant.
 */

import express from 'express';
import request from 'supertest';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

jest.mock('../../modules/identity', () => ({
  ...jest.requireActual('../../modules/identity'),
  fetchNpiFromCMS: jest.fn(),
}));

import { fetchNpiFromCMS } from '../../modules/identity';
import type { RawNppesResponse } from '../../modules/identity/types';
import { HttpError } from '../../utils/httpError';
import { errorHandler } from '../../middleware/errorHandler';
import { registerIntakeRoutes } from '../intake';
import {
  NPI_CLAIM_CONFLICT_MESSAGE,
  NPI_NOT_IN_REGISTRY_MESSAGE,
} from '../../services/intake/intakeService';

const prisma = new PrismaClient();
const fetchMock = fetchNpiFromCMS as jest.MockedFunction<typeof fetchNpiFromCMS>;

const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
const ACCOUNT_A = `bind-a-${suffix}`;
const ACCOUNT_B = `bind-b-${suffix}`;

// Check-digit-invalid (Luhn over 80840 + NPI fails) — cannot name anyone.
const KNOWN_NPI = '1234567894';
const UNENUMERATED_NPI = '1234567895';
const UNREACHABLE_NPI = '1234567896';
const SUITE_NPIS = [KNOWN_NPI, UNENUMERATED_NPI, UNREACHABLE_NPI];

let userAId: string;
let userBId: string;

function registryRecord(npi: string): RawNppesResponse {
  return {
    result_count: 1,
    results: [
      {
        created_epoch: 0,
        enumeration_type: 'NPI-1',
        last_updated_epoch: 0,
        number: npi,
        basic: {
          first_name: 'Fixture',
          last_name: 'Individual',
          middle_name: '',
          credential: '',
          sole_proprietor: 'NO',
          enumeration_date: '2020-01-01',
          last_updated: '2020-01-01',
          status: 'A',
          name_prefix: '',
          name_suffix: '',
          enumeration_type: 'NPI-1',
        },
        taxonomies: [
          {
            code: '207R00000X',
            taxonomy_group: '',
            desc: 'Internal Medicine',
            state: 'CA',
            license: '',
            primary: true,
          },
        ],
        addresses: [],
        identifiers: [],
        endpoints: [],
        other_names: [],
      },
    ],
  } as unknown as RawNppesResponse;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  registerIntakeRoutes(app);
  // The real global handler: HttpError → its status, plain Error → 500.
  app.use(errorHandler);
  return app;
}

async function cleanUpSuiteRows(): Promise<void> {
  const userIds = (await prisma.user.findMany({
    where: { clerkUserId: { in: [ACCOUNT_A, ACCOUNT_B] } },
    select: { id: true },
  })).map(({ id }) => id);
  await prisma.auditEvent.deleteMany({ where: { referenceId: { in: userIds } } });
  await prisma.personProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.personProfile.deleteMany({ where: { npi: { in: SUITE_NPIS } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

beforeAll(async () => {
  await cleanUpSuiteRows();
  const a = await prisma.user.create({
    data: {
      clerkUserId: ACCOUNT_A,
      email: `${ACCOUNT_A}@bind.test`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });
  const b = await prisma.user.create({
    data: {
      clerkUserId: ACCOUNT_B,
      email: `${ACCOUNT_B}@bind.test`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });
  userAId = a.id;
  userBId = b.id;
});

afterAll(async () => {
  await cleanUpSuiteRows();
  await prisma.$disconnect();
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (npi: string) => {
    if (npi === KNOWN_NPI) {
      return { rawPayload: registryRecord(npi), payloadHash: `hash-${npi}` };
    }
    if (npi === UNENUMERATED_NPI) {
      // Exactly what nppes.service throws on result_count === 0.
      throw new HttpError(404, `NPI ${npi} not found in CMS NPPES Registry`);
    }
    throw new HttpError(502, 'Failed to reach CMS NPPES Registry');
  });
});

async function profileRowsFor(userId: string) {
  return prisma.personProfile.findMany({ where: { userId } });
}

async function auditRows(type: string, referenceId: string) {
  return prisma.auditEvent.findMany({ where: { type, referenceId } });
}

describe('POST /api/profile/npi/bootstrap — binding truth', () => {
  it('binds a registry-known number for the first account and writes one row', async () => {
    const res = await request(buildApp())
      .post('/api/profile/npi/bootstrap')
      .set('x-clerk-user-id', ACCOUNT_A)
      .send({ npi: KNOWN_NPI });

    expect(res.status).toBe(201);
    expect(res.body.npi).toBe(KNOWN_NPI);
    expect(res.body.npiType).toBe('TYPE_1');
    expect(res.body.alreadyRegistered).toBe(false);

    const rows = await profileRowsFor(userAId);
    expect(rows).toHaveLength(1);
    expect(rows[0].npi).toBe(KNOWN_NPI);
    expect(rows[0].npiType).toBe('TYPE_1');
    expect(await auditRows('npi_bootstrapped', userAId)).toHaveLength(1);
  });

  it('answers a second account binding the same number with 409 and its audit row, writing nothing', async () => {
    const res = await request(buildApp())
      .post('/api/profile/npi/bootstrap')
      .set('x-clerk-user-id', ACCOUNT_B)
      .send({ npi: KNOWN_NPI });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toBe(NPI_CLAIM_CONFLICT_MESSAGE);

    // The conflict is audited against the account that tried to claim.
    const conflicts = await auditRows('npi_claim_conflict', userBId);
    expect(conflicts).toHaveLength(1);
    expect((conflicts[0].metadata as { npi?: string }).npi).toBe(KNOWN_NPI);

    // No profile for B; A still holds the number; no bootstrap audit for B.
    expect(await profileRowsFor(userBId)).toHaveLength(0);
    const aRows = await profileRowsFor(userAId);
    expect(aRows).toHaveLength(1);
    expect(aRows[0].npi).toBe(KNOWN_NPI);
    expect(await auditRows('npi_bootstrapped', userBId)).toHaveLength(0);
    // The registry was never consulted for a number the caller cannot bind.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a number the registry has not enumerated with 422 and never defaults it to Type 1', async () => {
    const res = await request(buildApp())
      .post('/api/profile/npi/bootstrap')
      .set('x-clerk-user-id', ACCOUNT_B)
      .send({ npi: UNENUMERATED_NPI });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe(NPI_NOT_IN_REGISTRY_MESSAGE);
    expect(JSON.stringify(res.body)).not.toContain('TYPE_1');

    expect(await profileRowsFor(userBId)).toHaveLength(0);
    expect(await prisma.personProfile.findUnique({ where: { npi: UNENUMERATED_NPI } })).toBeNull();
    expect(await auditRows('npi_bootstrapped', userBId)).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledWith(UNENUMERATED_NPI);
  });

  it('reports a registry outage as 502 (a system state, not a finding) and writes nothing', async () => {
    const res = await request(buildApp())
      .post('/api/profile/npi/bootstrap')
      .set('x-clerk-user-id', ACCOUNT_B)
      .send({ npi: UNREACHABLE_NPI });

    expect(res.status).toBe(502);
    expect(res.body.error.message).not.toContain('not found');
    expect(res.body.error.message).toContain('system state');

    expect(await profileRowsFor(userBId)).toHaveLength(0);
    expect(await prisma.personProfile.findUnique({ where: { npi: UNREACHABLE_NPI } })).toBeNull();
    expect(await auditRows('npi_bootstrapped', userBId)).toHaveLength(0);
  });

  it('lets the holder re-bind their own number idempotently', async () => {
    const res = await request(buildApp())
      .post('/api/profile/npi/bootstrap')
      .set('x-clerk-user-id', ACCOUNT_A)
      .send({ npi: KNOWN_NPI });

    expect(res.status).toBe(201);
    expect(res.body.alreadyRegistered).toBe(true);
    expect(await profileRowsFor(userAId)).toHaveLength(1);
    expect(await auditRows('npi_claim_conflict', userAId)).toHaveLength(0);
  });
});
