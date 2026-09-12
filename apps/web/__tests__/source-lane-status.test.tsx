/**
 * SourceLaneStatus — the shared source-lane availability renderer.
 *
 * `/status` and `/trust` each carried their own lifecycle → copy map, and the
 * coverage diagram on `/trust` carried a third. They had drifted: the diagram
 * said "Not connected" while the rows directly beneath it said "Not yet
 * connected", and `/status` said "Lane wired and returning data." where
 * `/trust` said "Wired and returning data." for the identical lifecycle.
 *
 * These tests pin the OUTCOME — one word per state, everywhere — plus the two
 * properties that must survive any future refactor: the component fails closed
 * on a state it does not know, and it never renders a positive state it was not
 * given.
 */
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { SourceLaneStatus } from '../components/trust/SourceLaneStatus';
import { SourceCoverageDiagram } from '../components/trust/SourceCoverageDiagram';
import {
  LANE_AVAILABILITY_STATES,
  LANE_AVAILABILITY_UNKNOWN,
  isLaneAvailabilityState,
  laneAvailabilityLabel,
  resolveLaneAvailability,
  toSourceLaneStatusEntries,
  type SourceLaneStatusEntry,
} from '../lib/trust/laneAvailability';
import { SOURCE_LANE_OPS } from '../lib/trust/sourceLanes';

const repoFile = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');

const LANES: SourceLaneStatusEntry[] = [
  { laneId: 'nppes_identity', label: 'NPPES Identity', state: 'active', statusApiKey: 'nppes_identity', cadence: 'read live' },
  { laneId: 'oig_exclusions', label: 'OIG Exclusions', state: 'partial', statusApiKey: 'oig_exclusions' },
  { laneId: 'state_license', label: 'State License', state: 'planned', statusApiKey: 'state_license' },
  { laneId: 'employment_history', label: 'Employment History', state: 'demo_only', statusApiKey: 'employment_history' },
  { laneId: 'board_cert', label: 'Board Certification', state: 'unintegrated', statusApiKey: 'board_certification' },
];

const render = (props: Partial<React.ComponentProps<typeof SourceLaneStatus>> = {}) =>
  renderToStaticMarkup(<SourceLaneStatus axis="availability" lanes={LANES} {...props} />);

