/**
 * Lane availability — the single projection from a lane's lifecycle to the
 * words and tone a public surface prints for it.
 *
 * `lib/trust/sourceLanes.ts` (NUM-1.5) already made lane *truth* single-homed:
 * which lanes exist, and which are live. It did not make lane *presentation*
 * single-homed, and four hand-written copies of that projection grew back:
 *
 *   1. `app/status/page.tsx`                    → LIFECYCLE_ROW
 *   2. `app/trust/page.tsx`                     → LIFECYCLE_LABEL
 *   3. `components/trust/SourceCoverageDiagram` → TONE
 *   4. `components/ops/SourceLaneTelemetry`     → raw lifecycle words (operator
 *      altitude; deliberately unlabelled, so it is not folded in here)
 *
 * They had already drifted, in the small way that is hardest to notice:
 *
 *   - `/trust` printed "Not connected" in the diagram and "Not yet connected"
 *     in the table directly beneath it — the same lane, the same state, two
 *     phrasings, one screen apart.
 *   - `/status` said "Lane wired and returning data." where `/trust` said
 *     "Wired and returning data." for the identical lifecycle.
 *
 * Neither is a lie, which is exactly why neither gate caught it: the parity
 * prober asserts availability, not wording (correctly — see
 * `scripts/lib/lane-parity.mjs`), and the copy gates match banned phrases. Drift
 * in the presentation layer is a legibility defect, and the fix is structural:
 * one projection, imported.
 *
 * WHAT THIS MODULE IS NOT. It answers ONE question — "is this lane wired and
 * returning data today". It is deliberately not the vocabulary for:
 *
 *   - per-record coverage (`checked` / `stale` / `notFound` / `accessRequired`
 *     …) — that is `@vitalcv/trust-state`'s `CanonicalSourceCoverageState`, and
 *     it describes one clinician's result, not the platform's capability;
 *   - the anonymous access boundary (`source-backed` / `auth-required` /
 *     `connector-not-live`) — that is `TruthStateKind`, rendered by
 *     `ConnectorMatrix` and `TrustAttributionRegister`.
 *
 * Those are different altitudes and they are allowed to differ from this one.
 * A lane can be `active` here (the adapter runs) while a given record reads
 * `pending` (nobody has run it for that NPI) and an anonymous visitor sees
 * `auth-required` (no session). All three are true at once. Merging them is how
 * the 2026-07-25 OIG/PECOS contradiction was published; #917 fixed it by
 * LABELLING the axes, not by reconciling them. Do not add a coverage state or a
 * connector state to the union below.
 */

import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/**
 * Every lifecycle a public surface may render.
 *
 * Two vocabularies reach public surfaces and both are represented here:
 * `register.ts` folds `demo_only` into `unintegrated` before `/status` and
 * `/trust` see it, while `/status/technical` renders `SOURCE_LANE_OPS.lifecycle`
 * verbatim. `scripts/lib/lane-parity.mjs` accepts exactly this set, so keep the
 * two in step — a lifecycle rendered but unknown to the prober fails the deploy.
 */
export const LANE_AVAILABILITY_STATES = [
  'active',
  'partial',
  'planned',
  'demo_only',
  'unintegrated',
] as const;

export type LaneAvailabilityState = (typeof LANE_AVAILABILITY_STATES)[number];

export interface LaneAvailabilityPresentation {
  /**
   * The pill text. Carries the state as a WORD so it never depends on colour
   * alone (WCAG 1.4.1) — the same doctrine the coverage diagram follows.
   */
  label: string;
  /** Plain-language sentence printed under the lane name. */
  note: string;
  /**
   * Design token for the pill text and its dot. Never a raw hex.
   *
   * Measured on the rendered page (canvas readback, `/trust` light surface,
   * pill background `#FBFAF7`) rather than asserted:
   *
   *   Available          #22683B  6.46:1   ✓ AA
   *   Access required    #A05C00  4.99:1   ✓ AA
   *   Not yet connected  #65635E  5.75:1   ✓ AA
   *
   * `--vt-state-stale` is UNSET in this theme, so the surfaces that used
   * `var(--vt-state-stale, #a2670b)` were all painting the fallback hex —
   * which measures 4.49:1 and misses the 4.5:1 floor for 12px text. The amber
   * tone therefore names `--vt-badge-warning-text`, a token that is actually
   * defined and does clear the floor. Two of these values are `oklch()` at
   * runtime; a naive rgb parse reads them as nonsense and reports ~14:1, so
   * re-measure by painting, never by parsing the computed string.
   */
  tone: string;
  /**
   * True only when the lane returns real source data today.
   *
   * This is the field a surface should branch on, never a string compare
   * against `label` — copy is free to change, this contract is not. It matches
   * `PAGE_AVAILABLE` in `scripts/lib/lane-parity.mjs`; if the two disagree, a
   * page can render "Available" for a lane the deploy prober calls unavailable.
   */
  available: boolean;
}

/**
 * The fail-closed fallback for a lifecycle this module does not know.
 *
 * Deliberately NOT "Not yet connected": that is a positive factual claim about
 * the roadmap, and we do not know it. An unrecognised state means the surface
 * could not read the lane's state at all, and it says so. Never `available`.
 */
export const LANE_AVAILABILITY_UNKNOWN: LaneAvailabilityPresentation = Object.freeze({
  label: 'State unavailable',
  note: 'This lane reported a state VitalCV does not recognise. Treat it as not returning data.',
  tone: 'var(--vt-text-muted)',
  available: false,
});

