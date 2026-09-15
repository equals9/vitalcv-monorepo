/**
 * Integrated-apply eligibility — the single server-side rule deciding whether
 * an opportunity may be entered through "Apply with VitalCV".
 *
 * WHY THIS MODULE EXISTS
 *
 * `buildOpportunityTruth` already derives `applicationMode` ('vitalcv' vs
 * 'external') and documents the contract on `isFeedListing`:
 *
 *   "Consumers must not render employer-stated language, a readiness
 *    comparison, or a VitalCV apply path for these."
 *
 * That was a contract on RENDERING only. Nothing enforced it on the write
 * path: `applyToOpportunity` checked existence and ACTIVE status and nothing
 * else, so a feed-copied listing would seal an immutable ApplicationPacket
 * whose frozen `recipient` is the ingestion placeholder organization — a
 * consent record stating the clinician disclosed evidence to an employer who
 * never posted the role, never claimed the organization, and has no way to
 * receive the packet. The clinician's consent receipt would name the wrong
 * party, permanently, and packets are never rewritten.
 *
 * So the rule lives here once and BOTH consumers read it: the truth builder
 * (presentation) and the apply service (enforcement). A rule that is derived
 * twice is a rule that drifts; this repo has repeatedly found the same
 * lifecycle mapped in several places with no gate over the wording.
 *
 * WHAT THIS MODULE DOES NOT DECIDE
 *
 * - Availability. Whether the opportunity is still open is a separate,
 *   already-enforced concern (`status !== 'ACTIVE'` → 409 in the apply
 *   service). Eligibility asks "may this KIND of listing be applied to
 *   through VitalCV at all", not "is it still live".
 * - Requirement satisfaction. Requirements are comparison and explanation,
 *   never a gate: a clinician may apply to a role they do not yet satisfy.
 *   Nothing here reads requirements.
 * - Employer acceptance. Eligibility to APPLY is not acceptance, is not
 *   readiness, and is not a credentialing decision.
 */

/** The listingSource value the ingestion runner stamps on every feed-copied row. */
export const PUBLIC_FEED_LISTING_SOURCE = 'public_feed';

/**
 * True when a row was copied from a public feed rather than posted by an
 * employer who claimed the organization.
 *
 * This is the ONE definition. `buildOpportunityTruth` and the apply service
 * both call it so presentation and enforcement cannot disagree about what a
 * feed listing is.
 */
export function isFeedListingSource(listingSource: string | null | undefined): boolean {
  return listingSource === PUBLIC_FEED_LISTING_SOURCE;
}

/** Why an opportunity may not be entered through integrated apply. */
export type IntegratedApplyIneligibility =
  /** Copied from a public feed. The employer never posted it here. */
  | 'feed_listing'
  /**
   * No organization name resolves server-side, so the packet could only
   * freeze an opaque id as the disclosure recipient.
   */
  | 'unresolved_recipient';

export type IntegratedApplyEligibility =
  | { eligible: true; recipient: string }
  | { eligible: false; reason: IntegratedApplyIneligibility; message: string };

/**
 * The minimum an opportunity row must carry for integrated apply to be honest.
 *
 * Deliberately structural, not a Prisma type: the truth builder and the apply
 * service load different shapes of the same row, and widening this to a model
 * type would force one of them to over-fetch.
 */
export interface IntegratedApplyCandidate {
  listingSource: string | null | undefined;
  organizationName: string | null | undefined;
}

/**
 * Clinician-facing refusal text.
 *
 * Says what is true — this role is carried from the employer's own posting and
 * is applied to there — and never implies the clinician is unqualified, that
 * VitalCV rejected them, or that anything about their evidence is at fault.
 */
const FEED_LISTING_MESSAGE =
  'This role is carried from the employer’s own job posting. Apply on the employer’s site — VitalCV cannot deliver an application for it.';

const UNRESOLVED_RECIPIENT_MESSAGE =
  'This role is not currently accepting applications through VitalCV.';

/**
 * Decide whether integrated apply may proceed. Fails closed: an unrecognised
 * or absent listing source is treated as employer-authored ONLY because
 * `employer_posted` is the column default and every feed row is explicitly
 * stamped — the ingestion runner is the sole writer of `public_feed`, and it
 * sets it on both the create and update branches.
 */
export function evaluateIntegratedApply(
  candidate: IntegratedApplyCandidate,
): IntegratedApplyEligibility {
  if (isFeedListingSource(candidate.listingSource)) {
    return { eligible: false, reason: 'feed_listing', message: FEED_LISTING_MESSAGE };
  }

  const recipient = candidate.organizationName?.trim();
  if (!recipient) {
    return {
      eligible: false,
      reason: 'unresolved_recipient',
      message: UNRESOLVED_RECIPIENT_MESSAGE,
    };
  }

  return { eligible: true, recipient };
}
