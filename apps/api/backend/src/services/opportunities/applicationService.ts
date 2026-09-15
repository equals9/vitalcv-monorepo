import { randomUUID } from 'node:crypto';

import { processApplicationBilling } from '../billing/billingEngine';
/**
 * applicationService.ts — Wave 229
 *
 * Clinician ↔ Opportunity application flow.
 *
 * Rules:
 *  - One application per (opportunity, clerkUserId)
 *  - Clinicians can withdraw their own application
 *  - Only the org that owns the opportunity can review/accept/decline
 */

import {
  ApplicationStatus,
  type PersonProfile,
  Prisma,
  PrismaClient,
  type User,
} from '@prisma/client';
import { log } from '../../obs/logger';
import { refreshActionRecommendations } from '../actions/actionEngineService';
import {
  buildHiringTimeline,
  extractHiringAutomationMetadata,
  recommendationPreviewFromMetadata,
  type HiringRecommendationPreview,
  type HiringTimelineEvent,
} from '../actions/hiringAutomationService';
import { parseOrganizationRequirementsEnvelope } from '../employers/pilotPolicy';
import { evaluateIntegratedApply } from './integratedApply';
import {
  computeClinicianTrustState,
  type ClinicianTrustState,
} from '../trust/trustStateEngine';
import { HttpError } from '../../utils/httpError';
import {
  buildFieldEntriesFromTrustState,
  buildSectionAbsencesFromTrustState,
  normalizeDisclosureSelection,
  sealPacket,
  type DisclosureSelection,
  type ApplicationPacketContent,
  type SealedApplicationPacket,
} from './applicationPacketService';
import { resolveDisclosureSections } from './applicationDisclosure';

const prisma = new PrismaClient();
const NPI_RE = /^\d{10}$/;
const HIRING_AUTOMATION_ACTION_TYPES = [
  'READY_TO_INTERVIEW',
  'REQUEST_CREDENTIAL',
  'RISK_ESCALATED',
  'CONTINUE_REVIEW',
] as const;

const applicationWithOpportunity = Prisma.validator<Prisma.ApplicationDefaultArgs>()({
  include: {
    opportunity: {
      select: {
        id: true,
        organizationId: true,
        title: true,
        specialty: true,
        hiringType: true,
        state: true,
        payRange: true,
        status: true,
        organization: {
          select: {
            name: true,
            organizationProfile: {
              select: {
                requirements: true,
              },
            },
          },
        },
      },
    },
  },
});

type ApplicationRecord = Prisma.ApplicationGetPayload<typeof applicationWithOpportunity>;
// No User→PersonProfile relation exists in the schema, so the applicant
// composite is stitched from the two tables (see loadApplicantMap) instead of
// a Prisma `include`, which throws at runtime.
type ApplicantUserRecord = User & { personProfile: PersonProfile | null };

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApplyInput {
  opportunityId: string;
  clerkUserId: string;
  npi?: string;
  coverNote?: string;
  /** Sections the clinician chose to disclose. */
  selectedSections?: string[];
  /**
   * Field ids the clinician withheld inside those sections. Field-level
   * disclosure: withheld fields still appear in the packet, valueless and
   * marked `withheld`, so the reviewer can tell "not shared" from "no such
   * evidence".
   */
  withheldFieldIds?: string[];
  /** Purpose recorded in the packet + consent receipt. */
  purpose?: string;
}

export interface ReviewInput {
  applicationId: string;
  /** clerkUserId of the verifier making the decision */
  reviewerClerkUserId: string;
  status: 'REVIEWED' | 'ACCEPTED' | 'DECLINED';
  reviewNote?: string;
}

export interface ApplicationProviderSummary {
  npi: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  specialty: string | null;
  stateOfPractice: string | null;
}

export interface ApplicationEmployerSummary {
  organizationId: string;
  name: string | null;
}

export interface ApplicationReadinessSummary {
  readinessScore: number;
  readinessLevel: ClinicianTrustState['readiness_level'];
  readinessStatus: string;
  gapSummary: string[];
  keyCredentials: string[];
  trustSignals: string[];
}

