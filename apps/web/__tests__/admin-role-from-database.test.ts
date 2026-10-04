/**
 * W0-07 — every `/admin/*` page and `/api/admin/*` route decides "is this a
 * platform admin?" from the DATABASE role, never from the Clerk session-token
 * custom claim and never from a request header.
 *
 * Each of the six surfaces is executed (not source-scanned) under the same
 * scenario matrix. A page "proceeds" when its data builder is called; it is
 * "refused" when `redirect()` fires before the builder. A route proceeds with a
 * 200 and is refused with 401/403.
 *
 * The scenarios that would pass on the old code are deliberately absent; the
 * two that fail on it are marked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { signRoleCookie, verifyRoleCookie } from '../lib/auth/roleCookie';

class RedirectSignal extends Error {
  constructor(public readonly to: string) {
    super(`NEXT_REDIRECT ${to}`);
  }
}

const authMock = vi.fn();
const getUserMock = vi.fn();
const cookiesMock = vi.fn();
const headersMock = vi.fn();
const redirectMock = vi.fn((to: string) => {
  throw new RedirectSignal(to);
});
const integrityMock = vi.fn(async () => ({ ok: true }));
const agentOpsMock = vi.fn(async () => ({ decisions: [] }));
/** Delegates to the real, pure plan builder; the spy is the "proceeded" signal. */
const demoPlanMock = vi.fn();
const leadsFindManyMock = vi.fn(async () => []);

vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
  clerkClient: async () => ({ users: { getUser: getUserMock } }),
}));
vi.mock('next/headers', () => ({ cookies: cookiesMock, headers: headersMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('../lib/platform/deployment-integrity', () => ({ buildIntegrityReport: integrityMock }));
vi.mock('../lib/agent/ops/agent-ops-report', () => ({ buildAgentOpsReport: agentOpsMock }));
vi.mock('../lib/demo/demoResetFoundation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/demo/demoResetFoundation')>();
  demoPlanMock.mockImplementation(real.buildDemoResetFoundationPlan);
  return { buildDemoResetFoundationPlan: demoPlanMock };
});
vi.mock('../lib/db', () => ({ prisma: { pilotLead: { findMany: leadsFindManyMock } } }));
vi.mock('../components/platform/PlatformDashboardClient', () => ({ default: () => null }));
vi.mock('../components/agent-ops/AgentOpsClient', () => ({ default: () => null }));

const USER = 'user_test_signed_in';
const BACKEND = 'http://backend.test';

/** The role-assertion headers a caller can type. None may matter. */
const FORGED_HEADERS: Record<string, string> = {
  'x-user-role': 'ADMIN',
  'x-role': 'super-admin',
  'x-verifier-role': 'super-admin',
  'x-vitalcv-role': 'ADMIN',
  'x-clerk-user-role': 'ADMIN',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Scenario {
  /** `null` = signed out. */
  userId: string | null;
  /** The never-configured Clerk claim. Must be ignored. */
  claimRole?: string;
  /** Raw `vitalcv_role` cookie value. */
  cookie?: string;
  /** What the backend `/api/me/role` answers; `'down'` = fetch throws. */
  backend?: { role: string } | 'down' | { status: number };
  forgedHeaders?: boolean;
}

function arrange(s: Scenario) {
  authMock.mockResolvedValue({
    userId: s.userId,
    sessionClaims: s.claimRole ? { vitalcv: { role: s.claimRole } } : {},
    getToken: async () => 'session-token',
  });
  const headerMap = new Map<string, string>(s.forgedHeaders ? Object.entries(FORGED_HEADERS) : []);
  headersMock.mockResolvedValue({ get: (k: string) => headerMap.get(k.toLowerCase()) ?? null });
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === 'vitalcv_role' && s.cookie ? { value: s.cookie } : undefined),
  });
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (s.backend === 'down') throw new Error('ECONNREFUSED');
    if (s.backend && 'status' in s.backend) return jsonResponse({ error: 'x' }, s.backend.status);
    return jsonResponse({ role: s.backend?.role ?? 'CLINICIAN', userId: 'row-1' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock };
}

