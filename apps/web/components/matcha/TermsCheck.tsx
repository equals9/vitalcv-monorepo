'use client';

/**
 * The clinician's own terms, checked against one role record — one component, two skins.
 *
 * Used on the signed-in Roles list (`mz` skin) and the Discover deck (`mdk` skin) so the
 * two surfaces cannot drift on what met / not met / unknown mean. The data attributes are
 * identical in both skins; only class names differ. Nothing here ranks, filters, or hides
 * a role: the strip reports, the person decides.
 */

import Link from 'next/link';

import {
  CONSTRAINT_STATUS_LABEL,
  CONSTRAINT_VERDICT_HEADING,
  type ConstraintFit,
  type ConstraintResult,
} from '@/lib/matcha/constraintFit';
import type { MatchaSyncStatus } from '@/lib/matcha/sync';

export type TermsSkin = 'mz' | 'mdk';

function mzChipClass(result: ConstraintResult): string {
  switch (result.status) {
    case 'met':
      return 'mz-chip mz-chip-ok';
    case 'not_met':
      return result.hard ? 'mz-chip mz-chip-p0' : 'mz-chip mz-chip-watch';
    default:
      return 'mz-chip mz-chip-unknown';
  }
}

function mdkReasonClass(result: ConstraintResult): string {
  switch (result.status) {
    case 'met':
      return 'mdk-reason mdk-reason--confirmed';
    case 'not_met':
      return 'mdk-reason mdk-reason--blocker';
    default:
      return 'mdk-reason mdk-reason--unknown';
  }
}

const MDK_MARK: Record<ConstraintResult['status'], string> = { met: '✓', not_met: '△', unknown: '?' };

/**
 * One line for a whole list or deck about the clinician's terms: still loading, none set,
 * or checked from a browser copy because the account store did not answer. Rendered once
 * above the rows, so twenty roles never say "set your terms" twenty times.
 */
export function TermsListNote({
  loaded,
  sync,
  statedCount,
  skin,
}: {
  loaded: boolean;
  sync: MatchaSyncStatus;
  statedCount: number;
  skin: TermsSkin;
}) {
  const noteClass = skin === 'mz' ? 'mb-4 mz-small' : 'mdk-terms-note';
  const linkClass = skin === 'mz' ? 'underline underline-offset-2' : undefined;
  if (!loaded) {
    return (
      <p className={noteClass} role="status" aria-live="polite" data-terms-state="loading">
        Checking these roles against your terms…
      </p>
    );
  }
  if (statedCount === 0) {
    return (
      <p className={noteClass} data-terms-state="no_terms">
        Set the terms that matter to you — where you work, your minimum pay, the arrangement,
        sponsorship — and every role here is checked against them.{' '}
        <Link href="/holder/matcha/onboarding" className={linkClass}>
          Set your terms
        </Link>
      </p>
    );
  }
  if (sync === 'degraded') {
    return (
      <p className={noteClass} data-terms-state="degraded">
        Your account store did not answer, so each role is checked against the terms held in
        this browser only.
      </p>
    );
  }
  return null;
}

/**
 * The role record needed for the check was not available. Said as its own state — it is
 * not "unknown per term", which would imply the record was read and stayed silent.
 */
export function TermsRecordUnavailable({ skin }: { skin: TermsSkin }) {
  const blockClass = skin === 'mz' ? 'mt-3 mz-inset px-4 py-3' : 'mdk-terms';
  const labelClass =
    skin === 'mz'
      ? 'mz-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-500)]'
      : 'mdk-terms-label';
  const textClass = skin === 'mz' ? 'mt-1 text-xs text-[var(--ink-700)]' : 'mdk-terms-heading';
  return (
    <div className={blockClass} data-constraint-verdict="record_unavailable">
      <p className={labelClass}>Your terms</p>
      <p className={textClass}>
        Your terms could not be checked: the role record was not available. Open the role to try
        again.
      </p>
    </div>
  );
}