export interface MarketplaceApplication {
  id: string;
  opportunityId: string;
  clerkUserId: string;
  npi: string | null;
  coverNote: string | null;
  status: ApplicationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  provider: ApplicationProviderSummary | null;
  employer: ApplicationEmployerSummary;
  readiness: ApplicationReadinessSummary | null;
  latestRecommendation: HiringRecommendationPreview | null;
  timeline: HiringTimelineEvent[];
  systemBehavesAutonomously: boolean;
  opportunity: {
    id: string;
    organizationId: string;
    organizationName: string | null;
    title: string;
    specialty: string;
    hiringType: string;
    state: string;
    payRange: string | null;
    status: string;
  };
}

// ── Create application ────────────────────────────────────────────────────────

/**
 * Seal the disclosure packet for a submission (Seal W0.2).
 *
 * Resolves nothing itself: it takes the ALREADY-resolved evidence set, applies
 * the clinician's section selection, and freezes the result. Everything it
 * writes is immutable data — the packet never rereads mutable state, so it
 * replays forever.
 *
 * Runs INSIDE the submission transaction alongside the consent receipt and
 * audit events, so an application can never exist without its packet, and a
 * packet can never exist without recorded consent.
 */
async function sealSubmissionPacket(
  tx: Prisma.TransactionClient,
  args: {
    applicationId: string;
    packetVersion: number;
    clerkUserId: string;
    clinicianNpi: string;
    opportunityId: string;
    employerOrgId: string;
    recipient: string;
    purpose: string;
    selectedSections: string[];
    /** Field ids withheld inside the selected sections (field-level disclosure). */
    withheldFieldIds?: string[];
    clinicianNote: string | null;
    trustState: ClinicianTrustState;
    consentAt: Date;
    /** The opportunity's updatedAt (ISO) at seal time — what was applied to. */
    opportunityVersion: string;
  },
): Promise<SealedApplicationPacket> {
  // ONE selection object, consumed by preview and seal alike. Passing the
  // section list and the withheld list as two separate arguments is how the
  // two paths drift; this makes them the same value by construction.
  const disclosure: DisclosureSelection = {
    sections: args.selectedSections,
    withheldFieldIds: args.withheldFieldIds ?? [],
  };
  const normalizedDisclosure = normalizeDisclosureSelection(disclosure);
  const fields = buildFieldEntriesFromTrustState(args.trustState, disclosure);
  // Selected sections that produced nothing, recorded explicitly. Built from
  // the SAME selection and field list about to be sealed, so the absences
  // describe exactly this packet and not a later recomputation.
  const sectionAbsences = buildSectionAbsencesFromTrustState(args.trustState, disclosure, fields);
  if (fields.length === 0) {
    throw new HttpError(
      409,
      'No evidence is available to disclose yet. Run a readiness check before applying.',
    );
  }

  // The consent receipt IS a durable audit row — its id becomes the packet's
  // consentReceiptId, so consent can never be a claim with no record behind it.
  const consentReceipt = await tx.auditEvent.create({
    data: {
      type: 'application_consent',
      hash: randomUUID(),
      referenceId: args.applicationId,
      clinicianId: args.clerkUserId,
      organizationId: args.employerOrgId,
      createdAt: args.consentAt,
      metadata: {
        entity_type: 'application',
        action: 'disclosure_consent',
        npi: args.clinicianNpi,
        opportunity_id: args.opportunityId,
        purpose: args.purpose,
        recipient: args.recipient,
        selected_sections: normalizedDisclosure.sections,
        // Consent is to a SPECIFIC disclosure, so the receipt records what was
        // withheld too. Without it the durable consent record cannot answer
        // "consented to disclose what?" — the only question it exists for.
        withheld_field_ids: normalizedDisclosure.withheldFieldIds,
        withheld_field_count: normalizedDisclosure.withheldFieldIds.length,
        field_count: fields.length,
      },
    },
  });

  const content: ApplicationPacketContent = {
    applicationId: args.applicationId,
    packetVersion: args.packetVersion,
    clerkUserId: args.clerkUserId,
    clinicianNpi: args.clinicianNpi,
    opportunityId: args.opportunityId,
    employerOrgId: args.employerOrgId,
    purpose: args.purpose,
    recipient: args.recipient,
    selectedSections: normalizedDisclosure.sections,
    // No parallel withheld list here: `fields` already carries the decision
    // per entry and is hashed. A packet with nothing withheld therefore
    // hashes exactly as it did before field-level disclosure existed.
    fields,
    // ALWAYS set for a new packet, including the empty array — an omitted key
    // would make "every section contributed" indistinguishable from "absence
    // was never computed", which is the silence this record exists to remove.
    sectionAbsences,
    clinicianNote: args.clinicianNote,
    methodologyVersion: args.trustState.methodology_version,
    consentAt: args.consentAt.toISOString(),
    consentReceiptId: consentReceipt.id,
    // What the clinician applied to. Always set for new packets, so it is
    // always covered by the seal hash. (`?? undefined` is defensive: a null
    // would hash differently from an omitted key — see ApplicationPacketContent.)
    opportunityVersion: args.opportunityVersion ?? undefined,
  };
  const sealed = sealPacket(content);

  await tx.applicationPacket.create({
    data: {
      applicationId: sealed.applicationId,
      packetVersion: sealed.packetVersion,
      clerkUserId: sealed.clerkUserId,
      clinicianNpi: sealed.clinicianNpi,
      opportunityId: sealed.opportunityId,
      employerOrgId: sealed.employerOrgId,
      purpose: sealed.purpose,
      recipient: sealed.recipient,
      selectedSections: sealed.selectedSections,
      fields: sealed.fields as unknown as Prisma.InputJsonValue,
      sectionAbsences: (sealed.sectionAbsences ?? []) as unknown as Prisma.InputJsonValue,
      clinicianNote: sealed.clinicianNote,
      methodologyVersion: sealed.methodologyVersion,
      consentAt: new Date(sealed.consentAt),
      consentReceiptId: sealed.consentReceiptId,
      opportunityVersion: sealed.opportunityVersion ?? null,
      packetHash: sealed.packetHash,
    },
  });

  await tx.auditEvent.create({
    data: {
      type: 'application_packet_sealed',
      hash: sealed.packetHash,
      referenceId: args.applicationId,
      clinicianId: args.clerkUserId,
      organizationId: args.employerOrgId,
      metadata: {
        entity_type: 'application_packet',
        action: 'sealed',
        packet_version: sealed.packetVersion,
        packet_hash: sealed.packetHash,
        consent_receipt_id: sealed.consentReceiptId,
        methodology_version: sealed.methodologyVersion,
        field_count: sealed.fields.length,
        // Which selected sections produced nothing — the audit trail records
        // the empty sections, not only the populated ones.
        absent_section_ids: (sealed.sectionAbsences ?? []).map((absence) => absence.sectionId),
      },
    },
  });

  return sealed;
}

