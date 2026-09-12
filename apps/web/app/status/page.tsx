/**
 * /status — the customer-facing status summary (audit 5.2).
 *
 * Honest by construction: every row is either a REAL per-request check (web
 * version payload, backend /health probe) or the register's lane lifecycle
 * (availability of the lane, labelled as such — never per-moment uptime we
 * don't measure). No uptime percentages, no fabricated "Operational" badges.
 * The operator console moved to /status/technical.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, ArrowRight, FileCode2, ShieldCheck } from 'lucide-react';

import { BACKEND_URL } from '@/lib/backend-url';
import { getVersionInfo } from '@/lib/deployInfo';
import { getTrustRegisterSnapshot } from '@/lib/trust/register';
import { toSourceLaneStatusEntries } from '@/lib/trust/laneAvailability';
import { PageFrame } from '@/components/layout/PageFrame';
import { SourceLaneStatus } from '@/components/trust/SourceLaneStatus';
import { SourceLaneStatusBoundary } from '@/components/trust/SourceLaneStatusBoundary';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Status',
  description:
    'Plain-language status for the VitalCV web application, API, and the public data sources it reads. No uptime figures are claimed until they are measured.',
};

type RowTone = 'ok' | 'warn' | 'muted';

function toneColor(tone: RowTone): string {
  if (tone === 'ok') return 'var(--vt-state-source-confirmed)';
  // `--vt-state-stale` is unset in this theme, so this always painted the
  // fallback #a2670b — measured 4.49:1 on the cream surface, just under the AA
  // floor. `--vt-badge-warning-text` is defined and measures 4.99:1. Same
  // correction as `lib/trust/laneAvailability.ts`, which records the readings.
  if (tone === 'warn') return 'var(--vt-badge-warning-text, #a2670b)';
  return 'var(--vt-text-muted)';
}

// The lifecycle → availability copy this page used to declare here now lives in
// `lib/trust/laneAvailability.ts` and is rendered by `SourceLaneStatus`, shared
// with /trust. The two copies had already drifted apart in wording.

async function probeBackend(): Promise<{ label: string; tone: RowTone }> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    });
    return res.ok
      ? { label: 'Responding', tone: 'ok' }
      : { label: `Error ${res.status}`, tone: 'warn' };
  } catch {
    return { label: 'Not responding right now', tone: 'warn' };
  }
}

/**
 * Application-service row — a REAL per-request check (this render, this probe).
 *
 * Source lanes are NOT rendered here: they are a different claim (a lane's
 * availability, not a live check) and they carry the W0.5 `data-lane-*` parity
 * contract, so they go through `SourceLaneStatus`.
 */
function StatusRow({
  name,
  note,
  state,
  tone,
}: {
  name: string;
  note: string;
  state: string;
  tone: RowTone;
}) {
  const color = toneColor(tone);
  return (
    // Stacks under 640px, matching the source rows below. Side-by-side at 375px
    // squeezed "Health probe from this page load" into five one-word lines —
    // a pre-existing defect, but one made conspicuous by rows that now stack.
    <div className="flex flex-col items-start gap-2 px-5 py-4 sm:flex-row sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[var(--vt-text-primary)]">{name}</p>
        <p className="mt-0.5 text-[13px] text-[var(--vt-text-secondary)]">{note}</p>
      </div>
      <span
        className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.08em]"
        style={{ color, borderColor: `color-mix(in oklab, ${color} 38%, transparent)` }}
      >
        <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        {state}
      </span>
    </div>
  );
}

