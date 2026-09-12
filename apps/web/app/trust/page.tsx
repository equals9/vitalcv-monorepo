import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, FileCode2, Activity } from 'lucide-react';

import { getTrustRegisterSnapshot } from '@/lib/trust/register';
import { ArtifactStage } from '@/components/motion/ArtifactStage';
import { ReceiptArtifact } from '@/components/artifacts/PageArtifacts';
import { EvidenceProvenanceChip as StateChip } from '@/lib/vital/evidenceStateToProvenance';
import { EVIDENCE_STATE, type EvidenceState } from '@/lib/vital/evidenceState';
import { PageFrame } from '@/components/layout/PageFrame';
import { SourceCoverageDiagram } from '@/components/trust/SourceCoverageDiagram';
import { SourceLaneStatus } from '@/components/trust/SourceLaneStatus';
import { SourceLaneStatusBoundary } from '@/components/trust/SourceLaneStatusBoundary';
import { toSourceLaneStatusEntries } from '@/lib/trust/laneAvailability';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trust Center',
  description:
    'What VitalCV checks, what each evidence state means, what VitalCV does not decide, and the controls you keep over your own career record.',
  robots: { index: true, follow: true },
};

// Honest source-availability, derived from the real register lifecycle — not a
// per-clinician result. "Available" means the lane is wired and returns data;
// it does not mean any specific clinician has been checked. The lifecycle →
// copy projection this page used to declare here now lives in
// `lib/trust/laneAvailability.ts`, shared with /status and with the diagram
// directly above these rows — which read "Not connected" while the rows read
// "Not yet connected" for the same lane, on the same screen.

