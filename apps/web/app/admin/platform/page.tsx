/**
 * /admin/platform — Founder Dashboard.
 *
 * ADMIN-gated, server-rendered initial Deployment Integrity report, then the
 * client view auto-refreshes. Every production service shows green when it
 * agrees with the canonical config (repo / branch / commit / age / health /
 * env); any drift turns a card red. Detect-only — never mutates infrastructure.
 */
import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/platformAdmin';
import { buildIntegrityReport } from '@/lib/platform/deployment-integrity';
import PlatformDashboardClient from '@/components/platform/PlatformDashboardClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Platform',
  description: 'Production deployment integrity — Founder Dashboard.',
};

export default async function PlatformDashboardPage() {
  // W0-07: admitted on the DATABASE role, never the session-token claim.
  await requirePlatformAdminPage('/admin/platform');

  const report = await buildIntegrityReport({ railwayToken: process.env.RAILWAY_API_TOKEN });

  return (
    <div className="mz mz-paper mz-persona-admin min-h-screen">
      <PlatformDashboardClient initialReport={report} />
    </div>
  );
}
