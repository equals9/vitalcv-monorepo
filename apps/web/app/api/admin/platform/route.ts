/**
 * GET /api/admin/platform — Deployment Integrity report (ADMIN only).
 * Powers the Founder Dashboard (/admin/platform) and any external monitor.
 * Detect-only; never mutates infrastructure.
 */
import { NextResponse } from 'next/server';
import { platformAdminRouteDenial } from '@/lib/auth/platformAdmin';
import { buildIntegrityReport } from '@/lib/platform/deployment-integrity';

export const dynamic = 'force-dynamic';

export async function GET() {
  // W0-07: admitted on the DATABASE role, never the session-token claim.
  const denied = await platformAdminRouteDenial();
  if (denied) {
    return denied;
  }

  const report = await buildIntegrityReport({ railwayToken: process.env.RAILWAY_API_TOKEN });
  return NextResponse.json(report, { status: 200 });
}
