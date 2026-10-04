'use client';

import * as React from 'react';

/**
 * SourceLaneStatusBoundary — honest failure for a rendered lane list.
 *
 * Wraps `SourceLaneStatus` (or any lane list) so that a client-side render or
 * hydration error degrades into the lane NAMES with no state attached, instead
 * of into a blank region or — far worse — the last good render left on screen.
 * "Nothing is wrong here" is the one thing a failed availability list may never
 * imply.
 *
 * Two deliberate shapes:
 *
 *  - It takes `lanes` as `{ laneId, label }` only, and renders its own small
 *    fallback rather than importing `SourceLaneStatus`. Importing it would pull
 *    the whole component into the client bundle of every page that wraps one,
 *    which is exactly the cost the server-component design avoids. Children are
 *    passed in from the server and are never bundled.
 *  - The fallback carries NO state pill, no colour, no dot. There is no
 *    "unknown" pill to render here, because the component that decides pills is
 *    the thing that just failed.
 *
 * Server-side failure is not this component's job — an error boundary cannot
 * catch it. `SourceLaneStatus` takes an `error` prop for that path, so the same
 * honest fallback renders on the server too.
 */

export interface SourceLaneStatusBoundaryProps {
  /** Names only. Enough to say which lanes exist, never enough to imply a state. */
  lanes: readonly { laneId: string; label: string }[];
  children: React.ReactNode;
  /** Accessible name for the fallback region. */
  ariaLabel?: string;
  className?: string;
}

interface BoundaryState {
  failed: boolean;
}

export class SourceLaneStatusBoundary extends React.Component<
  SourceLaneStatusBoundaryProps,
  BoundaryState
> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[SourceLaneStatus] lane list failed to render', error);
    }
  }

  render() {
    // "Source availability" rather than "Evidence lane availability": EC-9 bans
    // `lane` from customer-facing copy, and an aria-label is customer-facing.
    const { lanes, children, ariaLabel = 'Source availability', className } = this.props;

    if (!this.state.failed) return children;

    return (
      <section aria-label={ariaLabel} className={className} data-source-lane-status="error">
        <div
          className="overflow-hidden rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-5 py-5"
          role="status"
        >
          <p className="text-[14px] text-[var(--vt-text-primary)]">
            Source availability could not be displayed right now. These are the sources VitalCV
            reads; their current state is not available on this page load.
          </p>
          <ul className="mt-3 list-none space-y-1 p-0">
            {lanes.map((lane) => (
              <li key={lane.laneId} className="text-[13px] text-[var(--vt-text-secondary)]">
                {lane.label} — state unavailable right now
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }
}

export default SourceLaneStatusBoundary;
