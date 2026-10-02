/**
 * intakeService.bootstrapNpi.test.ts — fix/nppes-full-hydration (2026-04-10)
 *
 * Regression guard for Gap 1: `intakeService.detectNpiType` was reading
 * camelCase fields (`provider.firstName`, `provider.taxonomyCode`,
 * `provider.stateOfPractice`) that do not exist on `NormalizedProvider`,
 * *and* passing the fetch wrapper `raw` directly to `normalizeProvider`
 * instead of its inner `raw.rawPayload`. Both bugs were silenced by the
 * `require()` dynamic import, which defeated TypeScript's checker.
 *
 * Net effect: every successful NPPES lookup surfaced as "no data" —
 * firstName/lastName/specialty/state were all undefined — making the
 * symptom indistinguishable from an upstream failure.
 *
 * This test asserts the *hydrated* result: when NPPES returns a healthy
 * payload, `bootstrapNpiIntake` must surface firstName, lastName,
 * specialty (primary taxonomy code), and stateOfPractice on its return
 * value.
 */

// ── Mocks (must be hoisted above the SUT import) ──────────────────────────

const mockFetchNpiFromCMS = jest.fn();
const mockNormalizeProvider = jest.fn();

jest.mock('../src/modules/identity', () => ({
  __esModule: true,
  fetchNpiFromCMS: (...args: unknown[]) => mockFetchNpiFromCMS(...args),
  normalizeProvider: (...args: unknown[]) => mockNormalizeProvider(...args),
}));

const prismaMock = {
  personProfile: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  auditEvent: {
    create: jest.fn(),
  },
};

jest.mock('../src/graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
  Prisma: {},
}));

jest.mock('../src/obs/logger', () => ({
  log: jest.fn(),
}));

// ── SUT import (after mocks) ──────────────────────────────────────────────

import {
  bootstrapNpiIntake,
  NPI_REGISTRY_UNAVAILABLE_MESSAGE,
} from '../src/services/intake/intakeService';

// ── Fixtures ──────────────────────────────────────────────────────────────

const VALID_NPI = '1558302470';

/**
 * A NormalizedProvider fixture that matches the real shape emitted by
 * `normalizeProvider()` in `nppes.validator.ts` — snake_case field names,
 * `primary_taxonomy_code` at the root, `practice_address.state` nested.
 *
 * If the SUT regresses back to camelCase reads, these fields will be
 * undefined on the result and the test will fail.
 */
