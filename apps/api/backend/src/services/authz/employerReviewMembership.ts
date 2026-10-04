/**
 * Employer-review organisation membership — the always-on gate (W0-15).
 *
 * Every mutating employer-review action (accept / request-refresh /
 * route-to-review / batch / share-packet / confirm-start) records a decision
 * about a clinician on behalf of an ORGANISATION, so the actor must belong to
 * one. This resolver answers that from server-side rows only: is the caller an
 * ACTIVE member, with a reviewer-grade role, of the organisation their User
 * row is bound to? Both facts are written together by the self-serve org
 * setup (`opportunityService#upsertOrgProfile`), so a granted employer
 * resolves; an account with no organisation, a deactivated membership, or a
 * HOLDER/RECRUITER member does not.
 *
 * It is not mode-gated. The route layer refuses with 403 whenever this
 * returns null, independent of the platform-role RBAC rollout flag.
 */

import type { MembershipRole } from '@prisma/client';
import prisma from '../../graphql/prisma_client';

/** Membership roles that may record employer-review decisions. */
export const EMPLOYER_REVIEW_MEMBERSHIP_ROLES: readonly MembershipRole[] = ['VERIFIER', 'ADMIN'];

export interface EmployerReviewMembership {
  /** `Organization.id` — the id EmployerAcceptance.employerId carries (ADR 0007). */
  organizationId: string;
  organizationProfileId: string;
  membershipId: string;
  role: MembershipRole;
}

/**
 * Resolve the caller's active, reviewer-grade membership in the organisation
 * their User row is bound to. Returns null when any link in the chain is
 * missing — the caller must never supply any part of it.
 */
export async function resolveEmployerReviewMembership(
  clerkUserId: string,
): Promise<EmployerReviewMembership | null> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, organizationId: true },
  });
  if (!user?.organizationId) return null;

  const [personProfile, organizationProfile] = await Promise.all([
    prisma.personProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    }),
    prisma.organizationProfile.findUnique({
      where: { organizationId: user.organizationId },
      select: { id: true },
    }),
  ]);
  if (!personProfile || !organizationProfile) return null;

  // WorkspaceMembership has no Prisma relations (plain FK columns) — query by
  // the two ids directly.
  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      personProfileId: personProfile.id,
      organizationProfileId: organizationProfile.id,
      active: true,
      role: { in: [...EMPLOYER_REVIEW_MEMBERSHIP_ROLES] },
    },
    select: { id: true, role: true },
  });
  if (!membership) return null;

  return {
    organizationId: user.organizationId,
    organizationProfileId: organizationProfile.id,
    membershipId: membership.id,
    role: membership.role,
  };
}