const PAGES = [
  { name: '/admin/platform', load: () => import('../app/admin/platform/page'), proceeds: () => integrityMock },
  { name: '/admin/agent-ops', load: () => import('../app/admin/agent-ops/page'), proceeds: () => agentOpsMock },
  { name: '/admin/leads', load: () => import('../app/admin/leads/page'), proceeds: () => leadsFindManyMock },
  { name: '/admin/demo-reset', load: () => import('../app/admin/demo-reset/page'), proceeds: () => demoPlanMock },
] as const;

const ROUTES = [
  { name: '/api/admin/platform', load: () => import('../app/api/admin/platform/route'), proceeds: () => integrityMock },
  { name: '/api/admin/agent-ops', load: () => import('../app/api/admin/agent-ops/route'), proceeds: () => agentOpsMock },
] as const;

async function runPage(load: () => Promise<{ default: () => Promise<unknown> }>) {
  const { default: Page } = await load();
  try {
    await Page();
    return { redirectedTo: null as string | null };
  } catch (err) {
    if (err instanceof RedirectSignal) return { redirectedTo: err.to };
    throw err;
  }
}

async function runRoute(load: () => Promise<{ GET: (req?: NextRequest) => Promise<Response> }>, forged: boolean) {
  const { GET } = await load();
  const req = new NextRequest(`http://localhost${'/api/admin/x'}`, {
    headers: forged ? FORGED_HEADERS : {},
  });
  return GET(req);
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.stubEnv('ROLE_COOKIE_SECRET', 'test-secret-w007');
  process.env.BACKEND_URL = BACKEND;
  for (const m of [authMock, getUserMock, cookiesMock, headersMock, redirectMock, integrityMock, agentOpsMock, demoPlanMock, leadsFindManyMock]) {
    m.mockClear();
  }
});

describe.each(PAGES)('page $name', ({ load, proceeds }) => {
  it('FAILS ON OLD CODE: a session-token claim of ADMIN with a database role of CLINICIAN is refused', async () => {
    arrange({ userId: USER, claimRole: 'ADMIN', backend: { role: 'CLINICIAN' } });
    const { redirectedTo } = await runPage(load);
    expect(redirectedTo).toBe('/');
    expect(proceeds()).not.toHaveBeenCalled();
  });

  it('FAILS ON OLD CODE: a database role of ADMIN with no claim and no cookie is admitted', async () => {
    const { fetchMock } = arrange({ userId: USER, backend: { role: 'ADMIN' } });
    const { redirectedTo } = await runPage(load);
    expect(redirectedTo).toBeNull();
    expect(proceeds()).toHaveBeenCalledTimes(1);
    // The backend was asked with the VERIFIED identity, nothing else.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BACKEND}/api/me/role`);
    expect((init.headers as Record<string, string>)['x-clerk-user-id']).toBe(USER);
  });

  it('a signed ADMIN cookie admits without a backend round-trip', async () => {
    const cookie = await signRoleCookie('ADMIN');
    const { fetchMock } = arrange({ userId: USER, cookie: cookie! });
    const { redirectedTo } = await runPage(load);
    expect(redirectedTo).toBeNull();
    expect(proceeds()).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a forged ADMIN cookie plus every role header plus the claim, with a CLINICIAN database role, is refused', async () => {
    const real = await signRoleCookie('CLINICIAN');
    const forgedCookie = real!.replace(/^CLINICIAN\./, 'ADMIN.');
    const { fetchMock } = arrange({
      userId: USER,
      claimRole: 'ADMIN',
      cookie: forgedCookie,
      backend: { role: 'CLINICIAN' },
      forgedHeaders: true,
    });
    const { redirectedTo } = await runPage(load);
    expect(redirectedTo).toBe('/');
    expect(proceeds()).not.toHaveBeenCalled();
    // The forged role headers were not forwarded to the backend either.
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    for (const h of Object.keys(FORGED_HEADERS)) {
      expect(init.headers as Record<string, string>).not.toHaveProperty(h);
    }
  });

  it('a signed CLINICIAN cookie is refused with the usual redirect', async () => {
    const cookie = await signRoleCookie('CLINICIAN');
    arrange({ userId: USER, cookie: cookie! });
    const { redirectedTo } = await runPage(load);
    expect(redirectedTo).toBe('/');
    expect(proceeds()).not.toHaveBeenCalled();
  });

  it('a signed-out visitor is sent to sign-in', async () => {
    arrange({ userId: null });
    const { redirectedTo } = await runPage(load);
    expect(redirectedTo).toMatch(/^\/sign-in\?redirect_url=/);
    expect(proceeds()).not.toHaveBeenCalled();
  });

  it('an unreachable backend fails closed', async () => {
    arrange({ userId: USER, claimRole: 'ADMIN', backend: 'down' });
    const { redirectedTo } = await runPage(load);
    expect(redirectedTo).toBe('/');
    expect(proceeds()).not.toHaveBeenCalled();
  });

  it('a backend error fails closed', async () => {
    arrange({ userId: USER, backend: { status: 404 } });
    const { redirectedTo } = await runPage(load);
    expect(redirectedTo).toBe('/');
    expect(proceeds()).not.toHaveBeenCalled();
  });
});

