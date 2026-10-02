/**
 * The integrated-apply eligibility rule, in isolation.
 *
 * The real-DB suites (integratedApplyBoundary.db.test.ts at the service, and
 * routes/__tests__/falseRecordWriters.db.test.ts over HTTP) prove the rule is
 * ENFORCED and writes nothing when it refuses. This suite proves the rule
 * itself is right, including the cases the DB suites cannot cheaply stage.
 */

import {
  applicationModeFor,
  EMPLOYER_POSTED_LISTING_SOURCE,
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
  const claimed = {
    listingSource: EMPLOYER_POSTED_LISTING_SOURCE,
    organizationName: 'Example Health',
    hasOrganizationProfile: true,
  };

  it('permits an employer-posted role whose organization was set up and names a recipient', () => {
    expect(evaluateIntegratedApply(claimed)).toEqual({ eligible: true, recipient: 'Example Health' });
    expect(applicationModeFor(claimed)).toBe('vitalcv');
  });

  it('refuses a feed listing', () => {
    const result = evaluateIntegratedApply({ ...claimed, listingSource: 'public_feed' });
    expect(result.eligible).toBe(false);
    expect(result.eligible === false && result.reason).toBe('feed_listing');
    expect(applicationModeFor({ ...claimed, listingSource: 'public_feed' })).toBe('external');
  });

  it('refuses a feed listing even when the placeholder org has a plausible name and a profile', () => {
    // The placeholder organization carries the employer's real name — that is
    // exactly why the recipient check alone cannot catch this case, and why
    // listing source is checked first.
    const result = evaluateIntegratedApply({
      listingSource: 'public_feed',
      organizationName: 'One Medical',
      hasOrganizationProfile: true,
    });
    expect(result.eligible === false && result.reason).toBe('feed_listing');
  });

  it('requires the POSITIVE employer_posted value — absent, null, or any other source fails closed', () => {
    for (const listingSource of [null, undefined, '', 'partner_sync', 'EMPLOYER_POSTED']) {
      const result = evaluateIntegratedApply({ ...claimed, listingSource });
      expect({ listingSource, eligible: result.eligible }).toEqual({ listingSource, eligible: false });
      expect(result.eligible === false && result.reason).toBe('unrecognised_listing_source');
    }
  });

  it('refuses an employer-posted row whose organization has no profile — nobody set it up', () => {
    const result = evaluateIntegratedApply({ ...claimed, hasOrganizationProfile: false });
    expect(result.eligible).toBe(false);
    expect(result.eligible === false && result.reason).toBe('unclaimed_organization');
    expect(applicationModeFor({ ...claimed, hasOrganizationProfile: false })).toBe('external');
  });

  it('refuses when no recipient name resolves', () => {
    for (const organizationName of [null, undefined, '', '   ']) {
      const result = evaluateIntegratedApply({ ...claimed, organizationName });
      expect(result.eligible).toBe(false);
      expect(result.eligible === false && result.reason).toBe('unresolved_recipient');
    }
  });

  it('carries distinct text for every refusal, so one reason cannot be mistaken for another', () => {
    const messages = [
      evaluateIntegratedApply({ ...claimed, listingSource: 'public_feed' }),
      evaluateIntegratedApply({ ...claimed, listingSource: 'partner_sync' }),
      evaluateIntegratedApply({ ...claimed, hasOrganizationProfile: false }),
      evaluateIntegratedApply({ ...claimed, organizationName: null }),
    ].map((result) => (result.eligible === false ? result.message : ''));

    expect(new Set(messages).size).toBe(messages.length);
  });

  it('never tells the clinician they were rejected or are unqualified', () => {
    const messages = [
      evaluateIntegratedApply({ ...claimed, listingSource: 'public_feed' }),
      evaluateIntegratedApply({ ...claimed, listingSource: 'partner_sync' }),
      evaluateIntegratedApply({ ...claimed, hasOrganizationProfile: false }),
      evaluateIntegratedApply({ ...claimed, organizationName: null }),
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
