/**
 * Wave 1072C / C1 + C2 — the identity and enumeration boundaries.
 *
 * These assert the properties the founder gate names, at the layer that
 * actually enforces them. They are written to FAIL if anyone reintroduces
 * header trust or widens the anonymous MATCHA response.
 */

import type { Request } from 'express';

import { HttpError } from '../../utils/httpError';
import {
  requireVerifiedClerkUserId,
  requireNpiAuthorization,
} from '../../middleware/verifiedActor';
import { toPublicSafeMatches } from '../../services/matcha/publicSafeMatches';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    npiOwnership: { findFirst: jest.fn() },
    // requireNpiAuthorization resolves the INTERNAL User.id first:
    // npi_ownership.user_id is a uuid column, not the Clerk subject.
    user: { findUnique: jest.fn() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prisma = require('../../graphql/prisma_client').default as {
  npiOwnership: { findFirst: jest.Mock };
  user: { findUnique: jest.Mock };
};

const req = (over: Partial<Request> & Record<string, unknown> = {}) =>
  ({ headers: {}, ...over }) as unknown as Request;

describe('C1 — a browser may not assert the identity that authorizes a share', () => {
  it('rejects an anonymous request', () => {
    expect(() => requireVerifiedClerkUserId(req())).toThrow(HttpError);
    expect(() => requireVerifiedClerkUserId(req())).toThrow(/Verified Clerk session required/);
  });

  it('rejects a FORGED x-clerk-user-id header — the header is never read', () => {
    const forged = req({ headers: { 'x-clerk-user-id': 'user_attacker' } });
    expect(() => requireVerifiedClerkUserId(forged)).toThrow(HttpError);
  });

  it('ignores a forged header even when a DIFFERENT session is verified', () => {
    const mismatched = req({
      headers: { 'x-clerk-user-id': 'user_attacker' },
      verifiedAuth: { outcome: 'verified_mismatch', verifiedUserId: 'user_real' },
    });
    // identity comes from the token, so the header cannot change the actor
    expect(requireVerifiedClerkUserId(mismatched)).toBe('user_real');
  });

  it('accepts a verified session', () => {
    const ok = req({ verifiedAuth: { outcome: 'token_only', verifiedUserId: 'user_real' } });
    expect(requireVerifiedClerkUserId(ok)).toBe('user_real');
  });

  it('does not degrade to header trust when verification is unavailable', () => {
    // outcome 'header_without_token' is precisely the legacy call site: a
    // header arrived with no token. It must NOT authorize.
    const legacy = req({
      headers: { 'x-clerk-user-id': 'user_legacy' },
      verifiedAuth: { outcome: 'header_without_token' },
    });
    expect(() => requireVerifiedClerkUserId(legacy)).toThrow(HttpError);
  });
});

describe('C1 — a signed-in user cannot act on another clinician’s NPI', () => {
  beforeEach(() => {
    prisma.npiOwnership.findFirst.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.user.findUnique.mockResolvedValue({ id: '11111111-2222-3333-4444-555555555555' });
  });

  it('allows the owner', async () => {
    // Wave 1075: authority is verifiedAt + a recognised method, not mere existence.
    prisma.npiOwnership.findFirst.mockResolvedValue(
      { verifiedAt: new Date('2026-02-01T00:00:00Z'), verificationMethod: 'ADMIN_VERIFIED', revokedAt: null },
    );
    await expect(requireNpiAuthorization('user_real', '1234567893')).resolves.toBeUndefined();
    // The user and NPI are what scope the lookup. This deliberately does NOT
    // pin the rest of the where clause: it once asserted `revokedAt: null`,
    // and went red when the query started reading revoked rows so it could
    // report them AS revoked — a better refusal, failing an outcome-blind test.
    expect(prisma.npiOwnership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        /*
         * The INTERNAL User.id, not the Clerk subject: npi_ownership.user_id
         * is a uuid column, and querying it with `user_real` made Postgres
         * reject the comparison — an authenticated request got a 500 instead
         * of a 403, and a real binding could never have matched.
         */
        where: expect.objectContaining({
          userId: '11111111-2222-3333-4444-555555555555',
          npi: '1234567893',
        }),
      }),
    );
  });

  it('rejects a PENDING self-asserted claim — a request is not authority', async () => {
    prisma.npiOwnership.findFirst.mockResolvedValue(
      { verifiedAt: null, verificationMethod: 'CLAIMED', revokedAt: null },
    );
    await expect(requireNpiAuthorization('user_real', '1234567893')).rejects.toMatchObject({
      status: 403,
      code: 'OWNERSHIP_PENDING',
    });
  });

  it('rejects a mismatched NPI with 403', async () => {
    prisma.npiOwnership.findFirst.mockResolvedValue(null);
    await expect(requireNpiAuthorization('user_real', '1578672820')).rejects.toMatchObject({ status: 403 });
  });

  it('rejects a REVOKED binding and says it was revoked', async () => {
    prisma.npiOwnership.findFirst.mockResolvedValue(
      { verifiedAt: new Date('2026-02-01T00:00:00Z'), verificationMethod: 'ADMIN_VERIFIED', revokedAt: new Date('2026-03-01T00:00:00Z') },
    );
    await expect(requireNpiAuthorization('user_real', '1234567893')).rejects.toThrow(HttpError);
    await expect(requireNpiAuthorization('user_real', '1234567893')).rejects.toThrow(/revoked/i);
  });

  it('rejects a malformed NPI before it reaches a query', async () => {
    await expect(requireNpiAuthorization('user_real', '123')).rejects.toMatchObject({ status: 400 });
    expect(prisma.npiOwnership.findFirst).not.toHaveBeenCalled();
  });
});