/**
 * Submit an application (Seal W0.2) — ONE transaction:
 *
 *   validate identity + opportunity → resolve the current evidence set →
 *   apply the clinician's disclosure selection → build + hash the packet →
 *   persist it immutably → create/attach the application at that packet
 *   version → write the consent receipt → write the audit event →
 *   return the sealed summary.
 *
 * IDEMPOTENT: a retry never produces a second packet. The DB enforces it —
 * `applications(opportunityId, clerkUserId)` is unique, and
 * `application_packets(applicationId, packetVersion)` is unique — so even a
 * concurrent double-submit resolves to one sealed packet rather than relying
 * on a read-then-write check that races.
 *
 * Evidence resolution happens BEFORE the transaction on purpose: it performs
 * network I/O (NPPES et al.) and must not hold a DB transaction open. The
 * resolved state is then frozen inside the transaction — the packet is built
 * from that snapshot, never re-read.
 */
export async function applyToOpportunity(input: ApplyInput): Promise<MarketplaceApplication> {
  const { opportunityId, clerkUserId, npi, coverNote } = input;
  const selectedSections = resolveDisclosureSections(input.selectedSections);
  const purpose = input.purpose ?? 'application';

  // The organization NAME is on the relation, not the opportunity row — and it
  // is what the packet freezes as `recipient`, so the clinician's consent
  // records who they actually disclosed to (a later org rename must never
  // rewrite a sealed packet).
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { organization: { select: { name: true } } },
  });
  if (!opp) throw new HttpError(404, 'Opportunity not found.');
  if (opp.status !== 'ACTIVE') {
    throw new HttpError(409, 'This opportunity is no longer accepting applications.');
  }

  // No User→PersonProfile relation exists in the schema; `include` throws at
  // runtime. Resolve the profile through its userId FK instead.
  const applicant = await prisma.user.findUnique({
    where: { clerkUserId },
  });
  const applicantProfile = applicant
    ? await prisma.personProfile.findUnique({ where: { userId: applicant.id } })
    : null;
  const applicantRecord: ApplicantUserRecord | null = applicant
    ? { ...applicant, personProfile: applicantProfile }
    : null;
  const resolvedNpi = normalizeProvidedNpi(npi) ?? applicantProfile?.npi ?? null;
  if (!resolvedNpi) {
    throw new HttpError(409, 'Complete clinician onboarding before applying with VitalCV.');
  }

  // Fast path: an already-sealed live application is returned as-is. A retry
  // must NEVER reseal — that would recompute evidence and silently replace
  // what the clinician actually disclosed.
  const existing = await prisma.application.findUnique({
    where: { opportunityId_clerkUserId: { opportunityId, clerkUserId } },
    ...applicationWithOpportunity,
  }) as ApplicationRecord | null;
  if (existing && existing.status !== 'WITHDRAWN' && existing.sealedPacketVersion !== null) {
    return hydrateApplication(existing, applicantRecord);
  }

  // Integrated apply is a server-enforced contract, not a rendering choice.
  //
  // The public surfaces already refuse to show "Apply with VitalCV" for a
  // feed-copied row, but the surfaces were the only thing standing there: this
  // service accepted any ACTIVE opportunity. A signed-in card that did not
  // consult applicationMode, or a direct POST, would seal an immutable packet
  // naming the ingestion placeholder organization as the recipient of the
  // clinician's disclosure. Packets are never rewritten, so that consent
  // receipt would misname the receiving party permanently.
  //
  // This sits AFTER the idempotent fast path and BEFORE evidence resolution,
  // deliberately. A clinician who already sealed an application must keep
  // being able to read it back even if the row is later re-stamped as a feed
  // listing — eligibility governs sealing a NEW disclosure, and must never
  // retroactively hide one that was properly made. Nothing about the clinician
  // is computed for a disclosure that cannot be delivered.
  const eligibility = evaluateIntegratedApply({
    listingSource: opp.listingSource,
    organizationName: opp.organization?.name,
  });
  if (!eligibility.eligible) {
    throw new HttpError(409, eligibility.message);
  }

  // Resolve the CURRENT evidence set outside the transaction (network I/O).
  const trustState = await computeClinicianTrustState(resolvedNpi);
  const consentAt = new Date();

  const application = await prisma.$transaction(async (tx) => {
    // Re-read inside the transaction: between the fast path and here, a
    // concurrent submit may have sealed one.
    const current = await tx.application.findUnique({
      where: { opportunityId_clerkUserId: { opportunityId, clerkUserId } },
    });
    if (current && current.status !== 'WITHDRAWN' && current.sealedPacketVersion !== null) {
      return current.id;
    }

    // Reapplying after a withdrawal is a NEW disclosure: the clinician
    // re-consents and a new packet version seals. Prior versions are retained
    // — history is never rewritten.
    const nextVersion = current
      ? (await tx.applicationPacket.count({ where: { applicationId: current.id } })) + 1
      : 1;

    const row = current
      ? await tx.application.update({
          where: { id: current.id },
          data: {
            status: 'PENDING',
            coverNote: coverNote ?? current.coverNote,
            npi: resolvedNpi,
          },
        })
      : await tx.application.create({
          data: {
            opportunityId,
            clerkUserId,
            npi: resolvedNpi,
            coverNote: coverNote ?? null,
            status: 'PENDING',
          },
        });

    const sealed = await sealSubmissionPacket(tx, {
      applicationId: row.id,
      packetVersion: nextVersion,
      clerkUserId,
      clinicianNpi: resolvedNpi,
      opportunityId,
      employerOrgId: opp.organizationId,
      recipient: opp.organization?.name ?? opp.organizationId,
      purpose,
      selectedSections,
      withheldFieldIds: input.withheldFieldIds ?? [],
      clinicianNote: coverNote ?? null,
      trustState,
      consentAt,
      // The version the clinician applied against — the opportunity's updatedAt
      // now, frozen into the seal so the packet records what was on screen even
      // after the listing is later edited.
      opportunityVersion: opp.updatedAt.toISOString(),
    });

    // The application points at the sealed version only after the packet
    // exists — same transaction, so the two can never diverge.
    await tx.application.update({
      where: { id: row.id },
      data: { sealedPacketVersion: sealed.packetVersion },
    });

    await tx.auditEvent.create({
      data: {
        type: 'application_submitted',
        hash: randomUUID(),
        referenceId: row.id,
        clinicianId: clerkUserId,
        organizationId: opp.organizationId,
        metadata: {
          entity_type: 'application',
          action: 'submitted',
          npi: resolvedNpi,
          opportunity_id: opportunityId,
          packet_version: sealed.packetVersion,
          packet_hash: sealed.packetHash,
          consent_receipt_id: sealed.consentReceiptId,
        },
      },
    });

    return row.id;
  });

  const sealedRecord = await prisma.application.findUniqueOrThrow({
    where: { id: application },
    ...applicationWithOpportunity,
  }) as ApplicationRecord;

  return hydrateApplication(sealedRecord, applicantRecord);
}

