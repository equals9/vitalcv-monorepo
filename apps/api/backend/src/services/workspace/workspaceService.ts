import {
  ActivePersona,
  type MembershipRole,
  type NpiType,
  type OrganizationProfile,
  type PersonProfile,
  Prisma,
  type User,
  UserRole,
  UserStatus,
  type WorkspaceMembership,
  type WorkspacePreference,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { fetchNpiFromCMS, normalizeProvider } from '../../modules/identity';
import type { NormalizedProvider } from '../../modules/identity';
import { AVAILABILITY_PLACEHOLDER_PREFIX } from '../matcha/availabilityRegistry';
import { applyConfiguredPlatformAdminGrant } from '../platform/platformAdminGrant';
import { log } from '../../obs/logger';
import { sha256ForPayload } from '../../utils/deterministic';
import { HttpError } from '../../utils/httpError';

const NPI_RE = /^\d{10}$/;

// The Prisma schema declares NO relations between User, PersonProfile,
// WorkspaceMembership, OrganizationProfile, or WorkspacePreference — the FK
// columns exist as plain scalars, so `include` on any of them fails at
// runtime ("Unknown field for include statement"). The composite below is
// stitched from the real tables by hydrateWorkspaceUser(); do not reintroduce
// `include` chains here without first adding the relations via an approved
// migration.
export type HydratedWorkspaceMembership = WorkspaceMembership & {
  organizationProfile: OrganizationProfile;
};

export type HydratedPersonProfile = PersonProfile & {
  memberships: HydratedWorkspaceMembership[];
};

export type WorkspaceUserRecord = User & {
  personProfile: HydratedPersonProfile | null;
  workspacePreference: WorkspacePreference | null;
};

export async function hydrateWorkspaceUser(user: User): Promise<WorkspaceUserRecord> {
  const [personProfile, workspacePreference] = await Promise.all([
    prisma.personProfile.findUnique({ where: { userId: user.id } }),
    prisma.workspacePreference.findUnique({ where: { userId: user.id } }),
  ]);

  if (!personProfile) {
    return { ...user, personProfile: null, workspacePreference };
  }

  const memberships = await prisma.workspaceMembership.findMany({
    where: { personProfileId: personProfile.id },
    orderBy: { createdAt: 'asc' },
  });

  const hydratedMemberships: HydratedWorkspaceMembership[] = [];
  if (memberships.length > 0) {
    const orgProfileIds = [...new Set(memberships.map((m) => m.organizationProfileId))];
    const orgProfiles = await prisma.organizationProfile.findMany({
      where: { id: { in: orgProfileIds } },
    });
    const orgById = new Map(orgProfiles.map((o) => [o.id, o]));
    for (const membership of memberships) {
      const organizationProfile = orgById.get(membership.organizationProfileId);
      if (!organizationProfile) {
        // Fail closed: a membership whose organization profile row is missing
        // cannot grant a workspace.
        log('warn', 'Workspace membership dropped — organization profile missing', {
          event: 'workspace_membership_org_missing',
          membershipId: membership.id,
          organizationProfileId: membership.organizationProfileId,
        });
        continue;
      }
      hydratedMemberships.push({ ...membership, organizationProfile });
    }
  }

  return {
    ...user,
    personProfile: { ...personProfile, memberships: hydratedMemberships },
    workspacePreference,
  };
}

export async function getHydratedWorkspaceUserByClerkUserId(
  clerkUserId: string,
): Promise<WorkspaceUserRecord | null> {
  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  return user ? hydrateWorkspaceUser(user) : null;
}

export interface WorkspaceList {
  userId: string;
  activePersona: ActivePersona;
  activeOrgId: string | null;
  personProfile: PersonProfile | null;
  memberships: Array<{
    org: OrganizationProfile;
    role: MembershipRole;
    active: boolean;
  }>;
  canSwitchTo: ActivePersona[];
}

export interface NpiBootstrapResult {
  npi: string;
  npiType: 'TYPE_1' | 'TYPE_2';
  inferredPersona: 'CLINICIAN' | 'VERIFIER' | 'UNKNOWN';
  /**
   * Provenance of the identity fields below. Consumers render these under
   * registry framing ("located in NPPES"), so they are ALWAYS NPPES-derived —
   * never an account's self-entered profile values. When the registry cannot
   * be read this is 'UNAVAILABLE' and the identity fields are absent.
   */
  identitySource: 'NPPES_API' | 'UNAVAILABLE';
  firstName?: string;
  lastName?: string;
  specialty?: string;
  state?: string;
  alreadyRegistered: boolean;
}

export interface PersonProfileInput {
  npi: string;
  npiType: NpiType;
  firstName: string;
  lastName: string;
  specialty: string;
  stateOfPractice: string;
  workAuthStatus: string;
  resumeUrl: string;
  linkedinUrl: string;
  portfolioUrl: string;
  completeness: number;
}

/**
 * True only for a platform-minted marketplace-availability placeholder row that
 * is eligible to be reconciled onto a real Clerk id. This is an explicit
 * allowlist (not "anything that isn't a `user_` id"): real Clerk accounts, seed
 * rows, and any legacy/unknown row are all NOT eligible and must never be
 * silently rebound. The prefix is imported from the minter so it cannot drift.
 */
export function isReconcilablePlaceholderId(id: string): boolean {
  return id.startsWith(`${AVAILABILITY_PLACEHOLDER_PREFIX}:`);
}

export async function ensureWorkspaceUser(
  clerkUserId: string,
  email?: string,
): Promise<User> {
  const existing = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (existing) {
    // W0-14: a listed id whose row already exists is promoted here if the boot
    // sweep missed it (e.g. the list changed and the service restarted before
    // this row resolved). One Set lookup for everyone else.
    return applyConfiguredPlatformAdminGrant(existing);
  }

  const normalizedEmail = normalizeOptionalString(email);
  if (!normalizedEmail) {
    throw new HttpError(404, 'Authenticated user has no VitalCV user record.');
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (byEmail) {
    // Account-takeover guard. `email` reaches this function from a
    // caller-supplied header (`x-clerk-user-email`) and the backend cannot
    // verify it belongs to `clerkUserId`. Silently rebinding an existing row's
    // clerkUserId to the incoming one would let an attacker who supplies a
    // victim's email (with any Clerk id) hijack the victim's account.
    //
    // Reconcile onto the incoming id ONLY for a platform-minted placeholder row
    // (explicit allowlist). Real Clerk accounts, seed rows, and any legacy row
    // are refused. Note: every placeholder/seed minter uses a non-colliding
    // synthetic `@*.local` address, so a real user's real email never reaches
    // this branch for a real account — a match here is either a genuine
    // placeholder handoff (allowed) or an attempt to rebind an established
    // account (refused).
    if (!isReconcilablePlaceholderId(byEmail.clerkUserId)) {
      throw new HttpError(409, 'Email is already associated with another account.');
    }
    const reconciled = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        clerkUserId,
        status: UserStatus.ACTIVE,
      },
    });
    return applyConfiguredPlatformAdminGrant(reconciled);
  }

  // W0-14: a listed id with no row at boot is promoted the moment its row is
  // created. The row is still created as CLINICIAN by the normal path; the
  // grant is a second, configuration-driven write, never a different default.
  const created = await prisma.user.create({
    data: {
      clerkUserId,
      email: normalizedEmail,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });
  return applyConfiguredPlatformAdminGrant(created);
}

