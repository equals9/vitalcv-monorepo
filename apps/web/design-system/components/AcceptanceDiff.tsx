import * as React from 'react';
import { cn } from '@/lib/utils';
import { ProvenanceChip, type ProvenanceState } from './ProvenanceChip';
import {
  diffAcceptanceSnapshot,
  summarizeAcceptanceDiff,
  type AcceptanceSourceCheck,
  type AcceptanceChange,
  type AcceptanceChangeKind,
} from '@/lib/acceptance/acceptanceDiff';

/**
 * AcceptanceDiff (W6) — "what changed since you accepted".
 *
 * When a clinician re-shares to an employer that already accepted, this leads
 * with the DELTA, not the whole packet — the acceptance-compounding surface.
 * It leads with the reassurance that matters most (nothing revoked), or fails
 * closed loudly when something was. Each change carries the canonical
 * ProvenanceChip for its current state. Pure / SSR-safe.
 */

export interface AcceptanceDiffProps {
  /** ISO instant the employer accepted (shown, and the diff baseline). */
  acceptedAt: string;
  /** Source-coverage snapshot captured at acceptance. */
  accepted: ReadonlyArray<AcceptanceSourceCheck>;
  /** The current source-coverage snapshot. */
  current: ReadonlyArray<AcceptanceSourceCheck>;
  className?: string;
}

const KIND_META: Record<
  AcceptanceChangeKind,
  { glyph: string; label: string; color: string }
> = {
  refreshed: { glyph: '↻', label: 'Refreshed', color: 'var(--vt-state-source-confirmed)' },
  added: { glyph: '+', label: 'New', color: 'var(--vt-state-source-confirmed)' },
  stale: { glyph: '○', label: 'Now stale', color: 'var(--vt-state-pending)' },
  // Not red: `revoked` owns red. Lost support is serious but is not a revocation.
  degraded: { glyph: '!', label: 'No longer confirmed', color: 'var(--vt-severity-high)' },
  changed: { glyph: '~', label: 'Status changed', color: 'var(--vt-text-muted)' },
  revoked: { glyph: '✗', label: 'Revoked', color: 'var(--vt-severity-critical)' },
  removed: { glyph: '−', label: 'Withdrawn', color: 'var(--vt-text-muted)' },
};

type Posture = 'revoked' | 'degraded' | 'clean';

const POSTURE_META: Record<Posture, { glyph: string; color: string; tint: string }> = {
  revoked: { glyph: '✗', color: 'var(--vt-severity-critical)', tint: '12%' },
  degraded: { glyph: '!', color: 'var(--vt-severity-high)', tint: '12%' },
  clean: { glyph: '✓', color: 'var(--vt-state-source-confirmed)', tint: '8%' },
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function chipState(change: AcceptanceChange): ProvenanceState | null {
  const to = change.to ?? change.from;
  if (!to) return null;
  // `to` is a canonical coverage state or 'revoked' — both valid ProvenanceStates.
  return to as ProvenanceState;
}

function ChangeRow({ change }: { change: AcceptanceChange }) {
  const meta = KIND_META[change.kind];
  const state = chipState(change);
  return (
    <li
      data-change-kind={change.kind}
      className="flex items-center justify-between gap-3 border-t border-[var(--vt-border)] py-2.5 first:border-t-0"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[12px]"
          style={{ color: meta.color, background: `color-mix(in oklab, ${meta.color} 12%, transparent)` }}
        >
          {meta.glyph}
        </span>
        <span className="min-w-0">
          <span className="text-[13px] font-medium text-[var(--vt-text-primary)]">{change.label}</span>
          <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </span>
      </span>
      {state && change.kind !== 'removed' && (
        <ProvenanceChip
          state={state}
          attribution={{
            // The row already carries the human label; the provenance line
            // carries the machine source id, which is what identifies WHICH
            // check moved. `checkedAt` is optional upstream — `null` renders
            // the words rather than silently dropping the as-of.
            source: change.sourceId,
            asOf: change.checkedAt ?? null,
          }}
          size="sm"
        />
      )}
    </li>
  );
}

function fmtDate(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1] : iso;
}

export function AcceptanceDiff({ acceptedAt, accepted, current, className }: AcceptanceDiffProps) {
  const diff = diffAcceptanceSnapshot(accepted, current);
  const summary = summarizeAcceptanceDiff(diff);
  const acceptedDate = fmtDate(acceptedAt);

  // Order: revoked first (loudest), then lost support, then refreshed/new, then stale, then the rest.
  const order: AcceptanceChangeKind[] = ['revoked', 'degraded', 'refreshed', 'added', 'stale', 'changed', 'removed'];
  const changes = [...diff.changes].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );

  // The banner answers "can I rely on this now?" — CURRENT state, not transitions.
  // A source revoked at acceptance and still revoked has no transition but must not read clean.
  const posture: Posture = diff.currentlyRevoked > 0 ? 'revoked' : diff.counts.degraded > 0 ? 'degraded' : 'clean';
  const banner = POSTURE_META[posture];
  const bannerText =
    posture === 'revoked'
      ? diff.counts.revoked === diff.currentlyRevoked
        ? `${plural(diff.currentlyRevoked, 'credential')} revoked since your acceptance — review before relying on this.`
        : `${plural(diff.currentlyRevoked, 'credential')} revoked — review before relying on this.`
      : posture === 'degraded'
        ? `${plural(diff.counts.degraded, 'check')} no longer confirmed at the source since your acceptance on ${acceptedDate} — re-check before relying on this.`
        : `Nothing revoked since your acceptance on ${acceptedDate}.`;

  return (
    <div
      data-acceptance-diff={posture}
      className={cn('overflow-hidden rounded-[14px] border border-[var(--vt-border)] bg-[var(--vt-surface,transparent)]', className)}
    >
      <div className="flex flex-col gap-1 px-4 pb-3 pt-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-[14px] font-semibold text-[var(--vt-text-primary)]">
            What changed since you accepted
          </span>
          <span className="font-mono text-[11px] tabular-nums text-[var(--vt-text-muted)]">
            accepted {acceptedDate}
          </span>
        </div>
        <span className="font-mono text-[11.5px] tabular-nums text-[var(--vt-text-secondary)]">{summary}</span>
      </div>

      {/* The line that decides the re-review: clean → compounding; lost support or revocation → fail closed. */}
      <div
        className="flex items-center gap-2 px-4 py-2 text-[12.5px]"
        style={{
          background: `color-mix(in oklab, ${banner.color} ${banner.tint}, transparent)`,
          color: banner.color,
        }}
      >
        <span aria-hidden="true" className="font-mono">{banner.glyph}</span>
        {bannerText}
      </div>

      {changes.length > 0 ? (
        <ul className="m-0 list-none px-4 py-1">
          {changes.map((change) => (
            <ChangeRow key={`${change.sourceId}-${change.kind}`} change={change} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-[12.5px] text-[var(--vt-text-secondary)]">
          {posture === 'clean'
            ? 'Nothing has changed since your acceptance — the packet you accepted still holds.'
            : 'Nothing has changed since your acceptance.'}
        </p>
      )}

      {diff.unchanged > 0 && (
        <p className="border-t border-[var(--vt-border)] px-4 py-2.5 font-mono text-[11px] text-[var(--vt-text-muted)]">
          {diff.unchanged} item{diff.unchanged === 1 ? '' : 's'} unchanged since acceptance
        </p>
      )}
    </div>
  );
}
