/**
 * /api/graph/network — Wave 247: Global network graph proxy
 */

import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as API_BASE } from '@/lib/backend-url';

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get('limit') ?? '200';
  try {
    const res = await fetch(`${API_BASE}/api/graph/network?limit=${limit}`, {
      // Revalidate every 5 minutes — matches server-side cache
      next: { revalidate: 300 },
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch network graph' }, { status: 502 });
  }
}