// ── Clinician: list own applications ─────────────────────────────────────────

export async function listClinicianApplications(
  clerkUserId: string,
): Promise<MarketplaceApplication[]> {
  const applications = await prisma.application.findMany({
    where: { clerkUserId },
    ...applicationWithOpportunity,
    orderBy: { createdAt: 'desc' },
  });

  return hydrateApplications(applications);
}

// ── Clinician: withdraw application ──────────────────────────────────────────

export async function withdrawApplication(
  applicationId: string,
  clerkUserId: string,
): Promise<MarketplaceApplication> {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new HttpError(404, 'Application not found.');
  if (app.clerkUserId !== clerkUserId) throw new HttpError(403, 'Not your application.');
  if (app.status === 'WITHDRAWN') throw new HttpError(409, 'Application is already withdrawn.');
  if (app.status === 'ACCEPTED') throw new HttpError(409, 'Cannot withdraw an accepted application.');

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: 'WITHDRAWN' },
    ...applicationWithOpportunity,
  });

  return hydrateApplication(updated);
}

// ── Verifier: list applications for an opportunity ───────────────────────────

export async function listApplicationsForOpportunity(
  opportunityId: string,
  verifierClerkUserId: string,
): Promise<MarketplaceApplication[]> {
  await assertVerifierOwnsOpportunity(opportunityId, verifierClerkUserId);

  const applications = await prisma.application.findMany({
    where: { opportunityId, status: { not: 'WITHDRAWN' } },
    ...applicationWithOpportunity,
    orderBy: { createdAt: 'asc' },
  });

  return hydrateApplications(applications);
}