function buildNormalizedProvider(overrides: Partial<{
  first_name: string;
  last_name: string;
  primary_taxonomy_code: string;
  state: string;
  enumeration_type: string;
}> = {}) {
  return {
    npi: VALID_NPI,
    enumeration_type: overrides.enumeration_type ?? 'NPI-1',
    status: 'A',
    first_name: overrides.first_name ?? 'Macie',
    last_name: overrides.last_name ?? 'Chen',
    middle_name: '',
    credential: 'PA-C',
    name_prefix: '',
    name_suffix: '',
    organization_name: '',
    display_name: 'Macie Chen',
    primary_taxonomy: 'Physician Assistant',
    primary_taxonomy_code: overrides.primary_taxonomy_code ?? '363A00000X',
    taxonomies: [
      {
        code: overrides.primary_taxonomy_code ?? '363A00000X',
        taxonomy_group: '',
        desc: 'Physician Assistant',
        state: overrides.state ?? 'CA',
        license: 'CA-PA-99821',
        primary: true,
      },
    ],
    practice_address: {
      purpose: 'LOCATION',
      address_1: '500 Parnassus Ave',
      address_2: '',
      city: 'San Francisco',
      state: overrides.state ?? 'CA',
      postal_code: '94143',
      country_code: 'US',
      telephone_number: '',
    },
    mailing_address: null,
    addresses: [],
    identifiers: [],
    endpoints: [],
    other_names: [],
    enumeration_date: '2016-04-01',
    last_updated: '2026-03-01',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('intakeService.bootstrapNpiIntake — Gap 1 regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // No prior PersonProfile for this user/npi.
    prismaMock.personProfile.findUnique.mockResolvedValue(null);
    prismaMock.personProfile.upsert.mockResolvedValue({});
    prismaMock.auditEvent.create.mockResolvedValue({});
  });

  it('hydrates firstName, lastName, specialty, and stateOfPractice from a healthy NPPES payload', async () => {
    // Arrange: fetchNpiFromCMS returns the *wrapper* shape ({ rawPayload, payloadHash }),
    // which is what the real nppes.service.ts returns. detectNpiType must pass
    // `raw.rawPayload` (not `raw`) to normalizeProvider — otherwise normalizeProvider
    // sees undefined fields and the resulting provider has no usable data.
    mockFetchNpiFromCMS.mockResolvedValue({
      rawPayload: { result_count: 1, results: [{ number: VALID_NPI }] },
      payloadHash: 'sha256:fake',
    });
    mockNormalizeProvider.mockReturnValue(buildNormalizedProvider());

    // Act
    const result = await bootstrapNpiIntake('user:macie', VALID_NPI);

    // Assert — these four fields are the regression surface for Gap 1.
    expect(result.firstName).toBe('Macie');
    expect(result.lastName).toBe('Chen');
    expect(result.specialty).toBe('363A00000X');
    expect(result.stateOfPractice).toBe('CA');

    // And confirm the intake service unwrapped the fetch envelope correctly —
    // normalizeProvider must have been called with raw.rawPayload, not raw.
    expect(mockNormalizeProvider).toHaveBeenCalledTimes(1);
    const [firstCallArg] = mockNormalizeProvider.mock.calls[0] as [unknown];
    expect(firstCallArg).toEqual({ result_count: 1, results: [{ number: VALID_NPI }] });
  });

  it('classifies NPI-2 as TYPE_2 and infers VERIFIER persona', async () => {
    mockFetchNpiFromCMS.mockResolvedValue({
      rawPayload: { result_count: 1, results: [{ number: VALID_NPI }] },
      payloadHash: 'sha256:fake',
    });
    mockNormalizeProvider.mockReturnValue(
      buildNormalizedProvider({ enumeration_type: 'NPI-2' }),
    );

    const result = await bootstrapNpiIntake('user:org', VALID_NPI);

    expect(result.npiType).toBe('TYPE_2');
    expect(result.inferredPersona).toBe('VERIFIER');
  });

  it('classifies NPI-1 as TYPE_1 and infers CLINICIAN persona', async () => {
    mockFetchNpiFromCMS.mockResolvedValue({
      rawPayload: { result_count: 1, results: [{ number: VALID_NPI }] },
      payloadHash: 'sha256:fake',
    });
    mockNormalizeProvider.mockReturnValue(buildNormalizedProvider());

    const result = await bootstrapNpiIntake('user:macie', VALID_NPI);

    expect(result.npiType).toBe('TYPE_1');
    expect(result.inferredPersona).toBe('CLINICIAN');
  });

  it('refuses to bind and writes nothing when NPPES cannot be consulted', async () => {
    // Network / upstream failure is a system state, not a finding about the NPI.
    // The bind must fail closed with a 502 and never default the type to TYPE_1,
    // or an NPI the registry never confirmed could be bound.
    mockFetchNpiFromCMS.mockRejectedValue(new Error('NPPES unreachable'));

    await expect(bootstrapNpiIntake('user:macie', VALID_NPI)).rejects.toMatchObject({
      status: 502,
      message: NPI_REGISTRY_UNAVAILABLE_MESSAGE,
    });
    expect(prismaMock.personProfile.upsert).not.toHaveBeenCalled();
    expect(mockNormalizeProvider).not.toHaveBeenCalled();
  });
});
