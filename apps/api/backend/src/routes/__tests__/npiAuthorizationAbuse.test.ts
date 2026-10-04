/**
 * NPI authorization — abuse cases, asserted at the ROUTE.
 *
 * The helper-level tests in applyIdentityBoundary.test.ts prove the primitives
 * refuse. They cannot prove a route CALLS them: a handler that forgets the
 * check keeps every helper test green. These drive the real Express routes,
 * registered exactly as the server registers them, and assert the status a
 * client would actually receive.
 *
 * Each case corresponds to an abuse the production system permitted before
 * this hotfix:
 *  - anonymous readers compiled a clinician's readiness from a public NPI
 *  - `x-clerk-user-id` was accepted as identity, so the header WAS the account
 *  - a signed-in user could read, share and revoke against any other NPI
 */

import express from 'express';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    $use: jest.fn(),
    npiOwnership: { findFirst: jest.fn() },
    // requireNpiAuthorization resolves the INTERNAL User.id first:
    // npi_ownership.user_id is a uuid column, not the Clerk subject.
    user: { findUnique: jest.fn() },
    opportunity: { findUnique: jest.fn() },
  },
}));

jest.mock('../../services/matcha/liveMatchaService', () => ({
  getLiveMatchesForNpi: jest.fn(),
  scoreOpportunityForNpi: jest.fn(),
  simulateForNpi: jest.fn(),
}));

jest.mock('../../services/distribution/applyBundle', () => ({
  generateApplyBundle: jest.fn(),
  getApplyBundle: jest.fn(),
  verifyBundle: jest.fn(),
}));

jest.mock('../../services/distribution/applyShareService', () => ({
  shareBundle: jest.fn(),
  listSharesForNpi: jest.fn(),
  revokeShare: jest.fn(),
  validateOrganizationContext: jest.fn(() => ({ valid: true })),
  ShareValidationError: class ShareValidationError extends Error {},
}));

jest.mock('../../services/feedback/prismaEventStore', () => ({
  emitLearningEvent: jest.fn(),
}));

import prismaClient from '../../graphql/prisma_client';
import { registerApplyRoutes } from '../apply';
import { registerMatchaRoutes } from '../matcha';
import { getLiveMatchesForNpi } from '../../services/matcha/liveMatchaService';
import { generateApplyBundle } from '../../services/distribution/applyBundle';
import { listSharesForNpi, revokeShare } from '../../services/distribution/applyShareService';

const prisma = prismaClient as unknown as {
  npiOwnership: { findFirst: jest.Mock };
  user: { findUnique: jest.Mock };
  opportunity: { findUnique: jest.Mock };
};

/** The clinician who owns MINE. ATTACKER owns nothing. */
const OWNER = 'user_owner';
const ATTACKER = 'user_attacker';
const MINE = '1003000126';

/**
 * Clerk subject -> internal User.id.
 *
 * npi_ownership.user_id is a uuid column holding the INTERNAL id, so an
 * ownership mock must key on THAT. Keeping a deterministic map lets these
 * tests still say "the owner" and "the attacker" in Clerk terms.
 */
const INTERNAL_ID: Record<string, string> = {};
let internalSeq = 0;
const internalIdFor = (clerkId: string): string => {
  if (!INTERNAL_ID[clerkId]) {
    internalSeq += 1;
    INTERNAL_ID[clerkId] = `00000000-0000-4000-8000-${String(internalSeq).padStart(12, '0')}`;
  }
  return INTERNAL_ID[clerkId];
};

const VERIFIED_BINDING = {
  verifiedAt: new Date('2026-02-01T00:00:00Z'),
  verificationMethod: 'ADMIN_VERIFIED',
  revokedAt: null,
};
const THEIRS = '1003000134';

/*
 * A response double that behaves like Express: `locals` exists, `status()`
 * chains, and the promise settles on json() OR on the error handler. Route
 * middleware (the public rate limiter) reads res.locals, so omitting it would
 * make every rate-limited route throw for the wrong reason.
 */
