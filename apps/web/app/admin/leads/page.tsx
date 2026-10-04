/**
 * /admin/leads — Wave Q. Minimal internal list of captured commercial leads
 * (PilotLead rows). ADMIN-gated with the same pattern as /admin/platform.
 * Read-only; the durable trail is the paired AuditEvent per lead.
 * Deploy-order safe: renders an honest empty state until the PilotLead
 * migration deploys.
 */
import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/platformAdmin';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Leads',
  description: 'Captured pilot leads — internal.',
};

interface LeadRow {
  id: string;
  source: string;
  persona: string | null;
  organization: string;
  contactName: string | null;
  email: string;
  workflowTarget: string | null;
  sourceContext: string | null;
  slackDelivered: boolean;
  createdAt: Date;
}

export default async function AdminLeadsPage() {
  // W0-07: admitted on the DATABASE role, never the session-token claim.
  await requirePlatformAdminPage('/admin/leads');

  let leads: LeadRow[] = [];
  let tablePending = false;
  try {
    leads = await prisma.pilotLead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        source: true,
        persona: true,
        organization: true,
        contactName: true,
        email: true,
        workflowTarget: true,
        sourceContext: true,
        slackDelivered: true,
        createdAt: true,
      },
    });
  } catch {
    tablePending = true;
  }

  return (
    <main className="mz mz-paper mz-persona-admin min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <p className="mz-eyebrow">Internal</p>
          <h1 className="mz-h1 mt-3">
            Captured <span className="mz-accent">leads</span>
          </h1>
          <p className="mz-body mt-2 max-w-3xl">
            Durable pilot-request and pilot-intake submissions, newest first. Each row has a paired
            audit event; Slack delivery status is operational only.
          </p>
        </header>

        {tablePending ? (
          <p className="mz-inset mz-body p-4">
            The PilotLead table is not deployed yet (migration pending). Leads keep flowing to Slack
            and the server log in the meantime.
          </p>
        ) : leads.length === 0 ? (
          <p className="mz-inset mz-body p-4">
            No captured leads yet.
          </p>
        ) : (
          <div className="mz-card overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-[var(--rule)]">
                  <th className="mz-mono px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">When</th>
                  <th className="mz-mono px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">Source</th>
                  <th className="mz-mono px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">Persona</th>
                  <th className="mz-mono px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">Organization</th>
                  <th className="mz-mono px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">Contact</th>
                  <th className="mz-mono px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">Target</th>
                  <th className="mz-mono px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">Slack</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-[var(--rule-soft)] align-top">
                    <td className="mz-mono whitespace-nowrap px-3 py-2.5 text-[13px] text-[var(--vt-text-secondary)]">
                      {lead.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-3 py-2.5">{lead.source}</td>
                    <td className="px-3 py-2.5">{lead.persona ?? '—'}</td>
                    <td className="px-3 py-2.5 font-medium">{lead.organization}</td>
                    <td className="px-3 py-2.5">
                      {lead.contactName ? `${lead.contactName} · ` : ''}
                      {lead.email}
                    </td>
                    <td className="px-3 py-2.5">{lead.workflowTarget ?? lead.sourceContext ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      {lead.slackDelivered ? (
                        <span className="mz-chip mz-chip-ok">
                          <span className="mz-gl" aria-hidden="true" />
                          delivered
                        </span>
                      ) : (
                        <span className="text-[var(--vt-text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
