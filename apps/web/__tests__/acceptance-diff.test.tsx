/**
 * acceptance-diff.test.tsx — W6 acceptance re-share diff.
 *
 * Guards the pure diff (refreshed / added / revoked / stale / removed /
 * unchanged; nothing-revoked reassurance) and the component (clean vs
 * fail-closed banner, canonical ProvenanceChip, no bare "Verified").
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  diffAcceptanceSnapshot,
  summarizeAcceptanceDiff,
  type AcceptanceSourceCheck,
} from '@/lib/acceptance/acceptanceDiff';
import { AcceptanceDiff } from '@/design-system/components';
import { CANONICAL_SOURCE_COVERAGE_STATES } from '@vitalcv/trust-state';

const ACCEPTED: AcceptanceSourceCheck[] = [
  { sourceId: 'NPPES', label: 'NPPES identity', state: 'checked', checkedAt: '2026-03-30T00:00:00Z' },
  { sourceId: 'OIG', label: 'OIG exclusions', state: 'checked', checkedAt: '2026-03-30T00:00:00Z' },
  { sourceId: 'DEA', label: 'DEA registration', state: 'stale', checkedAt: '2026-01-10T00:00:00Z' },
  { sourceId: 'TX', label: 'TX license', state: 'stale', checkedAt: '2026-01-05T00:00:00Z' },
];
const CLEAN: AcceptanceSourceCheck[] = [
  { sourceId: 'NPPES', label: 'NPPES identity', state: 'checked', checkedAt: '2026-03-30T00:00:00Z' },
  { sourceId: 'OIG', label: 'OIG exclusions', state: 'checked', checkedAt: '2026-03-30T00:00:00Z' },
  { sourceId: 'DEA', label: 'DEA registration', state: 'checked', checkedAt: '2026-07-11T00:00:00Z' },
  { sourceId: 'TX', label: 'TX license', state: 'checked', checkedAt: '2026-07-09T00:00:00Z' },
  { sourceId: 'ABMS', label: 'Board cert', state: 'checked', checkedAt: '2026-06-28T00:00:00Z' },
];

describe('diffAcceptanceSnapshot', () => {
  it('detects refreshed, new, and unchanged; nothing revoked', () => {
    const d = diffAcceptanceSnapshot(ACCEPTED, CLEAN);
    expect(d.counts.refreshed).toBe(2); // DEA + TX: stale → checked
    expect(d.counts.added).toBe(1); //     ABMS
    expect(d.unchanged).toBe(2); //        NPPES + OIG
    expect(d.counts.revoked).toBe(0);
    expect(d.nothingRevoked).toBe(true);
    expect(d.hasChanges).toBe(true);
  });

  it('flags revocation and clears the nothing-revoked reassurance', () => {
    const revoked = CLEAN.map((c) => (c.sourceId === 'TX' ? { ...c, state: 'revoked' as const } : c));
    const d = diffAcceptanceSnapshot(ACCEPTED, revoked);
    expect(d.counts.revoked).toBe(1);
    expect(d.nothingRevoked).toBe(false);
    expect(d.changes.some((c) => c.kind === 'revoked' && c.sourceId === 'TX')).toBe(true);
  });

  it('detects a re-verified (checked → checked, newer) as refreshed', () => {
    const before: AcceptanceSourceCheck[] = [{ sourceId: 'X', label: 'X', state: 'checked', checkedAt: '2026-01-01T00:00:00Z' }];
    const after: AcceptanceSourceCheck[] = [{ sourceId: 'X', label: 'X', state: 'checked', checkedAt: '2026-07-01T00:00:00Z' }];
    expect(diffAcceptanceSnapshot(before, after).counts.refreshed).toBe(1);
  });

  it('detects went-stale and removed', () => {
    const before: AcceptanceSourceCheck[] = [
      { sourceId: 'A', label: 'A', state: 'checked', checkedAt: '2026-01-01T00:00:00Z' },
      { sourceId: 'B', label: 'B', state: 'checked', checkedAt: '2026-01-01T00:00:00Z' },
    ];
    const after: AcceptanceSourceCheck[] = [{ sourceId: 'A', label: 'A', state: 'stale', checkedAt: '2026-01-01T00:00:00Z' }];
    const d = diffAcceptanceSnapshot(before, after);
    expect(d.counts.stale).toBe(1); // A checked → stale
    expect(d.counts.removed).toBe(1); // B gone
  });

  it('reports no changes when snapshots match', () => {
    const d = diffAcceptanceSnapshot(ACCEPTED, ACCEPTED);
    expect(d.hasChanges).toBe(false);
    expect(d.unchanged).toBe(ACCEPTED.length);
  });
});

/**
 * Transitions vs current state. The diff used to count every checked → X
 * move other than stale/revoked as "unchanged", and counted a source that was
 * already revoked at acceptance as "nothing revoked" — both under the green
 * reassurance line. These pin the separation.
 */