const STATE_ORDER: EvidenceState[] = [
  'source_backed',
  'checked',
  'self_attested',
  'needs_review',
  'access_required',
  'unavailable',
  'employer_decision',
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-24">
      <p className="mz-eyebrow">{eyebrow}</p>
      <h2 className="mz-h1" style={{ marginTop: 12, maxWidth: 760 }}>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function TrustCenterPage() {
  const snapshot = await getTrustRegisterSnapshot();
  const laneEntries = toSourceLaneStatusEntries(snapshot.sources);

  return (
    <main className="mz mz-paper">
      <PageFrame mode="marketing" className="max-w-5xl">
        {/* Hero */}
        <p className="mz-eyebrow">Trust Center</p>
        <h1 className="mz-display" style={{ marginTop: 14, maxWidth: 820 }}>
          What VitalCV checks — and what it <em className="mz-accent">does not decide.</em>
        </h1>
        <p className="mz-lede" style={{ marginTop: 16, maxWidth: 640 }}>
          VitalCV never asks anyone to take a claim on faith. Every field names its source and shows its state, every
          unknown stays visibly unknown, and the final credentialing decision always belongs to the employer.
        </p>

        {/* The page's animated artifact: the provenance chain itself — a claim,
            its source and read time, the receipt, and the open door at the end.
            Plays once on entry, then rests (CD-11). */}
        <section aria-label="How a claim carries its provenance" className="mt-10">
          <ArtifactStage glass>
            <ReceiptArtifact />
          </ArtifactStage>
        </section>

        {/* 1 — What VitalCV checks + current availability */}
        <Section id="checks" eyebrow="What we check" title="The sources VitalCV reads, and whether they're available today">
          {/* The same lane state the table below prints, drawn. Both read
              SOURCE_LANE_OPS, so the picture cannot disagree with the rows. */}
          <SourceCoverageDiagram />
          <SourceLaneStatusBoundary lanes={laneEntries} ariaLabel="Source availability" className="mt-8">
            <SourceLaneStatus
              axis="availability"
              lanes={laneEntries}
              ariaLabel="Source availability"
              className="mt-8"
              footnote={
                <>
                  Availability describes the lane, not any one clinician — an &ldquo;available&rdquo; source has
                  not checked you until you run it.
                </>
              }
            />
          </SourceLaneStatusBoundary>
        </Section>

        {/* 2 — Meaning of each state */}
        <Section id="states" eyebrow="The grammar" title="What each evidence state means">
          <ul className="space-y-3">
            {STATE_ORDER.map((state) => (
              <li key={state} className="flex flex-col gap-2 rounded-[10px] border border-[var(--vt-border)] px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="shrink-0 sm:w-44">
                  {/* The grammar section illustrates the vocabulary itself —
                      'legend' announces "vocabulary example, not a result
                      about anyone", so it cannot read as a real finding. */}
                  <StateChip state={state} attribution="legend" />
                </div>
                <p className="text-[14px] leading-relaxed text-[var(--vt-text-secondary)]">{EVIDENCE_STATE[state].meaning}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-[var(--vt-text-muted)]">
            A check mark appears only for <strong className="font-semibold text-[var(--vt-text-secondary)]">source-backed</strong> and{' '}
            <strong className="font-semibold text-[var(--vt-text-secondary)]">checked</strong> — never for gated, unavailable, or self-entered evidence.
          </p>
        </Section>

        {/* 3 — What VitalCV does not decide */}
        <Section id="boundary" eyebrow="The boundary" title="What VitalCV does not decide">
          <div className="rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-6 py-6">
            <p className="text-[15px] leading-relaxed text-[var(--vt-text-primary)]">
              VitalCV assembles source-backed evidence. It does not credential, privilege, or clear anyone.
            </p>
            <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-[var(--vt-text-secondary)]">
              <li>• A source-backed identity is not a completed credentialing decision.</li>
              <li>• &ldquo;No match in the current LEIE file&rdquo; is not a guarantee of good standing — the file is published monthly, so a recent exclusion may not be in it yet.</li>
              <li>• Readiness is a picture of what sources return today — not employer approval.</li>
              <li>• The institution&rsquo;s review remains the final step, always.</li>
            </ul>
          </div>
        </Section>

        {/* 4 — Your controls */}
        <Section id="controls" eyebrow="Your record" title="The controls you keep">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { t: 'You own it', d: 'Your profile, source checks, and receipts live in a record you own — not an employer’s filing cabinet. It leaves with you.' },
              { t: 'Sharing is explicit', d: 'Nothing is shared until you share it. A shared proof packet names exactly what the recipient can see.' },
              { t: 'Source records stay attributable', d: 'Source-backed values retain their source and read time. You can add self-attested information to your profile; VitalCV does not silently replace source records.' },
              { t: 'Consent is withdrawable', d: 'Access you grant can be withdrawn; each open and each acceptance is recorded in your activity.' },
            ].map((c) => (
              <div key={c.t} className="rounded-[10px] border border-[var(--vt-border)] px-5 py-4">
                <p className="text-[14px] font-semibold text-[var(--vt-text-primary)]">{c.t}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">{c.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-[var(--vt-text-muted)]">
            These controls live in your{' '}
            <Link href="/holder" className="font-medium text-[var(--vt-text-secondary)] underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
              VitalCV profile
            </Link>{' '}
            once you activate it.
          </p>
        </Section>

        {/* 5 — Security & data practices */}
        <Section id="security" eyebrow="How we handle data" title="Security & data practices">
          <div className="space-y-3 text-[14px] leading-relaxed text-[var(--vt-text-secondary)]">
            <p>
              VitalCV reads public professional identifiers and authoritative source data. It is built around a simple
              rule: no protected health information is placed on any shared or anchored artifact.
            </p>
            <p>
              Receipts are signed with an {snapshot.keyAlgorithm} key; the public key and issuer identity are
              published so a recipient can check a receipt independently. Every mutation to your record is written to an
              audit trail before it takes effect.
            </p>
          </div>
          <p className="mt-4 text-[13px] text-[var(--vt-text-muted)]">
            To report a security issue, email{' '}
            <a href="mailto:security@vitalcv.com" className="font-medium text-[var(--vt-text-secondary)] underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
              security@vitalcv.com
            </a>
            .
          </p>
        </Section>

        {/* 6 — Links out */}
        <Section id="more" eyebrow="Go deeper" title="Status and technical documentation">
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/status" className="group flex items-center justify-between rounded-[10px] border border-[var(--vt-border)] px-4 py-3.5 transition-colors hover:border-[var(--vt-text-primary)]">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--vt-text-primary)]">
                <Activity size={15} aria-hidden="true" /> System status
              </span>
              <ArrowRight size={14} aria-hidden="true" className="text-[var(--vt-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/trust/technical" className="group flex items-center justify-between rounded-[10px] border border-[var(--vt-border)] px-4 py-3.5 transition-colors hover:border-[var(--vt-text-primary)]">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--vt-text-primary)]">
                <FileCode2 size={15} aria-hidden="true" /> Trust register
              </span>
              <ArrowRight size={14} aria-hidden="true" className="text-[var(--vt-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="/.well-known/trust-register" className="group flex items-center justify-between rounded-[10px] border border-[var(--vt-border)] px-4 py-3.5 transition-colors hover:border-[var(--vt-text-primary)]">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--vt-text-primary)]">
                <ShieldCheck size={15} aria-hidden="true" /> Machine register
              </span>
              <ArrowRight size={14} aria-hidden="true" className="text-[var(--vt-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </Section>
      </PageFrame>
    </main>
  );
}
