import * as React from 'react';

import {
  type SourceLaneStatusEntry,
  resolveLaneAvailability,
} from '@/lib/trust/laneAvailability';

export type { SourceLaneStatusEntry };

/**
 * SourceLaneStatus — the shared renderer for source-lane AVAILABILITY.
 *
 * One question, asked the same way everywhere it is asked: is this lane wired
 * and returning data today? `/status` and `/trust` both print that list, and
 * before this component they printed it from two hand-written copies of the
 * same lifecycle→copy map, which had already drifted (see
 * `lib/trust/laneAvailability.ts` for the specific drift).
 *
 * SCOPE — read this before extending the props.
 *
 * Availability is a fact about the PLATFORM, not about a clinician. An
 * "available" lane has not checked anyone until someone runs it. Two things
 * follow, and both are load-bearing:
 *
 *  1. This component takes no `lastCheckedAt`, and it will not grow one. On
 *     this axis there is no "checked at" — the state is read off a registry,
 *     not off a source call, so a timestamp next to the pill would manufacture
 *     a freshness claim out of a build-time constant. The honest freshness
 *     statement for a lane is its CADENCE (`readCadence` / `cadenceLabel` in
 *     `sourceLanes.ts`), which is why `cadence` is the field that exists. A
 *     production audit already found the homepage badging monthly and quarterly
 *     snapshot lanes as "read live"; cadence is the correction, and it is now
 *     rendered rather than dropped.
 *  2. Per-record coverage (`checked`, `stale`, `notFound`, …) is a DIFFERENT
 *     vocabulary with a different meaning, rendered by different components.
 *     `axis` is a required literal precisely so every call site states which
 *     question it is answering, and so widening to a second axis is a typed
 *     change somebody has to make on purpose rather than a union that quietly
 *     accepts both.
 *
 * Server component by construction: no state, no effects, no `'use client'`.
 * A row is a link when it carries an `href` and inert markup otherwise — no
 * click handler, so `/status` and `/trust` ship no JavaScript for this list.
 * Failure is handled in props (`error`) rather than by a boundary, so the
 * honest fallback renders on the server too; `SourceLaneStatusBoundary` covers
 * the client-side case for callers that need it.
 */

export interface SourceLaneStatusProps {
  /**
   * Which question this list answers. Only `'availability'` exists today —
   * required rather than defaulted so no call site can be ambiguous about it,
   * and so per-record coverage cannot be passed in by mistake.
   */
  axis: 'availability';
  lanes: readonly SourceLaneStatusEntry[];
  /**
   * `full` — one row per lane with its note and pill, stacking under 640px.
   * `compact` — a card grid, 3 → 2 → 1 columns.
   */
  variant?: 'full' | 'compact';
  /** Accessible name for the region. */
  ariaLabel?: string;
  /** Rendered under the list. The scope caveat belongs here. */
  footnote?: React.ReactNode;
  /** Skeleton rows at the final row height, so the list does not shift. */
  isLoading?: boolean;
  /**
   * Honest failure. When set, no lane renders a state pill at all — the labels
   * render with "state unavailable right now". A stale success UI is the one
   * outcome this component may never produce.
   */
  error?: string | null;
  className?: string;
}

const PILL_BASE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 ' +
  // 12px, not the 11px these surfaces carried: the smaller size sat below the
  // legibility floor for uppercase tracked mono on the cream surface family.
  'text-[12px] font-semibold uppercase tracking-[0.08em]';

// `items-start` matters in the stacked (mobile) direction: without it the pill
// stretches to the full row width and reads as a button rather than a status.
const ROW_BASE =
  'flex flex-col items-start gap-2 px-5 py-4 sm:flex-row sm:justify-between sm:gap-4';

/** Hover/lift only where there is something to click. Never fake interactivity. */
const ROW_INTERACTIVE =
  'transition-[background-color,border-color,transform] duration-150 ease-out ' +
  'hover:bg-[var(--vt-surface-subtle)] hover:-translate-y-[2px] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-text-primary)] focus-visible:ring-offset-0';

function StatePill({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={PILL_BASE}
      style={{ color: tone, borderColor: `color-mix(in oklab, ${tone} 38%, transparent)` }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: tone }}
      />
      {label}
    </span>
  );
}

function LaneBody({
  label,
  note,
  cadence,
}: {
  label: string;
  note: string;
  cadence?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[14px] font-semibold text-[var(--vt-text-primary)]">{label}</p>
      <p className="mt-0.5 text-[13px] text-[var(--vt-text-secondary)]">{note}</p>
      {cadence ? (
        // Cadence, not a timestamp. "Available" says the source returns data;
        // only this says how current that data is.
        <p className="mt-1 text-[12px] text-[var(--vt-text-muted)]">Read cadence: {cadence}</p>
      ) : null}
    </div>
  );
}