export default async function StatusPage() {
  const version = getVersionInfo();
  const [backend, snapshot] = await Promise.all([probeBackend(), getTrustRegisterSnapshot()]);
  const laneEntries = toSourceLaneStatusEntries(snapshot.sources);
  const checkedAt = new Date();
  const checkedLabel = `${checkedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`;

  return (
    <main className="mz mz-paper min-h-screen">
      <PageFrame mode="marketing" className="max-w-4xl">
        <p className="mz-eyebrow">Status</p>
        <h1 className="mz-display" style={{ marginTop: 14, maxWidth: 720 }}>
          Is VitalCV up?
        </h1>
        <p className="mz-lede" style={{ marginTop: 16, maxWidth: 620 }}>
          A plain-language summary, checked when you loaded this page. Source rows describe whether a lane is
          connected — VitalCV does not publish uptime figures it has not measured.
        </p>

        {/* Application services — REAL per-request checks */}
        <section aria-label="Application status" className="mt-12">
          <p className="mz-eyebrow">Application</p>
          <div className="mt-4 divide-y divide-[var(--vt-border-subtle,var(--vt-border))] overflow-hidden rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface)]">
            <StatusRow
              name="Web application"
              note={`Serving this page · build ${version.commitShort ?? 'unknown'}`}
              state="Serving"
              tone="ok"
            />
            <StatusRow
              name="API"
              note="Health probe from this page load"
              state={backend.label}
              tone={backend.tone}
            />
          </div>
        </section>

        {/* Source lanes — register lifecycle, availability language. Shared with
            /trust via SourceLaneStatus so the two cannot word the same state
            differently, and carrying the W0.5 data-lane-* parity contract. */}
        <section className="mt-10">
          <p className="mz-eyebrow">Public data sources</p>
          <SourceLaneStatusBoundary lanes={laneEntries} ariaLabel="Source availability" className="mt-4">
            <SourceLaneStatus
              axis="availability"
              lanes={laneEntries}
              ariaLabel="Source availability"
              className="mt-4"
              footnote={
                <>
                  Availability describes the lane, not any one record —{' '}
                  <Link href="/trust" className="font-medium text-[var(--vt-text-secondary)] underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
                    what each state means
                  </Link>
                  .
                </>
              }
            />
          </SourceLaneStatusBoundary>
        </section>

        {/* Incidents — honest empty state */}
        <section aria-label="Incidents" className="mt-10">
          <p className="mz-eyebrow">Incidents</p>
          <div className="mt-4 rounded-[12px] border border-dashed border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-5 py-5">
            <p className="text-[14px] text-[var(--vt-text-secondary)]">
              No public incident feed is published yet. When an incident affects the product, it will be reported
              here with what happened and what changed.
            </p>
          </div>
        </section>

        <p className="mt-8 text-[12px] text-[var(--vt-text-muted)]">
          Checked <time dateTime={checkedAt.toISOString()} className="font-mono">{checkedLabel}</time> · re-checked on
          every page load.
        </p>

        {/* Links out */}
        <section aria-label="More detail" className="mt-10">
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/status/technical" className="group flex items-center justify-between rounded-[10px] border border-[var(--vt-border)] px-4 py-3.5 transition-colors hover:border-[var(--vt-text-primary)]">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--vt-text-primary)]">
                <FileCode2 size={15} aria-hidden="true" /> Technical status
              </span>
              <ArrowRight size={14} aria-hidden="true" className="text-[var(--vt-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/trust" className="group flex items-center justify-between rounded-[10px] border border-[var(--vt-border)] px-4 py-3.5 transition-colors hover:border-[var(--vt-text-primary)]">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--vt-text-primary)]">
                <ShieldCheck size={15} aria-hidden="true" /> Trust Center
              </span>
              <ArrowRight size={14} aria-hidden="true" className="text-[var(--vt-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="/api/version" className="group flex items-center justify-between rounded-[10px] border border-[var(--vt-border)] px-4 py-3.5 transition-colors hover:border-[var(--vt-text-primary)]">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--vt-text-primary)]">
                <Activity size={15} aria-hidden="true" /> Version payload
              </span>
              <ArrowRight size={14} aria-hidden="true" className="text-[var(--vt-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </section>
      </PageFrame>
    </main>
  );
}
