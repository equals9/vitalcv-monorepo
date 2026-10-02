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
 * So the rule lives here once and EVERY consumer reads it: the truth builder
 * (presentation), the apply service (enforcement), the share recipient
 * resolver, the live MATCHA mapper (which the deck and the public-safe
 * projection read), and the web surfaces through the `applicationMode` those
 * emit. A rule that is derived twice is a rule that drifts; this repo has
 * repeatedly found the same lifecycle mapped in several places with no gate
 * over the wording.
 *
 * THE RULE
 *
 * An opportunity is integrated-apply eligible only when ALL of:
 *   1. `listingSource` is exactly `employer_posted` — the positive value the
 *      column defaults to and every self-serve posting carries. A feed row
 *      (`public_feed`) is refused with copy that says where the application
 *      really happens; any other value is unrecognised and refused too.
 *   2. the organization carries an OrganizationProfile — the row only an
 *      employer who went through setup has. The ingestion runner attaches
 *      feed rows to placeholder organizations with DELIBERATELY no profile,
 *      so this fence holds even for a row that was never stamped.
 *   3. an organization name resolves — it is what the packet freezes as the
 *      disclosure recipient, and an opaque id is not a recipient.
 *
 * WHAT THIS MODULE DOES NOT DECIDE
 *
 * - Availability. Whether the opportunity is still open is a separate,
 *   already-enforced concern (`status !== 'ACTIVE'` → 409 in the apply
 *   service). Eligibility asks "may this KIND of listing be applied to
 *   through VitalCV at all", not "is it still live".
 * - Requirement satisfaction. Requirements are comparison and explanation,
 *   never a gate: a clinician may apply to a role they do not yet satisfy.
 *   Nothing here reads requirements (ADR 0008 records the open question).
 * - Employer acceptance. Eligibility to APPLY is not acceptance, is not
 *   readiness, and is not a credentialing decision.
 */

/** The listingSource value the ingestion runner stamps on every feed-copied row. */
export const PUBLIC_FEED_LISTING_SOURCE = 'public_feed';

/** The listingSource value the column defaults to and self-serve postings carry. */
export const EMPLOYER_POSTED_LISTING_SOURCE = 'employer_posted';

/**
 * True when a row was copied from a public feed rather than posted by an
 * employer who claimed the organization.
 *
 * This is the ONE definition of "feed listing". `buildOpportunityTruth`
 * publishes it as `isFeedListing`; the eligibility rule below refuses on it
 * first so the clinician is told where the application really happens.
 */
export function isFeedListingSource(listingSource: string | null | undefined): boolean {
  return listingSource === PUBLIC_FEED_LISTING_SOURCE;
}

/** Why an opportunity may not be entered through integrated apply. */
export type IntegratedApplyIneligibility =
  /** Copied from a public feed. The employer never posted it here. */
  | 'feed_listing'
  /** A listingSource this system does not write. Fails closed. */
  | 'unrecognised_listing_source'
  /** The organization has no profile — nobody set it up to receive applications. */
  | 'unclaimed_organization'
  /**
   * No organization name resolves server-side, so the packet could only
   * freeze an opaque id as the disclosure recipient.
   */
  | 'unresolved_recipient';

export type IntegratedApplyEligibility =
  | { eligible: true; recipient: string }
  | { eligible: false; reason: IntegratedApplyIneligibility; message: string };

/** The two values a consumer renders; the eligibility result collapses to one. */
export type ApplicationMode = 'external' | 'vitalcv';

/**
 * The minimum an opportunity row must carry for integrated apply to be honest.
 *
 * Deliberately structural, not a Prisma type: the truth builder, the apply
 * service, the recipient resolver and the MATCHA mapper load different shapes
 * of the same row, and widening this to a model type would force one of them
 * to over-fetch.
 */
export interface IntegratedApplyCandidate {
  listingSource: string | null | undefined;
  organizationName: string | null | undefined;
  /** True when an OrganizationProfile row exists for the owning organization. */
  hasOrganizationProfile: boolean;
}

/**
 * Clinician-facing refusal text.
 *
 * Each says what is true about the LISTING and never implies the clinician
 * is unqualified, that VitalCV rejected them, or that anything about their
 * evidence is at fault. Each reason carries distinct text so a test — or a
 * reader — can tell them apart.
 */
const FEED_LISTING_MESSAGE =
  'This role is carried from the employer’s own job posting. Apply on the employer’s site — VitalCV cannot deliver an application for it.';

const UNRECOGNISED_LISTING_SOURCE_MESSAGE =
  'This listing’s source is not recognised, so it cannot be applied to through VitalCV.';

const UNCLAIMED_ORGANIZATION_MESSAGE =
  'This employer has not set up applications through VitalCV for this role. Apply with the employer directly.';

const UNRESOLVED_RECIPIENT_MESSAGE =
  'This role is not currently accepting applications through VitalCV.';

/**
 * Decide whether integrated apply may proceed. Fails closed on every input it
 * cannot positively recognise.
 */
export function evaluateIntegratedApply(
  candidate: IntegratedApplyCandidate,
): IntegratedApplyEligibility {
  if (isFeedListingSource(candidate.listingSource)) {
    return { eligible: false, reason: 'feed_listing', message: FEED_LISTING_MESSAGE };
  }

  if (candidate.listingSource !== EMPLOYER_POSTED_LISTING_SOURCE) {
    return {
      eligible: false,
      reason: 'unrecognised_listing_source',
      message: UNRECOGNISED_LISTING_SOURCE_MESSAGE,
    };
  }

  if (!candidate.hasOrganizationProfile) {
    return {
      eligible: false,
      reason: 'unclaimed_organization',
      message: UNCLAIMED_ORGANIZATION_MESSAGE,
    };
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

/**
 * The rendering value derived from eligibility. 'external' means "the
 * application happens somewhere other than VitalCV" — which covers a feed row
 * (apply on the employer's site) and an unclaimed or unrecognised listing
 * (no VitalCV path exists) alike. Surfaces must never offer a VitalCV apply
 * control unless this is 'vitalcv'.
 */
export function applicationModeFor(candidate: IntegratedApplyCandidate): ApplicationMode {
  return evaluateIntegratedApply(candidate).eligible ? 'vitalcv' : 'external';
}