describe('C2 — the public projection cannot leak compiled readiness', () => {
  /** A full engine result, with every private field the engine can emit. */
  const fullResult = {
    npi: '1578672820',
    clinicianName: 'JEAN ABBOTT',
    profileCompleteness: 0.62,
    matches: [
      {
        opportunity: {
          id: 'opp-1', title: 'EM Physician', organizationName: 'Cascade Regional',
          organizationId: 'org-uuid-1', state: 'CO', hiringType: 'Full-time',
          // Emitted by the live mapper from the server's integrated-apply rule.
          applicationMode: 'vitalcv',
        },
        explanation: {
          matchBand: 'INELIGIBLE',
          matchScore: 21,
          fitReasons: [
            { label: 'Specialty matches: emergency medicine', dimension: 'specialty' },
            { label: 'DEA registration on file, not source-checked', dimension: 'credential' },
            { label: '40% of requirements met at L3', dimension: 'coverage' },
          ],
          blockers: [
            { label: 'Missing state license: CO', key: 'state_license' },
            { label: 'OIG exclusion match', key: 'exclusion' },
          ],
          instantOfferEligible: false,
        },
      },
    ],
  };

  const publicResult = toPublicSafeMatches('1578672820', fullResult);
  const serialized = JSON.stringify(publicResult);

  it('declares itself public and prompts sign-in rather than substituting data', () => {
    expect(publicResult.visibility).toBe('public');
    expect(publicResult.signInPrompt).toMatch(/sign in/i);
    expect(publicResult.matches).toHaveLength(1);
  });

  it('keeps public opportunity information', () => {
    const [m] = publicResult.matches;
    expect(m.title).toBe('EM Physician');
    expect(m.organizationName).toBe('Cascade Regional');
    expect(m.state).toBe('CO');
  });

  it('emits NO credential-derived band, score, blocker, or coverage detail', () => {
    for (const leak of [
      'INELIGIBLE', 'matchBand', 'matchScore', 'blockers',
      'Missing state license', 'OIG exclusion', 'exclusion',
      'not source-checked', 'requirements met', 'profileCompleteness',
      'instantOfferEligible',
    ]) {
      // named per-iteration so a failure says WHICH field leaked
      expect({ leak, leaked: serialized.includes(leak) }).toEqual({ leak, leaked: false });
    }
  });

  it('keeps only reasons traceable to the public registry', () => {
    const [m] = publicResult.matches;
    expect(m.publicReasons).toEqual(['Specialty matches: emergency medicine']);
    expect(m.fitIndication).toBe('possible_fit');
  });

  it('is an allowlist: unknown private fields added later cannot pass through', () => {
    const withNewSecret = {
      matches: [{
        opportunity: { id: 'opp-2', title: 'Role', organizationId: 'org-2' },
        explanation: { fitReasons: [], blockers: [], futurePrivateField: 'sanction detail' },
      }],
    };
    expect(JSON.stringify(toPublicSafeMatches('1578672820', withNewSecret)))
      .not.toContain('sanction detail');
  });

  it('reports apply availability only when the server marked the listing integrated AND an organization resolves', () => {
    expect(publicResult.matches[0].applyAvailable).toBe(true);
    const noOrg = toPublicSafeMatches('1578672820', {
      matches: [{ opportunity: { id: 'opp-3', title: 'Role', applicationMode: 'vitalcv' }, explanation: {} }],
    });
    expect(noOrg.matches[0].applyAvailable).toBe(false);
    expect(noOrg.matches[0].organizationId).toBeUndefined();

    // A feed placeholder has an organization id too. It is not a recipient.
    const feedRow = toPublicSafeMatches('1578672820', {
      matches: [{
        opportunity: { id: 'opp-4', title: 'Role', organizationId: 'org-placeholder', applicationMode: 'external' },
        explanation: {},
      }],
    });
    expect(feedRow.matches[0].applyAvailable).toBe(false);

    // No mode at all (an older mapper, an in-memory demo row): not available.
    const unmarked = toPublicSafeMatches('1578672820', {
      matches: [{ opportunity: { id: 'opp-5', title: 'Role', organizationId: 'org-2' }, explanation: {} }],
    });
    expect(unmarked.matches[0].applyAvailable).toBe(false);
  });

  it('degrades safely on an empty or malformed engine result', () => {
    expect(toPublicSafeMatches('1578672820', null).matches).toEqual([]);
    expect(toPublicSafeMatches('1578672820', { matches: [] }).matches).toEqual([]);
  });
});
