/**
 * Next.js proxy for /api/graph-engine/* → backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as BACKEND } from '@/lib/backend-url';

async function proxy(req: NextRequest, path: string) {
  const url = `${BACKEND}/api/graph/${path}${req.nextUrl.search}`;

  try {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    let body: string | undefined;

    if (req.method === 'POST' || req.method === 'PUT') {
      headers['Content-Type'] = 'application/json';
      body = await req.text();
    }

    const resp = await fetch(url, { method: req.method, headers, body });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    return NextResponse.json({ error: 'Graph API proxy error', detail: String(err) }, { status: 502 });
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path.join('/'));
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path.join('/'));
}