function invoke(
  app: express.Express,
  method: 'get' | 'post' | 'delete',
  routePath: string,
  opts: {
    params?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
    verifiedUserId?: string;
  } = {},
): Promise<{ status: number; body: unknown }> {
  const layers = (app as unknown as {
    _router: { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Function }> } }> };
  })._router.stack;
  const layer = layers.find((l) => l.route?.path === routePath && l.route?.methods[method]);
  if (!layer?.route) throw new Error(`route not registered: ${method.toUpperCase()} ${routePath}`);

  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const req = {
      method: method.toUpperCase(),
      params: opts.params ?? {},
      query: {},
      body: opts.body ?? {},
      headers: opts.headers ?? {},
      route: { path: routePath },
      ...(opts.verifiedUserId ? { verifiedAuth: { verifiedUserId: opts.verifiedUserId } } : {}),
    } as unknown as express.Request;
    const res = {
      locals: {},
      status(code: number) { statusCode = code; return this; },
      json(payload: unknown) { resolve({ status: statusCode, body: payload }); return this; },
      setHeader() { return this; },
    } as unknown as express.Response;

    const stack = layer.route!.stack;
    const step = (i: number): void => {
      if (i >= stack.length) return;
      try {
        // asyncHandler forwards thrown HttpErrors to `next`; treat that as the
        // client-visible response rather than letting the promise hang.
        const next = (err?: unknown) => {
          if (err) {
            const e = err as { status?: number; statusCode?: number; message?: string };
            resolve({ status: e.status ?? e.statusCode ?? 500, body: { error: e.message } });
            return;
          }
          step(i + 1);
        };
        Promise.resolve(stack[i].handle(req, res, next)).catch(next);
      } catch (error) { reject(error); }
    };
    step(0);
  });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  registerApplyRoutes(app);
  registerMatchaRoutes(app);
  return app;
}

const LIVE_RESULT = {
  npi: MINE,
  clinicianName: 'JEAN ABBOTT',
  profileCompleteness: { level: 'partial', missingForHigherMatches: ['dea'] },
  matches: [{
    opportunityId: 'opp-1',
    band: 'INELIGIBLE',
    score: 21,
    blockers: [{ label: 'Missing state license: CA' }],
    opportunity: {
      id: 'opp-1', title: 'Staff Internist', organizationId: 'org-1', state: 'CA', hiringType: 'perm',
      applicationMode: 'vitalcv',
    },
    explanation: {
      matchBand: 'INELIGIBLE',
      matchScore: 21,
      fitReasons: [
        { label: 'Specialty matches: internal medicine', dimension: 'specialty' },
        { label: '40% of requirements met at L3', dimension: 'coverage' },
      ],
      blockers: [{ label: 'Missing state license: CA' }],
    },
  }],
};

/** Every private field the production response leaked to anonymous callers. */
const PRIVATE_MARKERS = [
  'matchBand', 'matchScore', 'blockers', 'INELIGIBLE', 'clinicianName',
  'profileCompleteness', 'missingForHigherMatches', 'requirements met', 'explanation',
];

function assertNoPrivateDetail(body: unknown) {
  const raw = JSON.stringify(body);
  for (const marker of PRIVATE_MARKERS) {
    if (raw.includes(marker)) {
      throw new Error(`anonymous response leaked private marker "${marker}"`);
    }
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockImplementation(
    async ({ where }: { where: { clerkUserId: string } }) => ({ id: internalIdFor(where.clerkUserId) }),
  );
  (getLiveMatchesForNpi as jest.Mock).mockResolvedValue(LIVE_RESULT);
  (generateApplyBundle as jest.Mock).mockResolvedValue({
    credentials: [{ type: 'LICENSE', issuer: 'CA Medical Board', status: 'ACTIVE' }],
    trustState: { readiness: 'partial' },
  });
  (listSharesForNpi as jest.Mock).mockResolvedValue([{ shareId: 'share-1' }]);
  (revokeShare as jest.Mock).mockResolvedValue({ success: true });
  /*
   * OWNER holds a VERIFIED binding for MINE; nobody holds one for THEIRS.
   * Wave 1075: a bare row is no longer authority — only `verifiedAt` plus a
   * recognised method is. A fixture without them is a PENDING claim.
   */
  prisma.npiOwnership.findFirst.mockImplementation(async ({ where }: { where: { userId: string; npi: string } }) =>
    where.userId === internalIdFor(OWNER) && where.npi === MINE ? VERIFIED_BINDING : null,
  );
  prisma.opportunity.findUnique.mockResolvedValue(null);
});

describe('1 — anonymous MATCHA cannot read private clinician details', () => {
  it('serves the public level with no credential-derived detail', async () => {
    const r = await invoke(buildApp(), 'get', '/api/matcha/opportunities/:npi', { params: { npi: MINE } });
    expect(r.status).toBe(200);
    expect((r.body as { visibility: string }).visibility).toBe('public');
    assertNoPrivateDetail(r.body);
  });
});

