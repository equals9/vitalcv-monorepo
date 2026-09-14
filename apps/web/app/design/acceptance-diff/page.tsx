/**
 * /design/acceptance-diff — Acceptance re-share diff (design reference, W6)
 *
 * "What changed since you accepted" — the acceptance-compounding surface. When
 * a clinician re-shares to an employer that already accepted, the reviewer sees
 * the delta, not the whole packet: refreshed / new / stale, and — loudest —
 * whether anything was revoked.
 *
 * Design Handoff References:
 *   docs/design/ui-ux-inspiration-repository-2026-07-17.md  (E5, E6)
 *   docs/design/evidence-surface-fieldguide.html            (re-share diff spec)
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AcceptanceDiff } from '@/design-system/components';
import type { AcceptanceSourceCheck } from '@/lib/acceptance/acceptanceDiff';

export const metadata: Metadata = {
  title: 'Acceptance re-share diff — design reference',
  description:
    'What changed since an employer accepted: refreshed, new, stale, and revoked source checks — the acceptance-compounding delta.',
  robots: { index: false, follow: false },
};

const ACCEPTED_AT = '2026-04-02T00:00:00Z';

// The snapshot captured when the employer accepted.
const ACCEPTED: AcceptanceSourceCheck[] = [
  { sourceId: 'NPPES', label: 'NPPES identity', state: 'checked', checkedAt: '2026-03-30T00:00:00Z' },
  { sourceId: 'OIG', label: 'OIG / LEIE exclusions', state: 'checked', checkedAt: '2026-03-30T00:00:00Z' },
  { sourceId: 'DEA', label: 'DEA registration', state: 'stale', checkedAt: '2026-01-10T00:00:00Z' },
  { sourceId: 'TX_LICENSE', label: 'State medical license · TX', state: 'stale', checkedAt: '2026-01-05T00:00:00Z' },
];

// The current snapshot when the packet is re-shared.
const CURRENT_CLEAN: AcceptanceSourceCheck[] = [
  { sourceId: 'NPPES', label: 'NPPES identity', state: 'checked', checkedAt: '2026-03-30T00:00:00Z' },
  { sourceId: 'OIG', label: 'OIG / LEIE exclusions', state: 'checked', checkedAt: '2026-03-30T00:00:00Z' },
  { sourceId: 'DEA', label: 'DEA registration', state: 'checked', checkedAt: '2026-07-11T00:00:00Z' }, // refreshed
  { sourceId: 'TX_LICENSE', label: 'State medical license · TX', state: 'checked', checkedAt: '2026-07-09T00:00:00Z' }, // refreshed
  { sourceId: 'ABMS', label: 'Board certification · Cardiology', state: 'checked', checkedAt: '2026-06-28T00:00:00Z' }, // new
];

// A current snapshot where a credential was revoked since acceptance.
const CURRENT_REVOKED: AcceptanceSourceCheck[] = [
  { sourceId: 'NPPES', label: 'NPPES identity', state: 'checked', checkedAt: '2026-03-30T00:00:00Z' },
  { sourceId: 'OIG', label: 'OIG / LEIE exclusions', state: 'checked', checkedAt: '2026-03-30T00:00:00Z' },
  { sourceId: 'DEA', label: 'DEA registration', state: 'checked', checkedAt: '2026-07-11T00:00:00Z' },
  { sourceId: 'TX_LICENSE', label: 'State medical license · TX', state: 'revoked', checkedAt: '2026-06-30T00:00:00Z' }, // revoked!
];

// A current snapshot where a check the employer relied on can no longer be read.
// Not a revocation — but no longer decision-grade, so the reassurance must not hold.
const CURRENT_DEGRADED: AcceptanceSourceCheck[] = [
  { sourceId: 'NPPES', label: 'NPPES identity', state: 'checked', checkedAt: '2026-03-30T00:00:00Z' },
  { sourceId: 'OIG', label: 'OIG / LEIE exclusions', state: 'unavailable', checkedAt: '2026-03-30T00:00:00Z' }, // lost support
  { sourceId: 'DEA', label: 'DEA registration', state: 'checked', checkedAt: '2026-07-11T00:00:00Z' },
  { sourceId: 'TX_LICENSE', label: 'State medical license · TX', state: 'checked', checkedAt: '2026-07-09T00:00:00Z' },
];

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section style={{ borderTop: '1px solid var(--vt-border)', paddingTop: 28, marginTop: 40 }}>
      <div
        style={{
          fontFamily: 'var(--vt-font-mono, ui-monospace, monospace)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: 'var(--vt-text-muted, var(--vt-text-secondary))',
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <h2 style={{ margin: '0 0 18px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h2>
      {children}
    </section>
  );
}

export default function AcceptanceDiffDesignReferencePage() {
  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '56px 24px 96px', color: 'var(--vt-text-primary)' }}>
      <p
        style={{
          fontFamily: 'var(--vt-font-mono, ui-monospace, monospace)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          color: 'var(--vt-accent, var(--vt-text-secondary))',
          margin: '0 0 16px',
        }}
      >
        Design system · W6
      </p>
      <h1 style={{ margin: '0 0 14px', fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        Acceptance that compounds
      </h1>
      <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--vt-text-secondary)', maxWidth: '60ch', margin: 0 }}>
        Once an employer accepts a packet, re-review should never start over. This shows only the{' '}
        <strong style={{ color: 'var(--vt-text-primary)' }}>delta since acceptance</strong> — and leads with the line
        that decides everything: was anything <em>revoked</em>.
      </p>

      <Section eyebrow="E5" title="Nothing revoked — the re-review shrinks to three lines">
        <AcceptanceDiff acceptedAt={ACCEPTED_AT} accepted={ACCEPTED} current={CURRENT_CLEAN} />
      </Section>

      <Section eyebrow="E5 · fail-closed" title="Something was revoked — it stops the re-use">
        <AcceptanceDiff acceptedAt={ACCEPTED_AT} accepted={ACCEPTED} current={CURRENT_REVOKED} />
      </Section>

      <Section eyebrow="E5 · fail-closed" title="A check it relied on can no longer be read — it pauses the re-use">
        <AcceptanceDiff acceptedAt={ACCEPTED_AT} accepted={ACCEPTED} current={CURRENT_DEGRADED} />
      </Section>

      <Section eyebrow="E6" title="No changes — the packet you accepted still holds">
        <AcceptanceDiff acceptedAt={ACCEPTED_AT} accepted={ACCEPTED} current={ACCEPTED} />
      </Section>
    </main>
  );
}
