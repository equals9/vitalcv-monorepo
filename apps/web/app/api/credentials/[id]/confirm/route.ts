/**
 * PATCH /api/credentials/[id]/confirm
 *
 * Wave 238: Proxy to backend — confirms a CandidateCredential with optional field corrections.
 * Body: { corrections: Record<string, string> }
 */

import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';
import { BACKEND_URL } from '@/lib/backend-url';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (session.userId) {
    await applyIdentityHeaders(headers, { userId: session.userId });
  }

  const body = await req.text();

  const res = await fetch(`${BACKEND_URL}/api/credentials/${encodeURIComponent(id)}/confirm`, {
    method: 'PATCH',
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}