describe('lane availability vocabulary', () => {
  it('gives every canonical lifecycle exactly one public word', () => {
    expect(
      Object.fromEntries(LANE_AVAILABILITY_STATES.map((s) => [s, laneAvailabilityLabel(s)])),
    ).toEqual({
      active: 'Available',
      partial: 'Partial',
      planned: 'Access required',
      demo_only: 'Not yet connected',
      unintegrated: 'Not yet connected',
    });
  });

  it('marks only the lifecycles that return data as available', () => {
    const available = LANE_AVAILABILITY_STATES.filter((s) => resolveLaneAvailability(s).available);
    expect(available).toEqual(['active', 'partial']);
  });

  it('agrees with the deploy prober about which lifecycles mean available', () => {
    // scripts/lib/lane-parity.mjs fails the deploy when /status and /api/status
    // disagree about a lane. If this module called a lifecycle available that
    // the prober calls unavailable, the page and the gate would disagree about
    // the gate's own question.
    const parity = readFileSync(
      path.join(__dirname, '..', '..', '..', 'scripts', 'lib', 'lane-parity.mjs'),
      'utf8',
    );
    const block = parity.match(/const PAGE_AVAILABLE = new Set\(\[(.*?)\]\)/s)?.[1] ?? '';
    const proberAvailable = [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    const ours = LANE_AVAILABILITY_STATES.filter((s) => resolveLaneAvailability(s).available)
      .slice()
      .sort();
    expect(ours).toEqual(proberAvailable);

    // And every lifecycle we can render must be one the prober recognises,
    // or a real deploy fails closed on a state only this module knows.
    const known = parity.match(/const KNOWN_PAGE_LIFECYCLES = new Set\(\[(.*?)\]\)/s)?.[1] ?? '';
    const proberKnown = new Set([...known.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
    for (const state of LANE_AVAILABILITY_STATES) {
      expect(proberKnown.has(state), `${state} is unknown to lane-parity.mjs`).toBe(true);
    }
  });

  it('fails closed on a state it does not know, and warns in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolved = resolveLaneAvailability('totally_new_state');
    warn.mockRestore();

    expect(resolved).toEqual(LANE_AVAILABILITY_UNKNOWN);
    expect(resolved.available).toBe(false);
    expect(resolved.label).toBe('State unavailable');
    // Never a positive state, and never a roadmap claim we cannot support.
    expect(resolved.label).not.toMatch(/Available|Partial/);
    expect(resolved.note).not.toContain('roadmap');
    expect(isLaneAvailabilityState('totally_new_state')).toBe(false);
  });
});

describe('SourceLaneStatus — rendering', () => {
  it('renders one list item per lane, with its state as a word', () => {
    const html = render();
    for (const lane of LANES) {
      expect(html).toContain(lane.label);
    }
    expect((html.match(/<li/g) ?? []).length).toBe(LANES.length);
    expect(html).toContain('Available');
    expect(html).toContain('Access required');
    expect(html).toContain('Not yet connected');
  });

  it('carries the W0.5 parity attributes as a pair on one open tag', () => {
    const html = render();
    // The prober's own matcher: an open tag with data-lane-key, then
    // data-lane-lifecycle read off that same tag.
    const tagPattern = /<[a-zA-Z][^>]*\sdata-lane-key=("|')(.*?)\1[^>]*>/g;
    const pairs: Record<string, string> = {};
    for (const match of html.matchAll(tagPattern)) {
      const lifecycle = match[0].match(/\sdata-lane-lifecycle=("|')(.*?)\1/);
      if (lifecycle) pairs[match[2]] = lifecycle[2];
    }
    expect(pairs).toEqual({
      nppes_identity: 'active',
      oig_exclusions: 'partial',
      state_license: 'planned',
      employment_history: 'demo_only',
      board_certification: 'unintegrated',
    });
  });

  it('names the region and keeps the list semantic', () => {
    const html = render();
    // EC-9 bans `lane` from customer-facing copy, and an aria-label is
    // customer-facing copy — `ec9-vocabulary-ratchet.test.ts` reads exactly
    // this attribute. The default has to be lawful, not just the overrides.
    expect(html).toContain('aria-label="Source availability"');
    expect(html).not.toMatch(/aria-label="[^"]*\blanes?\b/i);
    expect(html).toContain('<ul');
    expect(html).toContain('<li');

    const named = render({ ariaLabel: 'Public data sources' });
    expect(named).toContain('aria-label="Public data sources"');
  });

  it('renders cadence rather than a timestamp', () => {
    const html = render();
    expect(html).toContain('Read cadence: read live');
    // Availability is a registry fact, not a check: nothing here may imply a
    // moment at which this source was read for anyone.
    expect(html).not.toContain('<time');
    expect(html).not.toMatch(/last checked|Checked \d/i);
  });

  it('prints no cadence for a source it does not read', () => {
    // The registry keeps `access-gated` and `not read` in the same field as the
    // real cadences, so rendering it unconditionally printed "Read cadence:
    // access-gated" — a category error. A source nobody reads has no cadence.
    const html = render({
      lanes: [
        { laneId: 'state_license', label: 'State License', state: 'planned', cadence: 'access-gated' },
        { laneId: 'board_cert', label: 'Board Certification', state: 'unintegrated', cadence: 'not read' },
        { laneId: 'nppes_identity', label: 'NPPES Identity', state: 'active', cadence: 'read live' },
      ],
    });
    expect(html).not.toContain('Read cadence: access-gated');
    expect(html).not.toContain('Read cadence: not read');
    expect(html).toContain('Read cadence: read live');
    // The reason it is not read is still on the row.
    expect(html).toContain('A source exists; access is not yet in place.');
  });

  it('renders an unknown state as unavailable rather than dropping the row', () => {
    const html = render({
      lanes: [{ laneId: 'mystery', label: 'Mystery Lane', state: 'nonsense' }],
    });
    expect(html).toContain('Mystery Lane');
    expect(html).toContain('State unavailable');
    expect(html).not.toContain('>Available<');
  });

  it('gives clickable rows an anchor and a focus ring, and inert rows neither', () => {
    const linked = render({ lanes: [{ ...LANES[0], href: '/trust' }] });
    expect(linked).toContain('href="/trust"');
    expect(linked).toContain('focus-visible:ring-2');

    const inert = render();
    expect(inert).not.toContain('<a ');
    // No hover affordance on something that cannot be clicked.
    expect(inert).not.toContain('hover:-translate-y');
  });

  it('lays the compact variant out as a responsive grid', () => {
    const html = render({ variant: 'compact' });
    expect(html).toContain('grid-cols-1');
    expect(html).toContain('sm:grid-cols-2');
    expect(html).toContain('lg:grid-cols-3');
  });

  it('renders the footnote when one is given', () => {
    const html = render({ footnote: 'Availability describes the lane, not any one clinician.' });
    expect(html).toContain('Availability describes the lane, not any one clinician.');
  });
});

describe('SourceLaneStatus — loading and failure are honest', () => {
  it('renders skeleton rows with no status text and no animation class', () => {
    const html = render({ isLoading: true });
    expect(html).toContain('aria-busy="true"');
    expect((html.match(/<li/g) ?? []).length).toBe(LANES.length);
    for (const word of ['Available', 'Partial', 'Access required', 'Not yet connected']) {
      expect(html).not.toContain(word);
    }
    // No shimmer keyframe to disable under prefers-reduced-motion.
    expect(html).not.toMatch(/animate-|animation:/);
  });

  it('names every lane but states none of them when the read failed', () => {
    const html = render({ error: 'The register could not be read.' });
    for (const lane of LANES) {
      expect(html).toContain(lane.label);
      expect(html).toContain(`${lane.label} — state unavailable right now`);
    }
    // The failure mode may never look like a success.
    for (const word of ['Available', 'Partial', 'Access required', 'Not yet connected']) {
      expect(html).not.toContain(word);
    }
    expect(html).not.toContain('data-lane-key');
  });
});

describe('the surfaces share one projection', () => {
  it('prints the same word for the same lifecycle in the rows and the diagram', () => {
    // The exact drift that shipped: the diagram said "Not connected" while the
    // rows one element away said "Not yet connected".
    const diagram = renderToStaticMarkup(<SourceCoverageDiagram />);
    const rows = renderToStaticMarkup(
      <SourceLaneStatus axis="availability" lanes={toSourceLaneStatusEntries(
        SOURCE_LANE_OPS.map((lane) => ({
          sourceId: lane.laneId,
          displayName: lane.marketingShortName,
          lifecycle: lane.lifecycle,
          statusApiKey: lane.statusApiKey,
        })),
      )} />,
    );

    for (const lane of SOURCE_LANE_OPS) {
      // The licensure lane renders a self-correcting, scope-aware label from
      // @vitalcv/licensure in the diagram; every other lane must match.
      if (lane.readinessDimension === 'licensure') continue;
      const word = laneAvailabilityLabel(lane.lifecycle);
      expect(diagram, `${lane.laneId} missing "${word}" in the diagram`).toContain(word);
      expect(rows, `${lane.laneId} missing "${word}" in the rows`).toContain(word);
    }
    expect(diagram).not.toContain('>Not connected<');
  });

  it('leaves no page-local lifecycle map behind', () => {
    // The regression this component exists to prevent: a fourth copy of the
    // lifecycle → copy projection growing back on a page.
    for (const file of ['app/status/page.tsx', 'app/trust/page.tsx']) {
      const src = repoFile(file);
      expect(src, `${file} still declares its own lifecycle map`).not.toMatch(
        /(LIFECYCLE_ROW|LIFECYCLE_LABEL)\s*[:=]/,
      );
      expect(src).toContain('SourceLaneStatus');
    }
    // The diagram keeps its fill colours (a diagram needs them) but not words.
    const diagram = repoFile('components/trust/SourceCoverageDiagram.tsx');
    expect(diagram).toContain('laneAvailabilityLabel');
    expect(diagram).not.toMatch(/label: 'Not connected'/);
  });

  it('adapts register snapshot rows into entries, joining cadence from the registry', () => {
    const entries = toSourceLaneStatusEntries([
      { sourceId: 'nppes_identity', displayName: 'NPPES Identity', lifecycle: 'active', statusApiKey: 'nppes_identity' },
      { sourceId: 'pecos_enrollment', displayName: 'PECOS Enrollment', lifecycle: 'active', statusApiKey: 'pecos_enrollment' },
    ]);
    expect(entries[0].cadence).toBe('read live');
    expect(entries[1].cadence).toBe('quarterly snapshot');
    // Cadence is never invented for a lane the registry does not carry.
    expect(toSourceLaneStatusEntries([
      { sourceId: 'not_a_lane', displayName: 'Nope', lifecycle: 'active' },
    ])[0].cadence).toBeUndefined();
  });
});