// ── Verifier: review application ─────────────────────────────────────────────

export async function reviewApplication(input: ReviewInput): Promise<MarketplaceApplication> {
  const { applicationId, reviewerClerkUserId, status, reviewNote } = input;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { opportunity: true },
  });
  if (!app) throw new HttpError(404, 'Application not found.');
  if (app.status === 'WITHDRAWN') throw new HttpError(409, 'Cannot review a withdrawn application.');

  await assertVerifierOwnsOpportunity(app.opportunityId, reviewerClerkUserId);

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: status as ApplicationStatus,
      reviewedBy: reviewerClerkUserId,
      reviewedAt: new Date(),
      reviewNote: reviewNote ?? null,
    },
    ...applicationWithOpportunity,
  });

  return hydrateApplication(updated);
}

// ── Verifier: list all applications across org's opportunities ────────────────

export async function listAllOrgApplications(
  verifierClerkUserId: string,
): Promise<MarketplaceApplication[]> {
  const org = await getOrgForVerifier(verifierClerkUserId);
  if (!org) return [];

  const applications = await prisma.application.findMany({
    where: {
      opportunity: { organizationId: org.id },
      status: { not: 'WITHDRAWN' },
    },
    ...applicationWithOpportunity,
    orderBy: { createdAt: 'desc' },
  });

  return hydrateApplications(applications);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeProvidedNpi(npi?: string): string | null {
  if (!npi) {
    return null;
  }

  const normalized = npi.trim();
  if (!normalized) {
    return null;
  }

  if (!NPI_RE.test(normalized)) {
    throw new HttpError(400, 'npi must be exactly 10 digits.');
  }

  return normalized;
}

function formatFactLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

function buildProviderSummary(
  application: ApplicationRecord,
  applicant: ApplicantUserRecord | null,
): ApplicationProviderSummary | null {
  const profile = applicant?.personProfile;
  const providerNpi = application.npi ?? profile?.npi ?? null;
  if (!providerNpi && !profile) {
    return null;
  }

  const firstName = profile?.firstName ?? null;
  const lastName = profile?.lastName ?? null;
  const fullName = [firstName, lastName].filter((part): part is string => Boolean(part)).join(' ').trim() || null;

  return {
    npi: providerNpi,
    fullName,
    firstName,
    lastName,
    specialty: profile?.specialty ?? null,
    stateOfPractice: profile?.stateOfPractice ?? null,
  };
}

function buildReadinessSummary(
  trustState: ClinicianTrustState,
): ApplicationReadinessSummary {
  const keyCredentials = trustState.facts
    .filter((fact) => {
      const normalizedStatus = fact.status.toLowerCase();
      return normalizedStatus === 'verified'
        || normalizedStatus === 'active'
        || normalizedStatus === 'clear';
    })
    .map((fact) => formatFactLabel(fact.factType))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 4);

  const trustSignals = [
    trustState.identityVerified ? 'NPI identity verified' : null,
    trustState.licensureStatus === 'verified' ? 'State licensure verified' : null,
    trustState.exclusionClear ? 'Sanctions clear' : null,
    trustState.credentialCount > 0 ? `${trustState.credentialCount} credential artifacts on file` : null,
    trustState.gap_summary[0] ?? null,
  ].filter((signal): signal is string => Boolean(signal)).slice(0, 4);

  return {
    readinessScore: trustState.readiness_score,
    readinessLevel: trustState.readiness_level,
    readinessStatus: trustState.readiness_status,
    gapSummary: trustState.gap_summary,
    keyCredentials,
    trustSignals,
  };
}

