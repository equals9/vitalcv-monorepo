/**
 * GET /api/admin/agent-ops — Start Agent decision-ledger report (ADMIN only).
 * Powers /admin/agent-ops and any external monitor. Read-only.
 */
import { NextResponse } from 'next/server';
import { platformAdminRouteDenial } from '@/lib/auth/platformAdmin';
import { buildAgentOpsReport } from '@/lib/agent/ops/agent-ops-report';

export const dynamic = 'force-dynamic';

export async function GET() {
  // W0-07: admitted on the DATABASE role, never the session-token claim.
  const denied = await platformAdminRouteDenial();
  if (denied) {
    return denied;
  }

  const report = await buildAgentOpsReport();
  return NextResponse.json(report, { status: 200 });
}
