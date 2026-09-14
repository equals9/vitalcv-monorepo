/**
 * Acceptance re-share diff (W6) — "what changed since you accepted".
 *
 * When a clinician re-shares a packet to an employer who already accepted it,
 * the reviewer should see the DELTA, not the whole packet again. This is the
 * acceptance-compounding primitive: it shrinks every re-review to a few honest
 * lines ("2 checks refreshed, 1 new license, nothing revoked since <date>").
 *
 * Pure + deterministic (compares ISO `checkedAt` strings; no Date.now()), so it
 * is fully testable and reusable by the employer-review backend (ACT-1.2) — it
 * diffs the accept-time source-coverage snapshot against the current one.
 *
 * The `accepted` side is persisted at accept time by the backend accept route
 * as `EmployerAcceptance.metadata.acceptedSourceSnapshot.checks` (schema
 * `vitalcv.employer-acceptance.metadata.v1`, built in
 * apps/api/backend/src/services/entity/acceptanceSourceSnapshot.ts) — each
 * check already matches AcceptanceSourceCheck.
 *
 * Two questions, answered separately. A diff reports TRANSITIONS since
 * acceptance; the reassurance a reviewer acts on is about CURRENT state. They
 * diverge exactly where it matters: a source already revoked at acceptance has
 * no transition, and a source that fell from 'checked' to 'unavailable' has no
 * revocation. Both used to count as "unchanged" under a green "nothing revoked"
 * line. `currentlyRevoked` answers the current-state question; `degraded`
 * reports lost decision-grade support; `unchanged` means identical, nothing less.
 */

import type { CanonicalSourceCoverageState } from '@vitalcv/trust-state';

/** The source-coverage states the diff reasons over (canonical + revoked). */
export type AcceptanceCheckState = CanonicalSourceCoverageState | 'revoked';

export interface AcceptanceSourceCheck {
  sourceId: string;
  /** Human label for display, e.g. "State medical license · TX". */
  label: string;
  state: AcceptanceCheckState;
  /** ISO instant of the last check; null when never checked. */
  checkedAt?: string | null;
}

export type AcceptanceChangeKind =
  | 'refreshed' // improved to checked, or re-verified more recently
  | 'added' //     new source not present at acceptance
  | 'revoked' //   withdrawn since acceptance — the one that stops everything
  | 'degraded' //  was checked at acceptance, now not decision-grade (unavailable,
  //               accessRequired, notFound, gated, pending, …) — support the
  //               acceptance relied on no longer exists
  | 'stale' //     was checked at acceptance, now aged out
  | 'changed' //   any other difference in state or check time
  | 'removed'; //  present at acceptance, absent now

export interface AcceptanceChange {
  sourceId: string;
  label: string;
  kind: AcceptanceChangeKind;
  from?: AcceptanceCheckState;
  to?: AcceptanceCheckState;
  checkedAt?: string | null;
}

export interface AcceptanceDiffResult {
  changes: AcceptanceChange[];
  /** Sources whose state and check time are identical to acceptance. */
  unchanged: number;
  counts: Record<AcceptanceChangeKind, number>;
  /**
   * Current sources in the revoked state, whether revoked since acceptance or
   * already revoked when accepted. A transition count cannot answer this.
   */
  currentlyRevoked: number;
  /**
   * The reassurance: true only when no current source is revoked. Reflects
   * current state, not transitions — a source revoked at acceptance and still
   * revoked must not read as "nothing revoked".
   */
  nothingRevoked: boolean;
  /** True when there is any delta at all. */
  hasChanges: boolean;
}

const DECISION_GRADE: AcceptanceCheckState = 'checked';

/**
 * Diff the accept-time snapshot against the current one. Both are lists of
 * per-source checks keyed by `sourceId`.
 */
export function diffAcceptanceSnapshot(
  accepted: ReadonlyArray<AcceptanceSourceCheck>,
  current: ReadonlyArray<AcceptanceSourceCheck>,
): AcceptanceDiffResult {
  const acceptedById = new Map(accepted.map((c) => [c.sourceId, c]));
  const currentById = new Map(current.map((c) => [c.sourceId, c]));

  const changes: AcceptanceChange[] = [];
  let unchanged = 0;

  for (const cur of current) {
    const prev = acceptedById.get(cur.sourceId);
    if (!prev) {
      changes.push({ sourceId: cur.sourceId, label: cur.label, kind: 'added', to: cur.state, checkedAt: cur.checkedAt });
      continue;
    }
    const change = (kind: AcceptanceChangeKind) =>
      changes.push({ sourceId: cur.sourceId, label: cur.label, kind, from: prev.state, to: cur.state, checkedAt: cur.checkedAt });

    // Revoked outranks everything — a withdrawal since acceptance.
    if (cur.state === 'revoked' && prev.state !== 'revoked') {
      change('revoked');
      continue;
    }
    const improved = prev.state !== DECISION_GRADE && cur.state === DECISION_GRADE;
    const reverified =
      prev.state === DECISION_GRADE &&
      cur.state === DECISION_GRADE &&
      !!cur.checkedAt &&
      !!prev.checkedAt &&
      cur.checkedAt > prev.checkedAt;
    if (improved || reverified) {
      change('refreshed');
      continue;
    }
    if (prev.state === DECISION_GRADE && cur.state === 'stale') {
      change('stale');
      continue;
    }
    if (prev.state === DECISION_GRADE && cur.state !== DECISION_GRADE) {
      change('degraded');
      continue;
    }
    if (prev.state === cur.state && (prev.checkedAt ?? null) === (cur.checkedAt ?? null)) {
      unchanged += 1;
      continue;
    }
    change('changed');
  }

  for (const prev of accepted) {
    if (!currentById.has(prev.sourceId)) {
      changes.push({ sourceId: prev.sourceId, label: prev.label, kind: 'removed', from: prev.state });
    }
  }

  const counts: Record<AcceptanceChangeKind, number> = {
    refreshed: 0,
    added: 0,
    revoked: 0,
    degraded: 0,
    stale: 0,
    changed: 0,
    removed: 0,
  };
  for (const c of changes) counts[c.kind] += 1;

  const currentlyRevoked = current.filter((c) => c.state === 'revoked').length;

  return {
    changes,
    unchanged,
    counts,
    currentlyRevoked,
    nothingRevoked: currentlyRevoked === 0,
    hasChanges: changes.length > 0,
  };
}

/** A short, honest headline for the diff, e.g.
 *  "2 refreshed · 1 new · nothing revoked" (or "1 revoked — review"). */
export function summarizeAcceptanceDiff(diff: AcceptanceDiffResult): string {
  const revokedPart = diff.currentlyRevoked ? `${diff.currentlyRevoked} revoked — review` : 'nothing revoked';
  if (!diff.hasChanges) {
    return diff.currentlyRevoked
      ? `No changes since your acceptance · ${revokedPart}`
      : 'No changes since your acceptance';
  }
  const parts: string[] = [];
  if (diff.counts.refreshed) parts.push(`${diff.counts.refreshed} refreshed`);
  if (diff.counts.added) parts.push(`${diff.counts.added} new`);
  if (diff.counts.degraded) parts.push(`${diff.counts.degraded} no longer confirmed`);
  if (diff.counts.stale) parts.push(`${diff.counts.stale} now stale`);
  if (diff.counts.changed) parts.push(`${diff.counts.changed} status changed`);
  if (diff.counts.removed) parts.push(`${diff.counts.removed} withdrawn from packet`);
  parts.push(revokedPart);
  return parts.join(' · ');
}