function LaneRow({ lane, variant }: { lane: SourceLaneStatusEntry; variant: 'full' | 'compact' }) {
  const presentation = resolveLaneAvailability(lane.state);
  const note = lane.note ?? presentation.note;

  // Cadence only means something for a source that is actually read. The
  // registry stores `access-gated` and `not read` in the same field, and
  // printing those behind "Read cadence:" states a category error — a source
  // nobody reads has no cadence. The note already says why it is not read
  // ("A source exists; access is not yet in place."), so nothing is lost.
  const cadence = presentation.available ? lane.cadence : undefined;

  const inner =
    variant === 'compact' ? (
      <div className="flex h-full flex-col gap-3">
        <StatePill label={presentation.label} tone={presentation.tone} />
        <LaneBody label={lane.label} note={note} cadence={cadence} />
      </div>
    ) : (
      <>
        <LaneBody label={lane.label} note={note} cadence={cadence} />
        <StatePill label={presentation.label} tone={presentation.tone} />
      </>
    );

  const layout =
    variant === 'compact'
      ? 'h-full rounded-[10px] border border-[var(--vt-border)] px-4 py-4'
      : ROW_BASE;

  return (
    <li
      // Both attributes on ONE open tag: the deploy prober reads the pair off a
      // single element and skips a row that carries only one.
      data-lane-key={lane.statusApiKey}
      data-lane-lifecycle={lane.state}
      // Layout lives on the child, never on the <li> via `display: contents` —
      // that drops list items out of the accessibility tree in several browsers.
      className={variant === 'compact' ? 'h-full' : undefined}
    >
      {lane.href ? (
        <a href={lane.href} className={`${layout} ${ROW_INTERACTIVE} block`}>
          {inner}
        </a>
      ) : (
        <div className={layout}>{inner}</div>
      )}
    </li>
  );
}

/**
 * Skeleton row.
 *
 * Deliberately static — no shimmer keyframe. A shimmer would need a new
 * `@keyframes` plus a `prefers-reduced-motion` guard to say nothing the grey
 * block does not already say, and this list resolves on the server anyway.
 * Heights match the real row so nothing shifts when the content lands.
 */
function SkeletonRow({ variant }: { variant: 'full' | 'compact' }) {
  const layout =
    variant === 'compact'
      ? 'h-full rounded-[10px] border border-[var(--vt-border)] px-4 py-4'
      : ROW_BASE;
  return (
    <li aria-hidden="true" className={variant === 'compact' ? 'h-full' : undefined}>
      <div className={layout}>
        <div className="min-w-0 flex-1">
          <div className="h-[17px] w-40 rounded-[3px] bg-[var(--vt-surface-subtle)]" />
          <div className="mt-1.5 h-[15px] w-64 max-w-full rounded-[3px] bg-[var(--vt-surface-subtle)]" />
        </div>
        <div className="h-[26px] w-28 rounded-full bg-[var(--vt-surface-subtle)]" />
      </div>
    </li>
  );
}

export function SourceLaneStatus({
  axis,
  lanes,
  variant = 'full',
  // "Source availability", not "Evidence lane availability": EC-9 bans `lane`
  // from customer-facing copy, and an aria-label is customer-facing copy. The
  // noun stays lawful in identifiers, props and comments — it is the product's
  // internal word for these rows, and this file is full of it.
  ariaLabel = 'Source availability',
  footnote,
  isLoading = false,
  error = null,
  className,
}: SourceLaneStatusProps) {
  if (process.env.NODE_ENV !== 'production' && axis !== 'availability') {
    // eslint-disable-next-line no-console
    console.warn(
      `[SourceLaneStatus] Unsupported axis ${JSON.stringify(axis)}. This component ` +
        'renders lane availability only; per-record coverage has its own vocabulary ' +
        'and its own components.',
    );
  }

  // `list-none` is explicit rather than inherited from a preflight reset: this
  // list renders inside `.mz` marketing pages that set their own list styles.
  const listClass =
    variant === 'compact'
      ? 'grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3'
      : 'list-none divide-y divide-[var(--vt-border-subtle,var(--vt-border))] overflow-hidden rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-0';

  return (
    <section aria-label={ariaLabel} className={className} data-source-lane-status={variant}>
      {isLoading ? (
        <ul className={listClass} aria-busy="true">
          {lanes.map((lane) => (
            <SkeletonRow key={lane.laneId} variant={variant} />
          ))}
        </ul>
      ) : error ? (
        // Honest failure: the lanes are still named, and not one of them
        // carries a state. Nothing here can be mistaken for a green result.
        <div
          className="overflow-hidden rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-5 py-5"
          role="status"
        >
          <p className="text-[14px] text-[var(--vt-text-primary)]">
            Source availability could not be read right now. {error}
          </p>
          <ul className="mt-3 space-y-1">
            {lanes.map((lane) => (
              <li key={lane.laneId} className="text-[13px] text-[var(--vt-text-secondary)]">
                {lane.label} — state unavailable right now
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className={listClass}>
          {lanes.map((lane) => (
            <LaneRow key={lane.laneId} lane={lane} variant={variant} />
          ))}
        </ul>
      )}

      {footnote ? (
        <p className="mt-3 text-[13px] text-[var(--vt-text-muted)]">{footnote}</p>
      ) : null}
    </section>
  );
}

export default SourceLaneStatus;
