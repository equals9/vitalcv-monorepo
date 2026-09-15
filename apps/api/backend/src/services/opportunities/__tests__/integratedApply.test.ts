/**
 * The integrated-apply eligibility rule, in isolation.
 *
 * The real-DB suite (integratedApplyBoundary.db.test.ts) proves the rule is
 * ENFORCED and writes nothing when it refuses. This suite proves the rule
 * itself is right, including the cases the DB suite cannot cheaply stage.
 */

import {
  evaluateIntegratedApply,
  isFeedListingSource,
  PUBLIC_FEED_LISTING_SOURCE,
} from '../integratedApply';

describe('isFeedListingSource', () => {
  it('recognises the exact value the ingestion runner stamps', () => {
    expect(PUBLIC_FEED_LISTING_SOURCE).toBe('public_feed');
    expect(isFeedListingSource('public_feed')).toBe(true);
  });

  it('treats employer_posted, absent, and null as not-a-feed-listing', () => {
    // `employer_posted` is the column default; rows created before the column
    // existed, and rows created by createOpportunity (which never sets it),
    // must remain integrated.
    expect(isFeedListingSource('employer_posted')).toBe(false);
    expect(isFeedListingSource(null)).toBe(false);
    expect(isFeedListingSource(undefined)).toBe(false);
  });

  it('does not match on substring or case', () => {
    // A near-miss must not silently pass as employer-authored, and a
    // differently-cased value is not a value this system writes.
    expect(isFeedListingSource('PUBLIC_FEED')).toBe(false);
    expect(isFeedListingSource('public_feed_v2')).toBe(false);
    expect(isFeedListingSource('not_public_feed')).toBe(false);
  });
});

describe('evaluateIntegratedApply', () => {
  it('permits an employer-authored role with a resolvable recipient', () => {
    const result = evaluateIntegratedApply({
      listingSource: 'employer_posted',
      organizationName: 'Example Health',
    });
    expect(result).toEqual({ eligible: true, recipient: 'Example Health' });
  });

  it('refuses a feed listing', () => {
    const result = evaluateIntegratedApply({
      listingSource: 'public_feed',
      organizationName: 'Ingested Placeholder Org',
    });
    expect(result.eligible).toBe(false);
    expect(result.eligible === false && result.reason).toBe('feed_listing');
  });

  it('refuses a feed listing even when the placeholder org has a plausible name', () => {
    // The placeholder organization carries the employer's real name — that is
    // exactly why the recipient check alone cannot catch this case, and why
    // listing source is checked first.
    const result = evaluateIntegratedApply({
      listingSource: 'public_feed',
      organizationName: 'One Medical',
    });
    expect(result.eligible === false && result.reason).toBe('feed_listing');
  });

  it('refuses when no recipient name resolves', () => {
    for (const organizationName of [null, undefined, '', '   ']) {
      const result = evaluateIntegratedApply({
        listingSource: 'employer_posted',
        organizationName,
      });
      expect(result.eligible).toBe(false);
      expect(result.eligible === false && result.reason).toBe('unresolved_recipient');
    }
  });

  it('never tells the clinician they were rejected or are unqualified', () => {
    const messages = [
      evaluateIntegratedApply({ listingSource: 'public_feed', organizationName: 'X' }),
      evaluateIntegratedApply({ listingSource: 'employer_posted', organizationName: null }),
    ].map((result) => (result.eligible === false ? result.message : ''));

    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0);
      // The refusal is about the LISTING, never about the person.
      expect(message).not.toMatch(/not qualified|unqualified|ineligible|denied|rejected/i);
      // And it must not imply any verification or credentialing verdict.
      expect(message).not.toMatch(/verified|credential|approved/i);
    }
  });
});