describe('diffAcceptanceSnapshot — degraded support and current adverse state', () => {
  const at = '2026-03-30T00:00:00Z';
  const one = (state: AcceptanceSourceCheck['state'], checkedAt: string | null = at): AcceptanceSourceCheck[] => [
    { sourceId: 'S', label: 'S', state, checkedAt },
  ];
  const LOST_SUPPORT = CANONICAL_SOURCE_COVERAGE_STATES.filter((s) => s !== 'checked' && s !== 'stale');

  it.each(LOST_SUPPORT)('checked → %s is degraded, never unchanged', (state) => {
    const d = diffAcceptanceSnapshot(one('checked'), one(state));
    expect(d.counts.degraded).toBe(1);
    expect(d.unchanged).toBe(0);
    expect(d.hasChanges).toBe(true);
    expect(summarizeAcceptanceDiff(d)).toContain('1 no longer confirmed');
  });

  it('a source already revoked at acceptance clears the nothing-revoked reassurance', () => {
    const d = diffAcceptanceSnapshot(one('revoked'), one('revoked'));
    expect(d.counts.revoked).toBe(0); // no transition…
    expect(d.currentlyRevoked).toBe(1); // …but a current adverse state
    expect(d.nothingRevoked).toBe(false);
    expect(summarizeAcceptanceDiff(d)).toBe('No changes since your acceptance · 1 revoked — review');
  });

  it('a revoked source added since acceptance also clears the reassurance', () => {
    const d = diffAcceptanceSnapshot([], one('revoked'));
    expect(d.counts.added).toBe(1);
    expect(d.nothingRevoked).toBe(false);
  });

  it('a shift between two non-decision-grade states is changed, not unchanged', () => {
    const d = diffAcceptanceSnapshot(one('pending'), one('unavailable'));
    expect(d.counts.changed).toBe(1);
    expect(d.unchanged).toBe(0);
  });

  it('unchanged means identical state AND check time', () => {
    expect(diffAcceptanceSnapshot(one('stale', at), one('stale', '2026-04-30T00:00:00Z')).unchanged).toBe(0);
    // A missing checkedAt and an explicit null both mean "never checked".
    const omitted: AcceptanceSourceCheck[] = [{ sourceId: 'S', label: 'S', state: 'pending' }];
    expect(diffAcceptanceSnapshot(one('pending', null), omitted).unchanged).toBe(1);
  });
});

describe('summarizeAcceptanceDiff', () => {
  it('summarizes a clean compounding diff', () => {
    expect(summarizeAcceptanceDiff(diffAcceptanceSnapshot(ACCEPTED, CLEAN))).toBe('2 refreshed · 1 new · nothing revoked');
  });
  it('summarizes no changes', () => {
    expect(summarizeAcceptanceDiff(diffAcceptanceSnapshot(ACCEPTED, ACCEPTED))).toBe('No changes since your acceptance');
  });
  it('flags revoked in the summary', () => {
    const revoked = CLEAN.map((c) => (c.sourceId === 'TX' ? { ...c, state: 'revoked' as const } : c));
    expect(summarizeAcceptanceDiff(diffAcceptanceSnapshot(ACCEPTED, revoked))).toContain('revoked — review');
  });
});

describe('AcceptanceDiff — render', () => {
  it('leads with the nothing-revoked reassurance on a clean diff', () => {
    const html = renderToStaticMarkup(<AcceptanceDiff acceptedAt="2026-04-02T00:00:00Z" accepted={ACCEPTED} current={CLEAN} />);
    expect(html).toContain('data-acceptance-diff="clean"');
    expect(html).toContain('Nothing revoked since your acceptance on 2026-04-02');
    expect(html).toContain('data-change-kind="refreshed"');
    expect(html).toContain('data-change-kind="added"');
  });

  it('fails closed and renders the revoked ProvenanceChip when a credential is revoked', () => {
    const revoked = CLEAN.map((c) => (c.sourceId === 'TX' ? { ...c, state: 'revoked' as const } : c));
    const html = renderToStaticMarkup(<AcceptanceDiff acceptedAt="2026-04-02T00:00:00Z" accepted={ACCEPTED} current={revoked} />);
    expect(html).toContain('data-acceptance-diff="revoked"');
    expect(html).toContain('data-change-kind="revoked"');
    expect(html).toContain('data-provenance-state="revoked"');
    expect(html).toContain('revoked since your acceptance');
  });

  it('does not lead with a clean banner when decision-grade support was lost', () => {
    const lost = CLEAN.map((c) => (c.sourceId === 'OIG' ? { ...c, state: 'unavailable' as const } : c));
    const html = renderToStaticMarkup(<AcceptanceDiff acceptedAt="2026-04-02T00:00:00Z" accepted={ACCEPTED} current={lost} />);
    expect(html).toContain('data-acceptance-diff="degraded"');
    expect(html).toContain('data-change-kind="degraded"');
    expect(html).toContain('1 check no longer confirmed at the source since your acceptance on 2026-04-02');
    expect(html).not.toContain('Nothing revoked since your acceptance');
  });

  it('fails closed on a source already revoked at acceptance, and does not say the packet still holds', () => {
    const revokedAtAccept = ACCEPTED.map((c) => (c.sourceId === 'TX' ? { ...c, state: 'revoked' as const } : c));
    const html = renderToStaticMarkup(
      <AcceptanceDiff acceptedAt="2026-04-02T00:00:00Z" accepted={revokedAtAccept} current={revokedAtAccept} />,
    );
    expect(html).toContain('data-acceptance-diff="revoked"');
    expect(html).toContain('1 credential revoked — review before relying on this.');
    expect(html).not.toContain('still holds');
    expect(html).not.toContain('Nothing revoked');
  });

  it('never renders the bare status word "Verified"', () => {
    const html = renderToStaticMarkup(<AcceptanceDiff acceptedAt="2026-04-02T00:00:00Z" accepted={ACCEPTED} current={CLEAN} />);
    expect(/>\s*Verified\s*</.test(html)).toBe(false);
  });
});
