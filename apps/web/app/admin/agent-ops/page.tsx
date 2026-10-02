/**
 * /admin/agent-ops — Agent Ops (Wave L0).
 *
 * ADMIN-gated, server-rendered read over the Start Agent's decision ledger,
 * then the client view refreshes. Detect-only — it never writes telemetry,
 * never enrols a subject, and never mutates a schedule.
 *
 * Auth mirrors /admin/platform exactly.
 */
import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/platformAdmin';
import { buildAgentOpsReport } from '@/lib/agent/ops/agent-ops-report';
import AgentOpsClient from '@/components/agent-ops/AgentOpsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Agent Ops',
  description: 'Start Agent decision ledger — what it decided, what humans did instead, what it refused.',
};

export default async function AgentOpsPage() {
  // W0-07: admitted on the DATABASE role, never the session-token claim.
  await requirePlatformAdminPage('/admin/agent-ops');

  const report = await buildAgentOpsReport();

  return (
    <div className="mz mz-paper mz-persona-admin min-h-screen">
      <AgentOpsClient initialReport={report} />
    </div>
  );
}
