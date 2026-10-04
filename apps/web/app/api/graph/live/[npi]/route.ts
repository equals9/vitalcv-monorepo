/**
 * /api/graph/live/[npi] — Wave 247: Live clinician trust graph proxy
 */

import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as API_BASE } from '@/lib/backend-url';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;
  try {
    const res = await fetch(`${API_BASE}/api/graph/live/${npi}`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch live graph' }, { status: 502 });
  }
}
