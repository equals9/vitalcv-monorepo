/**
 * The web tier's public-safe projection must not advertise "Apply with
 * VitalCV" for a listing the server would refuse.
 *
 * `applyAvailable` used to be `Boolean(organizationId)`. A feed-carried row has
 * an organization id — the ingestion placeholder — so the homepage career loop
 * offered a share flow to roles whose employer never posted here. The
 * availability now comes from the server's integrated-apply rule, emitted as
 * `applicationMode` on the raw match, or from the backend's own projection
 * when it already answered; an unmarked row is not available.
 */

import { describe, expect, it } from 'vitest';

import { toPublicSafeMatches } from '../lib/matcha/publicSafeProjection';

const NPI = '1558395511';

function rawMatch(opportunity: Record<string, unknown>) {
  return { opportunity, explanation: { fitReasons: [], blockers: [] } };
}

describe('public-safe projection — apply availability', () => {
  it('is available only for a row the server marked integrated with a resolving organization', () => {
    const [m] = toPublicSafeMatches(NPI, {
      matches: [rawMatch({ id: 'opp-1', title: 'Role', organizationId: 'org-1', applicationMode: 'vitalcv' })],
    }).matches;
    expect(m.applyAvailable).toBe(true);
  });

  it('is not available for a feed-carried row even though its placeholder organization has an id', () => {
    const [m] = toPublicSafeMatches(NPI, {
      matches: [rawMatch({ id: 'opp-2', title: 'Role', organizationId: 'org-placeholder', applicationMode: 'external' })],
    }).matches;
    expect(m.applyAvailable).toBe(false);
  });

  it('is not available when the server did not mark the row — the web tier never infers it', () => {
    const [m] = toPublicSafeMatches(NPI, {
      matches: [rawMatch({ id: 'opp-3', title: 'Role', organizationId: 'org-2' })],
    }).matches;
    expect(m.applyAvailable).toBe(false);
  });

  it('honours the backend’s own answer when re-projecting an already-projected match', () => {
    const projected = {
      matches: [
        { opportunityId: 'opp-4', title: 'Role', organizationId: 'org-3', applyAvailable: true, publicReasons: [] },
        { opportunityId: 'opp-5', title: 'Role', organizationId: 'org-4', applyAvailable: false, publicReasons: [] },
      ],
    };
    const [a, b] = toPublicSafeMatches(NPI, projected).matches;
    expect(a.applyAvailable).toBe(true);
    expect(b.applyAvailable).toBe(false);
  });
});