/**
 * Lifecycle → public copy.
 *
 * Wording notes, so a future edit does not undo a deliberate choice:
 *  - `active` drops the leading "Lane" that `/status` carried. The row already
 *    sits in a list of lanes; the word was redundant on one surface and absent
 *    on the other.
 *  - `demo_only` and `unintegrated` share "Not yet connected" — the phrasing
 *    `/status` and `/trust` already used, and the more precise of the two in
 *    circulation ("Not connected" cannot distinguish roadmap from failure).
 *    Their NOTES differ, because the reason differs and it matters: demo code
 *    exists and must never be read as evidence.
 */
const PRESENTATION: Readonly<Record<LaneAvailabilityState, LaneAvailabilityPresentation>> =
  Object.freeze({
    active: {
      label: 'Available',
      note: 'Wired and returning data.',
      tone: 'var(--vt-state-source-confirmed)',
      available: true,
    },
    partial: {
      label: 'Partial',
      note: 'Available for some records; being expanded.',
      tone: 'var(--vt-badge-warning-text, #a2670b)',
      available: true,
    },
    planned: {
      label: 'Access required',
      note: 'A source exists; access is not yet in place.',
      tone: 'var(--vt-badge-warning-text, #a2670b)',
      available: false,
    },
    demo_only: {
      label: 'Not yet connected',
      note: 'Demonstration code only; never read as production evidence.',
      tone: 'var(--vt-text-muted)',
      available: false,
    },
    unintegrated: {
      label: 'Not yet connected',
      note: 'On the roadmap; not connected today.',
      tone: 'var(--vt-text-muted)',
      available: false,
    },
  });

export function isLaneAvailabilityState(value: unknown): value is LaneAvailabilityState {
  return (
    typeof value === 'string' &&
    (LANE_AVAILABILITY_STATES as readonly string[]).includes(value)
  );
}

/**
 * Project a lifecycle onto its public presentation, failing closed.
 *
 * An unrecognised state can only come from a surface that has widened the
 * registry without widening this module, so it warns in development — loudly
 * enough to be fixed, without breaking a public page in production over a copy
 * lookup. What it must never do is guess upward: the fallback is not available,
 * and says its state could not be read.
 */
export function resolveLaneAvailability(state: string): LaneAvailabilityPresentation {
  if (isLaneAvailabilityState(state)) return PRESENTATION[state];

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      `[laneAvailability] Unknown lane lifecycle ${JSON.stringify(state)}. ` +
        `Known states: ${LANE_AVAILABILITY_STATES.join(', ')}. ` +
        'Rendering it as unavailable. Add it here AND to KNOWN_PAGE_LIFECYCLES ' +
        'in scripts/lib/lane-parity.mjs, or the deploy prober will fail closed on it.',
    );
  }

  return LANE_AVAILABILITY_UNKNOWN;
}

/** Convenience for the surfaces that only need the word. */
export function laneAvailabilityLabel(state: string): string {
  return resolveLaneAvailability(state).label;
}

/**
 * One lane, as a surface renders it.
 *
 * Lives here rather than beside the component because it is a data shape, not
 * a React concern — and because `toSourceLaneStatusEntries` below needs it
 * without importing anything that renders.
 */
export interface SourceLaneStatusEntry {
  /** Canonical lane id, from `SOURCE_LANE_OPS`. */
  laneId: string;
  /** Human display name, e.g. "NPPES Identity". */
  label: string;
  /**
   * The lane's lifecycle.
   *
   * Typed as the union *widened with string* on purpose: this value arrives
   * from a runtime snapshot, so an unrecognised state is representable and the
   * fail-closed path in `resolveLaneAvailability` stays reachable. Narrowing it
   * to the union would delete the guard rather than satisfy it.
   */
  state: LaneAvailabilityState | (string & {});
  /**
   * The key this lane publishes under in `/api/status`, rendered as
   * `data-lane-key` for the W0.5 deploy parity join.
   */
  statusApiKey?: string;
  /** Overrides the shared note for this lifecycle. Rarely needed. */
  note?: string;
  /**
   * How current a result from this lane actually is — "read live", "monthly
   * snapshot", "quarterly snapshot", "not read". Registry-derived; never typed
   * by hand.
   */
  cadence?: string;
  /** Renders the row as a link. Absent → inert markup, no hover affordance. */
  href?: string;
}

/** The subset of `TrustRegisterSnapshot['sources'][number]` this needs. */
interface RegisterSource {
  sourceId: string;
  displayName: string;
  lifecycle: string;
  statusApiKey?: string;
}

/**
 * Adapt the register snapshot into renderable lane entries.
 *
 * The one place cadence is joined onto the register rows. `register.ts`
 * deliberately publishes a narrow snapshot (it is also served as public JSON at
 * `/.well-known/trust-register`), so cadence is looked up from the registry
 * here instead of widening that payload — and looked up in ONE place instead of
 * once per page, which is the drift this whole module exists to stop.
 */
export function toSourceLaneStatusEntries(
  sources: readonly RegisterSource[],
  lanes: readonly { laneId: string; cadenceLabel: string }[] = SOURCE_LANE_OPS,
): SourceLaneStatusEntry[] {
  const cadenceByLane = new Map(lanes.map((lane) => [lane.laneId, lane.cadenceLabel]));

  return sources.map((source) => ({
    laneId: source.sourceId,
    label: source.displayName,
    state: source.lifecycle,
    statusApiKey: source.statusApiKey,
    cadence: cadenceByLane.get(source.sourceId),
  }));
}