export async function getWorkspacesForUser(
  clerkUserId: string,
): Promise<WorkspaceList> {
  const user = await getWorkspaceUserByClerkUserId(clerkUserId);
  const preference = await ensureWorkspacePreference(user.id);
  const hydratedUser = (await getWorkspaceUserById(user.id)) ?? user;
  const canSwitchTo = getAvailablePersonas(hydratedUser);
  const activePersona = await coerceActivePersona(hydratedUser, preference, canSwitchTo);
  const activeMemberships = hydratedUser.personProfile?.memberships.filter((membership) => membership.active) ?? [];
  const activeOrgId = (
    getValidatedActiveOrgId(activeMemberships, preference.activeOrgId)
    ?? activeMemberships[0]?.organizationProfile.organizationId
    ?? null
  );

  return {
    userId: hydratedUser.id,
    activePersona,
    activeOrgId,
    personProfile: hydratedUser.personProfile,
    memberships: hydratedUser.personProfile?.memberships.map((membership) => ({
      org: membership.organizationProfile,
      role: membership.role,
      active: membership.active,
    })) ?? [],
    canSwitchTo,
  };
}

export async function switchWorkspace(
  clerkUserId: string,
  targetPersona: ActivePersona,
  orgId?: string,
): Promise<WorkspacePreference> {
  const user = await getWorkspaceUserByClerkUserId(clerkUserId);
  const preference = await ensureWorkspacePreference(user.id);
  const hydratedUser = (await getWorkspaceUserById(user.id)) ?? user;
  const canSwitchTo = getAvailablePersonas(hydratedUser);

  if (!canSwitchTo.includes(targetPersona)) {
    throw new HttpError(403, `User cannot switch to ${targetPersona}.`);
  }

  const activeMemberships =
    hydratedUser.personProfile?.memberships.filter((membership) => membership.active) ?? [];

  let resolvedOrgId = getValidatedActiveOrgId(activeMemberships, preference.activeOrgId);
  if (targetPersona !== ActivePersona.CLINICIAN) {
    if (orgId) {
      const selectedMembership = activeMemberships.find(
        (membership) => membership.organizationProfile.organizationId === orgId,
      );
      if (!selectedMembership) {
        throw new HttpError(403, 'Requested organization is not an active workspace membership.');
      }
      resolvedOrgId = selectedMembership.organizationProfile.organizationId;
    }

    if (!resolvedOrgId && activeMemberships.length > 0) {
      resolvedOrgId = activeMemberships[0].organizationProfile.organizationId;
    }

    if (!resolvedOrgId) {
      throw new HttpError(403, 'An organization workspace is required for this persona.');
    }
  }

  const switchedAt = new Date();
  const updatedPreference = await prisma.workspacePreference.update({
    where: { userId: user.id },
    data: {
      activePersona: targetPersona,
      activeOrgId: targetPersona === ActivePersona.CLINICIAN
        ? preference.activeOrgId
        : resolvedOrgId,
      lastSwitchedAt: switchedAt,
    },
  });

  await emitWorkspaceAuditEvent('workspace_switched', {
    referenceId: updatedPreference.id,
    organizationId: targetPersona === ActivePersona.CLINICIAN
      ? preference.activeOrgId ?? undefined
      : resolvedOrgId ?? undefined,
    metadata: {
      userId: user.id,
      activePersona: targetPersona,
      previousPersona: preference.activePersona,
      orgId: targetPersona === ActivePersona.CLINICIAN
        ? preference.activeOrgId ?? null
        : resolvedOrgId ?? null,
      switchedAt: switchedAt.toISOString(),
    },
  });

  return updatedPreference;
}