describe.each(ROUTES)('route $name', ({ load, proceeds }) => {
  it('FAILS ON OLD CODE: a session-token claim of ADMIN with a database role of CLINICIAN is 403', async () => {
    arrange({ userId: USER, claimRole: 'ADMIN', backend: { role: 'CLINICIAN' } });
    const res = await runRoute(load, false);
    expect(res.status).toBe(403);
    expect(proceeds()).not.toHaveBeenCalled();
  });

  it('FAILS ON OLD CODE: a database role of ADMIN with no claim and no cookie is 200', async () => {
    arrange({ userId: USER, backend: { role: 'ADMIN' } });
    const res = await runRoute(load, false);
    expect(res.status).toBe(200);
    expect(proceeds()).toHaveBeenCalledTimes(1);
  });

  it('a signed ADMIN cookie is 200 without a backend round-trip', async () => {
    const cookie = await signRoleCookie('ADMIN');
    const { fetchMock } = arrange({ userId: USER, cookie: cookie! });
    const res = await runRoute(load, false);
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a forged cookie plus every role header on the request, with a CLINICIAN database role, is 403', async () => {
    const real = await signRoleCookie('CLINICIAN');
    const forgedCookie = real!.replace(/^CLINICIAN\./, 'ADMIN.');
    arrange({ userId: USER, claimRole: 'ADMIN', cookie: forgedCookie, backend: { role: 'CLINICIAN' }, forgedHeaders: true });
    const res = await runRoute(load, true);
    expect(res.status).toBe(403);
    expect(proceeds()).not.toHaveBeenCalled();
  });

  it('a signed-out caller is 401', async () => {
    arrange({ userId: null });
    const res = await runRoute(load, false);
    expect(res.status).toBe(401);
  });

  it('an unreachable backend is 403', async () => {
    arrange({ userId: USER, backend: 'down' });
    const res = await runRoute(load, false);
    expect(res.status).toBe(403);
  });
});

describe('/api/auth/resolve-role carries the database role into the signed cookie', () => {
  it('mints a vitalcv_role cookie that verifies to ADMIN when the backend says ADMIN', async () => {
    arrange({ userId: USER, backend: { role: 'ADMIN' } });
    getUserMock.mockResolvedValue({ emailAddresses: [], primaryEmailAddressId: null });
    const { GET } = await import('../app/api/auth/resolve-role/route');
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ role: 'ADMIN' });
    const setCookie = res.headers.get('set-cookie') ?? '';
    const value = /vitalcv_role=([^;]+)/.exec(setCookie)?.[1];
    expect(value).toBeTruthy();
    await expect(verifyRoleCookie(value)).resolves.toBe('ADMIN');
  });
});