function employerAcceptanceKey(organizationId: string, clinicianNpi: string): string {
  return `${organizationId}:${clinicianNpi}`;
}

function automationEnabledForApplication(application: ApplicationRecord): boolean {
  const requirements = application.opportunity.organization.organizationProfile?.requirements;
  const envelope = parseOrganizationRequirementsEnvelope(requirements, []);
  return envelope.automationRules.enabled;
}

function systemBehavesAutonomously(
  application: ApplicationRecord,
  latestRecommendation: HiringRecommendationPreview | null,
): boolean {
  if (!automationEnabledForApplication(application) || !latestRecommendation) {
    return false;
  }

  return latestRecommendation.autoGenerated
    || latestRecommendation.workflowEffects.employerNotification
    || latestRecommendation.workflowEffects.clinicianRequest
    || latestRecommendation.workflowEffects.webhookEligible
    || latestRecommendation.workflowEffects.webhookQueued;
}

async function refreshHiringAutonomyState(): Promise<void> {
  try {
    await refreshActionRecommendations(new Date().toISOString(), prisma);
  } catch (error) {
    log('warn', 'applications: hiring_action_refresh_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function loadLatestRecommendationMap(
  applications: readonly ApplicationRecord[],
): Promise<Map<string, HiringRecommendationPreview>> {
  const applicationIds = new Set(applications.map((application) => application.id));
  const providerNpis = [...new Set(applications
    .map((application) => application.npi)
    .filter((npi): npi is string => Boolean(npi)))];

  if (applicationIds.size === 0 || providerNpis.length === 0) {
    return new Map();
  }

  const rows = await prisma.actionRecommendation.findMany({
    where: {
      actionType: {
        in: [...HIRING_AUTOMATION_ACTION_TYPES],
      },
      targetEntityId: {
        in: providerNpis,
      },
    },
    select: {
      actionType: true,
      explanation: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  const latestByApplicationId = new Map<string, HiringRecommendationPreview>();
  for (const row of rows) {
    const automationMetadata = extractHiringAutomationMetadata(row.metadata);
    if (!automationMetadata || !applicationIds.has(automationMetadata.applicationId)) {
      continue;
    }

    if (latestByApplicationId.has(automationMetadata.applicationId)) {
      continue;
    }

    const preview = recommendationPreviewFromMetadata(
      row.metadata,
      row.actionType,
      row.explanation,
      row.updatedAt.toISOString(),
    );
    if (!preview) {
      continue;
    }

    latestByApplicationId.set(automationMetadata.applicationId, preview);
  }

  return latestByApplicationId;
}

async function loadEmployerAcceptanceMap(
  applications: readonly ApplicationRecord[],
): Promise<Map<string, string>> {
  const providerNpis = [...new Set(applications
    .map((application) => application.npi)
    .filter((npi): npi is string => Boolean(npi)))];
  const organizationIds = [...new Set(applications.map((application) => application.opportunity.organizationId))];

  if (providerNpis.length === 0 || organizationIds.length === 0) {
    return new Map();
  }

  const acceptances = await prisma.employerAcceptance.findMany({
    where: {
      employerId: {
        in: organizationIds,
      },
      clinicianNpi: {
        in: providerNpis,
      },
      status: 'ACCEPTED',
    },
    select: {
      employerId: true,
      clinicianNpi: true,
      acceptedAt: true,
    },
    orderBy: {
      acceptedAt: 'desc',
    },
  });

  const acceptanceMap = new Map<string, string>();
  for (const acceptance of acceptances) {
    // The `in` filters above cannot match NULL; guards only narrow the types.
    if (!acceptance.employerId || !acceptance.clinicianNpi) continue;
    const key = employerAcceptanceKey(acceptance.employerId, acceptance.clinicianNpi);
    if (!acceptanceMap.has(key)) {
      acceptanceMap.set(key, acceptance.acceptedAt.toISOString());
    }
  }

  return acceptanceMap;
}

async function loadApplicantMap(
  applications: readonly ApplicationRecord[],
): Promise<Map<string, ApplicantUserRecord>> {
  const clerkUserIds = [...new Set(applications.map((application) => application.clerkUserId))];
  if (clerkUserIds.length === 0) {
    return new Map();
  }

  const applicants = await prisma.user.findMany({
    where: {
      clerkUserId: {
        in: clerkUserIds,
      },
    },
  });
  const profiles = applicants.length > 0
    ? await prisma.personProfile.findMany({
        where: { userId: { in: applicants.map((applicant) => applicant.id) } },
      })
    : [];
  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));

  return new Map(applicants.map((applicant) => [
    applicant.clerkUserId,
    { ...applicant, personProfile: profileByUserId.get(applicant.id) ?? null },
  ]));
}

async function loadTrustStateMap(
  applications: readonly ApplicationRecord[],
  applicants: Map<string, ApplicantUserRecord>,
): Promise<Map<string, ClinicianTrustState | null>> {
  const npis = [...new Set(applications
    .map((application) => application.npi ?? applicants.get(application.clerkUserId)?.personProfile?.npi ?? null)
    .filter((npi): npi is string => Boolean(npi)))];

  const entries = await Promise.all(npis.map(async (npi) => {
    try {
      const trustState = await computeClinicianTrustState(npi);
      return [npi, trustState] as const;
    } catch {
      return [npi, null] as const;
    }
  }));

  return new Map(entries);
}

async function hydrateApplications(
  applications: readonly ApplicationRecord[],
): Promise<MarketplaceApplication[]> {
  await refreshHiringAutonomyState();
  const applicants = await loadApplicantMap(applications);
  const [trustStates, latestRecommendations, employerAcceptances] = await Promise.all([
    loadTrustStateMap(applications, applicants),
    loadLatestRecommendationMap(applications),
    loadEmployerAcceptanceMap(applications),
  ]);

  return applications.map((application) => {
    const applicant = applicants.get(application.clerkUserId) ?? null;
    const provider = buildProviderSummary(application, applicant);
    const providerNpi = provider?.npi ?? null;
    const readiness = providerNpi
      ? trustStates.get(providerNpi)
      : null;
    const latestRecommendation = latestRecommendations.get(application.id) ?? null;
    const acceptedAt = providerNpi
      ? employerAcceptances.get(employerAcceptanceKey(application.opportunity.organizationId, providerNpi)) ?? null
      : null;

    return {
      id: application.id,
      opportunityId: application.opportunityId,
      clerkUserId: application.clerkUserId,
      npi: application.npi ?? providerNpi,
      coverNote: application.coverNote ?? null,
      status: application.status,
      reviewedBy: application.reviewedBy ?? null,
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
      reviewNote: application.reviewNote ?? null,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      provider,
      employer: {
        organizationId: application.opportunity.organizationId,
        name: application.opportunity.organization.name ?? null,
      },
      readiness: readiness ? buildReadinessSummary(readiness) : null,
      latestRecommendation,
      timeline: buildHiringTimeline({
        status: application.status,
        createdAt: application.createdAt.toISOString(),
        reviewedAt: application.reviewedAt?.toISOString() ?? null,
        updatedAt: application.updatedAt.toISOString(),
        latestRecommendation,
        acceptedAt,
      }),
      systemBehavesAutonomously: systemBehavesAutonomously(application, latestRecommendation),
      opportunity: {
        id: application.opportunity.id,
        organizationId: application.opportunity.organizationId,
        organizationName: application.opportunity.organization.name ?? null,
        title: application.opportunity.title,
        specialty: application.opportunity.specialty,
        hiringType: application.opportunity.hiringType,
        state: application.opportunity.state,
        payRange: application.opportunity.payRange ?? null,
        status: application.opportunity.status,
      },
    };
  });
}

async function hydrateApplication(
  application: ApplicationRecord,
  applicant?: ApplicantUserRecord | null,
): Promise<MarketplaceApplication> {
  if (applicant) {
    await refreshHiringAutonomyState();
    const [trustStates, latestRecommendations, employerAcceptances] = await Promise.all([
      loadTrustStateMap([application], new Map([[application.clerkUserId, applicant]])),
      loadLatestRecommendationMap([application]),
      loadEmployerAcceptanceMap([application]),
    ]);
    const provider = buildProviderSummary(application, applicant);
    const readiness = provider?.npi ? trustStates.get(provider.npi) ?? null : null;
    const latestRecommendation = latestRecommendations.get(application.id) ?? null;
    const acceptedAt = provider?.npi
      ? employerAcceptances.get(employerAcceptanceKey(application.opportunity.organizationId, provider.npi)) ?? null
      : null;

    return {
      id: application.id,
      opportunityId: application.opportunityId,
      clerkUserId: application.clerkUserId,
      npi: application.npi ?? provider?.npi ?? null,
      coverNote: application.coverNote ?? null,
      status: application.status,
      reviewedBy: application.reviewedBy ?? null,
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
      reviewNote: application.reviewNote ?? null,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      provider,
      employer: {
        organizationId: application.opportunity.organizationId,
        name: application.opportunity.organization.name ?? null,
      },
      readiness: readiness ? buildReadinessSummary(readiness) : null,
      latestRecommendation,
      timeline: buildHiringTimeline({
        status: application.status,
        createdAt: application.createdAt.toISOString(),
        reviewedAt: application.reviewedAt?.toISOString() ?? null,
        updatedAt: application.updatedAt.toISOString(),
        latestRecommendation,
        acceptedAt,
      }),
      systemBehavesAutonomously: systemBehavesAutonomously(application, latestRecommendation),
      opportunity: {
        id: application.opportunity.id,
        organizationId: application.opportunity.organizationId,
        organizationName: application.opportunity.organization.name ?? null,
        title: application.opportunity.title,
        specialty: application.opportunity.specialty,
        hiringType: application.opportunity.hiringType,
        state: application.opportunity.state,
        payRange: application.opportunity.payRange ?? null,
        status: application.opportunity.status,
      },
    };
  }

  const [hydrated] = await hydrateApplications([application]);
  return hydrated;
}

async function getOrgForVerifier(clerkUserId: string) {
  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user?.organizationId) return null;
  return prisma.organization.findUnique({ where: { id: user.organizationId } });
}

async function assertVerifierOwnsOpportunity(opportunityId: string, clerkUserId: string) {
  const org = await getOrgForVerifier(clerkUserId);
  if (!org) throw new HttpError(403, 'No organization associated with this user.');

  const opp = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
  if (!opp) throw new HttpError(404, 'Opportunity not found.');
  if (opp.organizationId !== org.id) {
    throw new HttpError(403, 'This opportunity does not belong to your organization.');
  }
}
