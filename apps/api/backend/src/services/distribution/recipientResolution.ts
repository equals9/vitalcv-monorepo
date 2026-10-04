/**
 * Recipient resolution — Wave 1072C / C3.
 *
 * A share names a recipient organization. Until now the backend accepted
 * whatever `organization_id` string the client sent: `validateOrganizationContext`
 * checks shape and length, not existence, and nothing checked that the
 * opportunity the clinician chose actually belongs to that organization.
 *
 * That is the difference between "the client asserted a recipient" and "the
 * product resolved one". This module resolves it server-side from the
 * selected opportunity, so the recipient is a fact about the listing rather
 * than client input.
 *
 * Deliberately NOT done here: inventing an organization id from a display
 * name or an opportunity id. A listing with no organization simply cannot
 * receive a share, and the surface says so.
 */

import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';
import { evaluateIntegratedApply } from '../opportunities/integratedApply';

/** Postgres uuid columns throw on a non-uuid string rather than returning null. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ApplicationRecipient {
  organizationId: string;
  organizationName: string;
  opportunityId: string;
  purposeOfUse: string;
}

export const DEFAULT_PURPOSE_OF_USE = 'Employment consideration';

/**
 * Resolve the canonical recipient for a chosen opportunity, and assert that
 * the claimed organization really owns it.
 *
 * @param opportunityId the listing the clinician selected
 * @param claimedOrganizationId what the client says the recipient is; when
 *        present it must MATCH the opportunity's real organization
 */
export async function resolveRecipientForOpportunity(
  opportunityId: string,
  claimedOrganizationId?: string,
  purposeOfUse?: string,
): Promise<ApplicationRecipient> {
  const id = (opportunityId ?? '').trim();
  if (!id || !UUID_RE.test(id)) {
    throw new HttpError(400, 'A valid opportunityId is required to resolve the recipient.');
  }

  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      organizationId: true,
      listingSource: true,
      organization: {
        select: { id: true, name: true, organizationProfile: { select: { id: true } } },
      },
    },
  });

  if (!opportunity) {
    throw new HttpError(404, 'That opportunity no longer exists.');
  }

  const org = opportunity.organization;
  if (!org?.id) {
    // Honest dead end — never synthesise an id so the share can proceed.
    throw new HttpError(
      409,
      'This listing has no receiving organization, so Apply with VitalCV is not available for it yet.',
    );
  }

  // A share is a disclosure addressed to the listing's employer. The same
  // rule that gates sealing an application gates resolving a recipient: a
  // feed-copied row's organization is an ingestion placeholder that never
  // posted the role and cannot receive the share, and an organization with
  // no profile was never set up by anyone. Refusing here keeps the share
  // path from naming a recipient the apply path would refuse.
  const eligibility = evaluateIntegratedApply({
    listingSource: opportunity.listingSource,
    organizationName: org.name,
    hasOrganizationProfile: Boolean(org.organizationProfile),
  });
  if (!eligibility.eligible) {
    throw new HttpError(409, eligibility.message);
  }

  if (opportunity.status && opportunity.status !== 'ACTIVE') {
    throw new HttpError(409, 'That opportunity is no longer accepting applications.');
  }

  // The client may pass what it believes the recipient is; a MISMATCH means
  // stale context or tampering, and either way the share must not proceed
  // with a recipient the listing does not actually belong to.
  const claimed = (claimedOrganizationId ?? '').trim();
  if (claimed && claimed !== org.id) {
    throw new HttpError(
      409,
      'The selected opportunity does not belong to that organization. Reselect the opportunity.',
    );
  }

  return {
    organizationId: org.id,
    // The name the eligibility rule resolved — never a synthesised placeholder.
    organizationName: eligibility.recipient,
    opportunityId: opportunity.id,
    purposeOfUse: (purposeOfUse ?? '').trim() || DEFAULT_PURPOSE_OF_USE,
  };
}
