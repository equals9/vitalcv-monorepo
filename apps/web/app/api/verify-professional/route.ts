import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as API_BASE } from '@/lib/backend-url';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const upstream = await fetch(`${API_BASE}/api/verify-professional`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
