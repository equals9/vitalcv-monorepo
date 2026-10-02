/**
 * /api/graph/node/[nodeId]/expand — Wave 247: Expand a node's neighborhood
 */

import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as API_BASE } from '@/lib/backend-url';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  const { nodeId: rawId } = await params;
  const nodeId = decodeURIComponent(rawId);
  const encoded = encodeURIComponent(nodeId);
  try {
    const res = await fetch(`${API_BASE}/api/graph/node/${encoded}/expand`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to expand node' }, { status: 502 });
  }
}
