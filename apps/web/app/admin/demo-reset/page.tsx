import * as React from 'react';
import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/platformAdmin';

import { buildDemoResetFoundationPlan } from '@/lib/demo/demoResetFoundation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Demo Reset',
  description:
    'Demo reset foundation plan. Non-production. Requires explicit operator confirmation. No destructive database changes.',
};

export default async function AdminDemoResetPage() {
  // W0-07: admitted on the DATABASE role, never the session-token claim.
  await requirePlatformAdminPage('/admin/demo-reset');

  const plan = buildDemoResetFoundationPlan();

  return (
    <main className="mz mz-paper mz-persona-admin min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 sm:mb-10">
          <p className="mz-eyebrow">Admin / demo reset</p>
          <h1 className="mz-h1 mt-3">
            Demo reset <span className="mz-accent">foundation</span>
          </h1>
          <p className="mz-body mt-3 max-w-2xl">
            <strong className="font-semibold text-[var(--vt-text-primary)]">{`Demo reset plans are non-production and require explicit operator confirmation.`}</strong>
            {' '}No reset action runs from this page. Every scope is bounded to demo data;
            real clinician records, real PSV receipts, and real audit-boundary records are
            out of every demo reset scope by construction.
          </p>
        </header>

        <section
          aria-labelledby="scopes-heading"
          className="mz-card mb-6 p-4 sm:p-5"
        >
          <h2 id="scopes-heading" className="mz-h2">
            Reset scopes (foundation only)
          </h2>
          <ul className="mt-3 space-y-3">
            {plan.scopes.map((s) => (
              <li key={s.scope}>
                <p className="font-medium">
                  {s.label}{' '}
                  <span
                    className="mz-chip mz-chip-unknown ml-1"
                    aria-label={`Status: ${s.status}`}
                  >
                    <span className="mz-gl" aria-hidden="true" />
                    {s.status.replace(/_/g, ' ')}
                  </span>
                </p>
                <p className="mz-small mt-1">{s.description}</p>
                <p className="mt-1 text-[11px] text-[var(--vt-text-muted)]">
                  Bounded to demo data · cannot reach production · requires operator confirmation
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="safety-heading"
          className="rounded-[3px] border border-[var(--watch-rule)] bg-[var(--watch-bg)] p-4 sm:p-5"
        >
          <h2 id="safety-heading" className="text-[13.5px] font-semibold">
            Safety contract
          </h2>
          <ul className="mt-2 space-y-1.5 text-[12px] text-[var(--vt-text-secondary)]">
            {plan.disclaimers.map((d, i) => <li key={i}>· {d}</li>)}
          </ul>
          <p className="mt-3 text-[11px] text-[var(--vt-text-secondary)]">
            Implementation note: <code className="mz-mono text-[var(--vt-text-primary)]">productionResetEnabled = false</code> and{' '}
            <code className="mz-mono text-[var(--vt-text-primary)]">destructive = false</code> across the entire plan. No flow ships that
            can change production state from this page.
          </p>
        </section>
      </div>
    </main>
  );
}
