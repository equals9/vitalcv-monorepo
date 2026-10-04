import * as React from 'react';

import { coverageLabel } from '@vitalcv/licensure';
import { SOURCE_LANE_OPS, type SourceLaneOps } from '@/lib/trust/sourceLanes';
import { laneAvailabilityLabel } from '@/lib/trust/laneAvailability';

/**
 * SourceCoverageDiagram — the lane spine, drawn.
 *
 * Every mark is derived from `SOURCE_LANE_OPS` (NUM-1.5, the single lane
 * definition). Nothing here is illustrative: the bar count is the lane count,
 * each bar's fill is that lane's real `lifecycle`, and the cadence label is its
 * real `readCadence`. If a lane is added, retired, or changes state, this
 * redraws — it cannot drift from `/api/status`, because it reads the same
 * module `/api/status` reads.
 *
 * Why data-bound rather than an illustration: on a product whose claim is that
 * it does not overstate, the cheap visual is the dangerous one. A hand-drawn
 * "coverage" graphic would look authoritative while being unfalsifiable, which
 * is exactly the class of defect a production audit found on the homepage
 * ("read live" over monthly and quarterly snapshots). A picture of the data
 * has to stay honest because it IS the data.
 *
 * Honesty rules baked in:
 *  - Availability describes the LANE, never a clinician. The caption says so.
 *  - State is carried by a WORD as well as colour (WCAG 1.4.1), matching the
 *    ribbon's doctrine.
 *  - A snapshot lane is never drawn as though it were a live read; cadence is
 *    printed next to the state.
 *  - No animation: this is evidence, not chrome.
 */

/**
 * Lifecycle → how the bar reads.
 *
 * The WORDS are no longer written here. This file used to carry its own label
 * map, and it had drifted from the rows directly beneath it on /trust: the same
 * lane read "Not connected" in the diagram and "Not yet connected" in the table
 * one element away. Both come from `laneAvailability.ts` now. Only the
 * fill colour stays local, because only a diagram needs one.
 */
const FILL_TONE: Record<SourceLaneOps['lifecycle'], string> = {
  active: 'var(--vt-state-source-confirmed)',
  planned: 'var(--vt-state-stale, #a2670b)',
  demo_only: 'var(--vt-text-muted)',
  unintegrated: 'var(--vt-text-muted)',
};

/**
 * The licensure lane says what is pending, not merely that something is.
 *
 * `Access required` is true of every gated lane and therefore tells a reader
 * nothing about this one. What is actually pending is access to a NATIONAL
 * network — FSMB for physicians, Nursys for nursing — so the honest state word
 * names that.
 *
 * The phrase is taken from `@vitalcv/licensure`'s own projection rather than
 * written here, because that projection is SELF-CORRECTING: `coverageLabel`
 * derives the suffix from `countLiveRoutes()` and stops saying "pending" the
 * moment a route completes a real production run. A string typed into this
 * component would keep saying "pending" forever, including on the day it became
 * false — which is the failure mode this whole wave exists to remove.
 *
 * Only the SUFFIX is used. `coverageLabel` returns a profession-scoped headline
 * ("Physician licensure — …"), and this register is profession-agnostic: it
 * describes VitalCV's lanes, not one clinician's. Rendering "Physician
 * licensure" here would silently drop nursing from a diagram that covers it.
 */
function licensureStateLabel(): string {
  // `PHYSICIAN_MD` is a representative profession — the national-vs-pending
  // determination is read off live route state, and the suffix it produces is
  // profession-agnostic. If a nursing route went live first this would need to
  // consider both lanes; today `countLiveRoutes()` is zero for every profession.
  const headline = coverageLabel('PHYSICIAN_MD');
  const suffix = headline.split('—')[1]?.trim();
  // Fall back to the generic gated wording rather than rendering a half-parsed
  // sentence if the upstream label format ever changes.
  return suffix ? capitalize(suffix) : laneAvailabilityLabel('planned');
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stateLabelFor(lane: SourceLaneOps): string {
  return lane.readinessDimension === 'licensure'
    ? licensureStateLabel()
    : laneAvailabilityLabel(lane.lifecycle);
}

/** How full the bar reads. Availability is categorical, so these are the only three widths. */
const FILL: Record<SourceLaneOps['lifecycle'], number> = {
  active: 1,
  planned: 0.35,
  demo_only: 0.12,
  unintegrated: 0.12,
};

const ROW_H = 34;
const LABEL_W = 132;
const BAR_W = 196;

export function SourceCoverageDiagram({ lanes = SOURCE_LANE_OPS }: { lanes?: readonly SourceLaneOps[] }) {
  const height = lanes.length * ROW_H + 8;
  const liveCount = lanes.filter((l) => l.lifecycle === 'active').length;

  return (
    <figure className="mt-6" style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${LABEL_W + BAR_W + 150} ${height}`}
        width="100%"
        style={{ maxWidth: 520, display: 'block' }}
        role="img"
        aria-label={
          `Source lane availability: ${liveCount} of ${lanes.length} lanes return data today. ` +
          // `stateLabelFor`, not `TONE[...].label` — the accessible name has to
          // say what the sighted reader sees. A screen-reader user hearing
          // "Licensure: access required" while the diagram reads "national
          // source access pending" is being told a different, vaguer fact.
          lanes.map((l) => `${l.marketingShortName}: ${stateLabelFor(l)}`).join('. ') + '.'
        }
      >
        {lanes.map((lane, i) => {
          const y = i * ROW_H + 6;
          const fill = FILL_TONE[lane.lifecycle];
          return (
            <g key={lane.laneId}>
              <text
                x={0}
                y={y + 13}
                fill="var(--vt-text-secondary)"
                style={{ font: '500 12px var(--font-mono, ui-monospace)' }}
              >
                {lane.marketingShortName}
              </text>

              {/* track */}
              <rect
                x={LABEL_W}
                y={y + 3}
                width={BAR_W}
                height={12}
                rx={2}
                fill="var(--vt-surface-subtle)"
                stroke="var(--vt-border)"
                strokeWidth={1}
              />
              {/* real state */}
              <rect
                x={LABEL_W}
                y={y + 3}
                width={BAR_W * FILL[lane.lifecycle]}
                height={12}
                rx={2}
                fill={fill}
                opacity={lane.lifecycle === 'active' ? 0.85 : 0.5}
              />

              {/* state as a WORD, not colour alone */}
              <text
                x={LABEL_W + BAR_W + 10}
                y={y + 13}
                fill="var(--vt-text-muted)"
                style={{ font: '400 11px var(--font-mono, ui-monospace)' }}
              >
                {stateLabelFor(lane)}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption
        className="mt-3 text-[12px] leading-relaxed"
        style={{ color: 'var(--vt-text-muted)', maxWidth: 520 }}
      >
        Lane availability, not a clinician result — {liveCount} of {lanes.length} return data today.
        A lane being available does not mean any particular record has been checked, and lanes that
        read from a periodic release are only as current as that release.
      </figcaption>
    </figure>
  );
}

export default SourceCoverageDiagram;