export async function bootstrapFromNpi(
  npi: string,
): Promise<NpiBootstrapResult> {
  if (!NPI_RE.test(npi)) {
    throw new HttpError(400, 'NPI must be exactly 10 digits.');
  }

  const [existingPerson, existingOrg] = await Promise.all([
    prisma.personProfile.findUnique({ where: { npi } }),
    prisma.organizationProfile.findFirst({ where: { npi } }),
  ]);

  const alreadyRegistered = Boolean(existingPerson || existingOrg);

  // The identity fields of this result render under registry framing
  // ("located in NPPES"), so they must come from the registry and only the
  // registry — a registered account's self-entered profile values must never
  // ride in them. Account existence informs only `alreadyRegistered`,
  // `inferredPersona`, and the npiType fallback.
  let registry: NormalizedProvider | null = null;
  try {
    const { rawPayload } = await fetchNpiFromCMS(npi);
    registry = normalizeProvider(rawPayload);
  } catch (error) {
    log('warn', 'workspace_bootstrap_npi_registry_unavailable', {
      event: 'workspace_bootstrap_npi_registry_unavailable',
      npi,
      alreadyRegistered,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const registryNpiType = registry
    ? registry.enumeration_type === 'NPI-2'
      ? 'TYPE_2'
      : 'TYPE_1'
    : undefined;
  const npiType: NpiBootstrapResult['npiType'] =
    registryNpiType ?? (existingOrg && !existingPerson ? 'TYPE_2' : 'TYPE_1');

  const inferredPersona: NpiBootstrapResult['inferredPersona'] = existingPerson
    ? 'CLINICIAN'
    : existingOrg
      ? 'VERIFIER'
      : registry
        ? npiType === 'TYPE_1'
          ? 'CLINICIAN'
          : 'VERIFIER'
        : 'UNKNOWN';

  return {
    npi,
    npiType,
    inferredPersona,
    identitySource: registry ? 'NPPES_API' : 'UNAVAILABLE',
    firstName: registry?.first_name || undefined,
    lastName: registry?.last_name || undefined,
    specialty: registry?.primary_taxonomy ?? undefined,
    state: registry?.practice_address?.state || undefined,
    alreadyRegistered,
  };
}

export async function createPersonProfile(
  userId: string,
  data: Partial<PersonProfileInput>,
): Promise<PersonProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const existing = await prisma.personProfile.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  const createData: Prisma.PersonProfileUncheckedCreateInput = {
    userId,
  };

  const npi = normalizeOptionalString(data.npi);
  if (npi) {
    createData.npi = npi;
  }

  if (data.npiType) {
    createData.npiType = data.npiType;
  }

  const firstName = normalizeOptionalString(data.firstName);
  if (firstName) {
    createData.firstName = firstName;
  }

  const lastName = normalizeOptionalString(data.lastName);
  if (lastName) {
    createData.lastName = lastName;
  }

  const specialty = normalizeOptionalString(data.specialty);
  if (specialty) {
    createData.specialty = specialty;
  }

  const stateOfPractice = normalizeOptionalString(data.stateOfPractice);
  if (stateOfPractice) {
    createData.stateOfPractice = stateOfPractice;
  }

  const workAuthStatus = normalizeOptionalString(data.workAuthStatus);
  if (workAuthStatus) {
    createData.workAuthStatus = workAuthStatus;
  }

  const resumeUrl = normalizeOptionalString(data.resumeUrl);
  if (resumeUrl) {
    createData.resumeUrl = resumeUrl;
  }

  const linkedinUrl = normalizeOptionalString(data.linkedinUrl);
  if (linkedinUrl) {
    createData.linkedinUrl = linkedinUrl;
  }

  const portfolioUrl = normalizeOptionalString(data.portfolioUrl);
  if (portfolioUrl) {
    createData.portfolioUrl = portfolioUrl;
  }

  if (typeof data.completeness === 'number') {
    createData.completeness = clampCompleteness(data.completeness);
  }

  const profile = await prisma.personProfile.create({
    data: createData,
  });

  await ensureWorkspacePreference(userId);

  await emitWorkspaceAuditEvent('workspace_created', {
    referenceId: profile.id,
    metadata: {
      userId,
      npi: profile.npi,
      completeness: profile.completeness,
    },
  });

  return profile;
}

export async function ensureWorkspacePreference(
  userId: string,
): Promise<WorkspacePreference> {
  const existing = await prisma.workspacePreference.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  const user = await getWorkspaceUserById(userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const activeMemberships =
    user.personProfile?.memberships.filter((membership) => membership.active) ?? [];

  return prisma.workspacePreference.create({
    data: {
      // The schema declares id as dbgenerated(gen_random_uuid()) but the
      // actual workspace_preferences table has NO column default (verified in
      // prod information_schema 2026-07-05) — inserting without an id throws
      // P2011. Supply it client-side.
      id: randomUUID(),
      userId,
      activePersona: resolveDefaultPersona(user),
      activeOrgId: activeMemberships[0]?.organizationProfile.organizationId ?? null,
    },
  });
}

async function getWorkspaceUserByClerkUserId(
  clerkUserId: string,
): Promise<WorkspaceUserRecord> {
  const user = await getHydratedWorkspaceUserByClerkUserId(clerkUserId);

  if (!user) {
    throw new HttpError(404, 'Authenticated user has no VitalCV user record.');
  }

  return user;
}

async function getWorkspaceUserById(
  userId: string,
): Promise<WorkspaceUserRecord | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? hydrateWorkspaceUser(user) : null;
}

function getAvailablePersonas(user: WorkspaceUserRecord): ActivePersona[] {
  const activeMemberships =
    user.personProfile?.memberships.filter((membership) => membership.active) ?? [];
  const hasClinicianPersona = Boolean(user.personProfile?.npi || user.role === UserRole.CLINICIAN);
  const hasVerifierPersona = activeMemberships.length > 0;

  const personas: ActivePersona[] = [];
  if (hasClinicianPersona) {
    personas.push(ActivePersona.CLINICIAN);
  }
  if (hasVerifierPersona) {
    personas.push(ActivePersona.VERIFIER);
  }
  if (hasClinicianPersona && hasVerifierPersona) {
    personas.push(ActivePersona.BOTH);
  }

  if (personas.length === 0) {
    personas.push(ActivePersona.CLINICIAN);
  }

  return personas;
}

function resolveDefaultPersona(user: WorkspaceUserRecord): ActivePersona {
  const personas = getAvailablePersonas(user);
  if (personas.includes(ActivePersona.BOTH)) {
    return ActivePersona.BOTH;
  }
  if (personas.includes(ActivePersona.CLINICIAN)) {
    return ActivePersona.CLINICIAN;
  }
  return ActivePersona.VERIFIER;
}

async function coerceActivePersona(
  user: WorkspaceUserRecord,
  preference: WorkspacePreference,
  canSwitchTo: ActivePersona[],
): Promise<ActivePersona> {
  if (canSwitchTo.includes(preference.activePersona)) {
    return preference.activePersona;
  }

  const fallbackPersona = resolveDefaultPersona(user);
  await prisma.workspacePreference.update({
    where: { id: preference.id },
    data: {
      activePersona: fallbackPersona,
      activeOrgId: getValidatedActiveOrgId(
        user.personProfile?.memberships.filter((membership) => membership.active) ?? [],
        preference.activeOrgId,
      ),
      lastSwitchedAt: new Date(),
    },
  });

  return fallbackPersona;
}

function getValidatedActiveOrgId(
  activeMemberships: Array<{
    organizationProfile: {
      organizationId: string;
    };
  }>,
  requestedOrgId: string | null,
): string | null {
  if (!requestedOrgId) {
    return null;
  }

  const membership = activeMemberships.find(
    (candidate) => candidate.organizationProfile.organizationId === requestedOrgId,
  );
  return membership?.organizationProfile.organizationId ?? null;
}

async function emitWorkspaceAuditEvent(
  type: 'workspace_created' | 'workspace_switched',
  {
    referenceId,
    organizationId,
    metadata,
  }: {
    referenceId: string;
    organizationId?: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  const hash = sha256ForPayload({
    type,
    referenceId,
    organizationId: organizationId ?? null,
    metadata,
  });

  await prisma.auditEvent.create({
    data: {
      type,
      hash,
      referenceId,
      organizationId,
      metadata: JSON.parse(JSON.stringify(metadata)),
    },
  });
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function clampCompleteness(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

