import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as API_BASE } from '@/lib/backend-url';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;
  const qs = req.nextUrl.searchParams.toString();
  const upstream = await fetch(
    `${API_BASE}/api/verify-professional/${npi}${qs ? '?' + qs : ''}`,
  );
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
