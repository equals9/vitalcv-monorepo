/**
 * GET /api/credentials/mine
 *
 * Wave 238: Proxy to backend — lists CandidateCredential records for the current user.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';
import { BACKEND_URL } from '@/lib/backend-url';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  const headers = new Headers();
  if (session.userId) {
    await applyIdentityHeaders(headers, { userId: session.userId });
  }

  const res = await fetch(`${BACKEND_URL}/api/credentials/mine`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}
