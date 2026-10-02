import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
const buildForwardHeadersMock = vi.fn();
const requireAuthenticatedOrgContextMock = vi.fn();
const resolveIntelligenceAuthContextMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('server-only', () => ({}));

vi.mock('../app/api/intelligence/_shared', () => ({
  buildForwardHeaders: buildForwardHeadersMock,
  requireAuthenticatedOrgContext: requireAuthenticatedOrgContextMock,
  resolveIntelligenceAuthContext: resolveIntelligenceAuthContextMock,
}));

describe('marketplace proxies', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    buildForwardHeadersMock.mockReset();
    requireAuthenticatedOrgContextMock.mockReset();
    resolveIntelligenceAuthContextMock.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
    process.env.API_KEYS = 'server-api-key';
    buildForwardHeadersMock.mockImplementation(async (init?: HeadersInit, options?: {
      context?: {
        userId?: string | null;
        email?: string | null;
        role?: string | null;
        orgId?: string | null;
      };
    }) => {
      const headers = new Headers(init);
      const context = options?.context;

      if (context?.userId) {
        headers.set('x-clerk-user-id', context.userId);
      }

      if (context?.email) {
        headers.set('x-clerk-user-email', context.email);
      }

      if (context?.role) {
        headers.set('x-clerk-user-role', context.role);
        headers.set('x-user-role', context.role);
      }

      if (context?.orgId) {
        headers.set('x-org-id', context.orgId);
      }

      return headers;
    });
  });

  it('forwards apply requests with authenticated Clerk headers from the server', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      sessionClaims: { email: 'ada@example.com' },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: 'app_1', status: 'PENDING' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/opportunities/[id]/apply/route');
    const response = await POST(new Request('http://localhost/api/opportunities/opp_1/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverNote: 'Ready to start' }),
    }) as never, { params: Promise.resolve({ id: 'opp_1' }) });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/opportunities/opp_1/apply',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
        body: JSON.stringify({ coverNote: 'Ready to start' }),
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get('x-clerk-user-id')).toBe('clerk-user-1');
    expect(init.headers.get('x-clerk-user-email')).toBe('ada@example.com');
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: 'app_1', status: 'PENDING' });
  });

  it('forwards the apply body without any client-asserted NPI — the subject comes from the session', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      sessionClaims: { email: 'ada@example.com' },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: 'app_1', status: 'PENDING' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/opportunities/[id]/apply/route');
    await POST(new Request('http://localhost/api/opportunities/opp_1/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi: '1558395522', coverNote: 'Ready to start', purpose: 'application' }),
    }) as never, { params: Promise.resolve({ id: 'opp_1' }) });

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({ coverNote: 'Ready to start', purpose: 'application' });
    expect(init.body).not.toContain('1558395522');
  });

  it('rejects unauthenticated employer application list requests', async () => {
    authMock.mockResolvedValue({ userId: null });

    const { GET } = await import('../app/api/employer/applications/route');
    const response = await GET(new Request('http://localhost/api/employer/applications') as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('preserves hiring automation recommendation fields on employer application list responses', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-9',
      sessionClaims: { email: 'verifier@example.com' },
    });
    const payload = [{
      id: 'app_1',
      status: 'PENDING',
      latestRecommendation: {
        actionType: 'READY_TO_INTERVIEW',
        label: 'Move to interview',
        confidence: 0.92,
        explanation: 'Ready for next step.',
        autoGenerated: true,
        createdAt: '2026-03-19T12:00:00.000Z',
        workflowEffects: {
          queueDestination: 'interview_queue',
          missingCredentials: [],
          employerNotification: true,
          clinicianRequest: false,
          webhookEligible: true,
          webhookQueued: true,
        },
        previewDecision: {
          actionType: 'ACCEPT_RECOMMENDED',
          label: 'Recommend acceptance',
          confidence: 0.88,
        },
      },
      timeline: [
        {
          stage: 'applied',
          occurredAt: '2026-03-18T12:00:00.000Z',
          description: 'Application submitted.',
        },
        {
          stage: 'verified',
          occurredAt: '2026-03-19T12:00:00.000Z',
          description: 'Ready for employer review.',
        },
      ],
      systemBehavesAutonomously: true,
    }];
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify(payload),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/employer/applications/route');
    const response = await GET(new Request('http://localhost/api/employer/applications') as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/employer/applications',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get('x-clerk-user-id')).toBe('clerk-user-9');
    expect(init.headers.get('x-clerk-user-email')).toBe('verifier@example.com');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
  });

  // The 'injects org context and server api key for hiring accept' case lived
  // here. It proved the proxy ignored a forged employerId in the body and
  // substituted the authenticated org instead. Both the proxy and the backend
  // route it fronted are closed (VCD-01e): the route recorded an acceptance
  // with no record of what was accepted, and its only caller was an archived,
  // unroutable screen. Employer acceptance goes through
  // /api/employer-review/[entityId]/[action].
  it('exposes no proxy for the closed hiring accept route', async () => {
    await expect(import('../app/api/hiring/accept/route')).rejects.toThrow();
  });
});