describe('2 — sequential valid-NPI enumeration yields no private readiness', () => {
  /*
   * The abuse is not one request; it is walking the NPI space. An NPI is
   * public and check-digit-derivable, so the only defence is that the
   * response carries nothing worth harvesting.
   */
  const SWEEP = ['1003000126', '1003000134', '1003000142', '1003000159', '1003000167', '1003000175'];

  it('returns the public level for every NPI in a sweep', async () => {
    const app = buildApp();
    for (const npi of SWEEP) {
      const r = await invoke(app, 'get', '/api/matcha/opportunities/:npi', { params: { npi } });
      expect(r.status).toBe(200);
      expect((r.body as { visibility: string }).visibility).toBe('public');
      assertNoPrivateDetail(r.body);
    }
  });

  it('does not let a session for ONE npi widen the rest of the sweep', async () => {
    const app = buildApp();
    for (const npi of SWEEP) {
      const r = await invoke(app, 'get', '/api/matcha/opportunities/:npi', {
        params: { npi }, verifiedUserId: OWNER,
      });
      const visibility = (r.body as { visibility: string }).visibility;
      if (npi === MINE) {
        expect(visibility).toBe('authenticated');
      } else {
        expect(visibility).toBe('public');
        assertNoPrivateDetail(r.body);
      }
    }
  });
});

describe('3 — a forged identity header grants no additional access', () => {
  it.each([
    ['matcha opportunities', 'get' as const, '/api/matcha/opportunities/:npi', 200, 'public'],
    ['matcha simulate', 'get' as const, '/api/matcha/simulate/:npi', 401, null],
    ['apply credentials', 'get' as const, '/api/apply/credentials/:npi', 401, null],
    ['share history', 'get' as const, '/api/apply/shares/:npi', 401, null],
  ])('%s ignores x-clerk-user-id', async (_label, method, path, status, visibility) => {
    const r = await invoke(buildApp(), method, path, {
      params: { npi: MINE },
      headers: { 'x-clerk-user-id': OWNER },
    });
    expect(r.status).toBe(status);
    if (visibility) {
      expect((r.body as { visibility: string }).visibility).toBe(visibility);
      assertNoPrivateDetail(r.body);
    }
  });

  it('cannot create a share with a forged header', async () => {
    const r = await invoke(buildApp(), 'post', '/api/apply/share', {
      headers: { 'x-clerk-user-id': OWNER },
      body: { npi: MINE, organization_context: { organization_id: 'org-1', name: 'X', purpose_of_use: 'hiring' } },
    });
    expect(r.status).toBe(401);
  });
});

describe('4 — a valid user cannot query another clinician’s private MATCHA', () => {
  it('drops to the public level for an NPI the session does not own', async () => {
    const r = await invoke(buildApp(), 'get', '/api/matcha/opportunities/:npi', {
      params: { npi: THEIRS }, verifiedUserId: ATTACKER,
    });
    expect((r.body as { visibility: string }).visibility).toBe('public');
    assertNoPrivateDetail(r.body);
  });

  it('refuses simulate for an NPI the session does not own', async () => {
    const r = await invoke(buildApp(), 'get', '/api/matcha/simulate/:npi', {
      params: { npi: THEIRS }, verifiedUserId: ATTACKER,
    });
    expect(r.status).toBe(403);
  });
});

describe('5 — anonymous simulate and score requests fail', () => {
  it('refuses simulate', async () => {
    const r = await invoke(buildApp(), 'get', '/api/matcha/simulate/:npi', { params: { npi: MINE } });
    expect(r.status).toBe(401);
  });

  it('refuses explain (the endpoint the web score route proxies to)', async () => {
    const r = await invoke(buildApp(), 'post', '/api/matcha/explain', {
      body: { npi: MINE, opportunityId: 'opp-1' },
    });
    expect(r.status).toBe(401);
  });
});

describe('6 — anonymous credential loading fails', () => {
  it('refuses without a verified session', async () => {
    const r = await invoke(buildApp(), 'get', '/api/apply/credentials/:npi', { params: { npi: MINE } });
    expect(r.status).toBe(401);
    expect(JSON.stringify(r.body)).not.toContain('CA Medical Board');
  });

  it('refuses a session that does not own the NPI', async () => {
    const r = await invoke(buildApp(), 'get', '/api/apply/credentials/:npi', {
      params: { npi: THEIRS }, verifiedUserId: ATTACKER,
    });
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).not.toContain('CA Medical Board');
  });

  it('serves the owner', async () => {
    const r = await invoke(buildApp(), 'get', '/api/apply/credentials/:npi', {
      params: { npi: MINE }, verifiedUserId: OWNER,
    });
    expect(r.status).toBe(200);
    expect((r.body as { credentials: unknown[] }).credentials).toHaveLength(1);
  });
});

/*
 * 7 — bundle GENERATION is the same disclosure as credential loading: it
 * compiles the clinician's credentials into a signable object. This block
 * exists because an injection run removed the binding from this route and
 * every other test stayed green — the suite was asserting the door it knew
 * about and not the one beside it.
 */