/**
 * Every term the clinician stated, checked against this role record. Three answers stay
 * distinct — met, not met, unknown — and the first non-negotiable term the record does not
 * settle carries its reason and the question that would settle it. A hard miss is stated;
 * the role and its actions around this strip are untouched.
 */
export function TermsCheckStrip({ fit, skin }: { fit: ConstraintFit; skin: TermsSkin }) {
  if (fit.results.length === 0) return null;
  const lead =
    fit.results.find((r) => r.hard && r.status !== 'met')
    ?? fit.results.find((r) => r.status === 'not_met')
    ?? null;

  const mz = skin === 'mz';
  const blockClass = mz ? 'mt-3 mz-inset px-4 py-3' : 'mdk-terms';
  const labelClass = mz
    ? 'mz-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-500)]'
    : 'mdk-terms-label';
  const headingClass = mz ? 'mt-1 text-xs text-[var(--ink-700)]' : 'mdk-terms-heading';
  const listClass = mz ? 'mt-2 flex flex-wrap gap-2' : 'mdk-reasons';
  const leadClass = mz ? 'mt-2 text-xs text-[var(--ink-700)]' : 'mdk-terms-lead';

  return (
    <div className={blockClass} data-constraint-verdict={fit.verdict}>
      <p className={labelClass}>Your terms</p>
      <p className={headingClass}>{CONSTRAINT_VERDICT_HEADING[fit.verdict]}</p>
      <ul className={listClass} aria-label="Your terms, checked against this role record">
        {fit.results.map((result) => (
          <li
            key={result.key}
            className={mz ? mzChipClass(result) : mdkReasonClass(result)}
            data-constraint-key={result.key}
            data-constraint-status={result.status}
            data-constraint-hard={result.hard ? 'true' : 'false'}
          >
            {mz ? (
              <span className="mz-gl" />
            ) : (
              <span className="mdk-reason-mark" aria-hidden="true">
                {MDK_MARK[result.status]}
              </span>
            )}
            <span>
              {result.label}: {CONSTRAINT_STATUS_LABEL[result.status]}
              {result.hard ? <span className="sr-only"> (non-negotiable)</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {lead ? (
        <p className={leadClass} data-constraint-lead={lead.key}>
          {lead.reason}
          {lead.nextQuestion ? ` Next: ${lead.nextQuestion}` : ''}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The same check, compressed for a fixed-height card face: the verdict sentence and each
 * term's answer inline. No reasons or questions here — the detail sheet carries the full
 * strip. Same data attributes as the strip so verification reads both the same way.
 */
export function TermsCheckSummary({ fit, skin }: { fit: ConstraintFit; skin: TermsSkin }) {
  if (fit.results.length === 0) return null;
  const mz = skin === 'mz';
  return (
    <div className={mz ? 'mt-3' : 'mdk-terms mdk-terms--face'} data-constraint-verdict={fit.verdict}>
      <p className={mz ? 'text-xs text-[var(--ink-700)]' : 'mdk-terms-heading'}>
        <span className={mz ? 'mz-mono uppercase tracking-[0.12em] text-[var(--ink-500)]' : 'mdk-terms-label'}>
          Your terms
        </span>{' '}
        {CONSTRAINT_VERDICT_HEADING[fit.verdict]}
      </p>
      <p className={mz ? 'mt-1 text-xs' : 'mdk-terms-inline'} aria-label="Your terms, checked against this role record">
        {fit.results.map((result, index) => (
          <span key={result.key}>
            {index > 0 ? <span aria-hidden="true"> · </span> : null}
            <span
              data-constraint-key={result.key}
              data-constraint-status={result.status}
              data-constraint-hard={result.hard ? 'true' : 'false'}
              className={mz ? undefined : `mdk-terms-inline-item mdk-terms-inline-item--${result.status}`}
            >
              {result.label}: {CONSTRAINT_STATUS_LABEL[result.status]}
              {result.hard ? <span className="sr-only"> (non-negotiable)</span> : null}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}