describe('7 — a user cannot generate another clinician’s apply bundle', () => {
  it('refuses anonymously', async () => {
    const r = await invoke(buildApp(), 'post', '/api/apply/bundle', { body: { npi: MINE } });
    expect(r.status).toBe(401);
    expect(generateApplyBundle).not.toHaveBeenCalled();
  });

  it('refuses a forged identity header', async () => {
    const r = await invoke(buildApp(), 'post', '/api/apply/bundle', {
      headers: { 'x-clerk-user-id': OWNER }, body: { npi: MINE },
    });
    expect(r.status).toBe(401);
    expect(generateApplyBundle).not.toHaveBeenCalled();
  });

  it('refuses an NPI the session does not own', async () => {
    const r = await invoke(buildApp(), 'post', '/api/apply/bundle', {
      verifiedUserId: ATTACKER, body: { npi: THEIRS },
    });
    expect(r.status).toBe(403);
    expect(generateApplyBundle).not.toHaveBeenCalled();
  });

  it('serves the owner their own bundle', async () => {
    const r = await invoke(buildApp(), 'post', '/api/apply/bundle', {
      verifiedUserId: OWNER, body: { npi: MINE },
    });
    expect(r.status).toBe(201);
    expect(generateApplyBundle).toHaveBeenCalledWith(MINE, { selectiveClaims: undefined });
  });
});

describe('8 — a user cannot create a share for another clinician', () => {
  it('refuses a share addressed to an NPI the session does not own', async () => {
    const r = await invoke(buildApp(), 'post', '/api/apply/share', {
      verifiedUserId: ATTACKER,
      body: { npi: THEIRS, organization_context: { organization_id: 'org-1', name: 'X', purpose_of_use: 'hiring' } },
    });
    expect(r.status).toBe(403);
  });
});

describe('9 — a user cannot list another clinician’s share history', () => {
  it('refuses when the NPI in the URL is not the session’s', async () => {
    const r = await invoke(buildApp(), 'get', '/api/apply/shares/:npi', {
      params: { npi: THEIRS }, verifiedUserId: ATTACKER,
    });
    expect(r.status).toBe(403);
    expect(listSharesForNpi).not.toHaveBeenCalled();
  });

  it('serves the owner their own history', async () => {
    const r = await invoke(buildApp(), 'get', '/api/apply/shares/:npi', {
      params: { npi: MINE }, verifiedUserId: OWNER,
    });
    expect(r.status).toBe(200);
    expect(listSharesForNpi).toHaveBeenCalledWith(MINE);
  });
});

describe('10 — a user cannot revoke another clinician’s share', () => {
  it('requires a verified session', async () => {
    const r = await invoke(buildApp(), 'delete', '/api/apply/share/:shareId', {
      params: { shareId: 'share-1' }, headers: { 'x-clerk-user-id': OWNER },
    });
    expect(r.status).toBe(401);
    expect(revokeShare).not.toHaveBeenCalled();
  });

  it('passes the VERIFIED user to the ownership check, never a header value', async () => {
    await invoke(buildApp(), 'delete', '/api/apply/share/:shareId', {
      params: { shareId: 'share-1' },
      headers: { 'x-clerk-user-id': OWNER },
      verifiedUserId: ATTACKER,
    });
    // The service refuses a share the caller does not own; what matters here
    // is that it is told who the caller VERIFIABLY is.
    expect(revokeShare).toHaveBeenCalledWith('share-1', ATTACKER);
  });
});

describe('12 — public-safe opportunity discovery still works', () => {
  it('keeps the listing facts a visitor needs', async () => {
    const r = await invoke(buildApp(), 'get', '/api/matcha/opportunities/:npi', { params: { npi: MINE } });
    const match = (r.body as { matches: Array<Record<string, unknown>> }).matches[0];
    expect(match.title).toBe('Staff Internist');
    expect(match.state).toBe('CA');
    expect(match.hiringType).toBe('perm');
    expect(match.organizationId).toBe('org-1');
    expect(match.applyAvailable).toBe(true);
    // A public reason must be traceable to public registry taxonomy, so the
    // specialty reason survives and the coverage reason does not.
    expect(match.publicReasons).toEqual(['Specialty matches: internal medicine']);
  });

  it('prompts sign-in rather than pretending there is nothing more', async () => {
    const r = await invoke(buildApp(), 'get', '/api/matcha/opportunities/:npi', { params: { npi: MINE } });
    expect((r.body as { signInPrompt?: string }).signInPrompt).toBeTruthy();
  });
});
