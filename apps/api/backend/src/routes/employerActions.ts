/**
 * employerActions.ts — M2: Accept with Confidence
 *
 * Employer-facing action routes for the review/[entityId] workflow.
 * Auth: mutations (accept, request-refresh, route-to-review, batch,
 * share-packet, confirm-start) and the org-scoped queue read require a
 * VERIFIED Clerk session (`requireVerifiedClerkUserId` — the bearer-verified
 * identity set by verifiedIdentityMiddleware; the forgeable x-clerk-user-id
 * header alone is rejected in every CLERK_JWT_VERIFICATION mode). Every
 * mutation additionally requires an ACTIVE organisation membership with a
 * reviewer-grade role (`resolveEmployerReviewMembership`) — this gate is not
 * mode-gated and refuses with 403 before any row is written. The
 * remaining reads (status, packet) still accept the legacy header; the
 * public reads (acceptance-history, share-token, refresh-requests) take none.
 *
 * Routes:
 *   POST /api/employer-review/:entityId/accept          — Accept as head start
 *   POST /api/employer-review/:entityId/request-refresh — Request missing/stale data
 *   POST /api/employer-review/:entityId/route-to-review — Route to manual review queue
 *   GET  /api/employer-review/:entityId/packet          — Evidence packet export
 *
 * AUDIT CONTRACT
 * ─────────────
 * Every mutating action writes an AuditEvent row in a transaction BEFORE
 * returning 2xx. No action can succeed silently.
 *
 * Packet export is treated as a trust-distribution event and always writes an
 * audit record before returning the bundle.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { HttpError } from '../utils/httpError';
import { sha256ForPayload } from '../utils/deterministic';
import { env } from '../config/env';
import { decideEmployerActionRbac } from '../services/authz/employerActionRbac';
import { resolveEmployerReviewMembership } from '../services/authz/employerReviewMembership';
import {
  captureEmployerDecision,
  captureStartOutcome,
} from '../services/seal/sealEventCapture';
import { emitLearningEvent } from '../services/feedback/prismaEventStore';
import { captureDecisionSignal } from '../services/feedback/decisionSignalService';
import { buildPassport } from '../services/entity/passportService';
import { buildEmployerEvidencePacket } from '../services/entity/employerPacket';
import { createEmployerEvidencePacketZipStream } from '../services/entity/employerPacketExport';
import { confirmStartByAcceptance } from '../services/activation/applicationStartCommandService';
import { issueTrustContainerManifestEntry } from '../services/trust/container/trustContainerIssuance';
import { toTrustContainerAuditMetadata } from '../services/trust/container/trustContainerManifest';
import { requireVerifiedClerkUserId } from '../middleware/verifiedActor';
import {
  loadEmployerAcceptanceHistory,
  loadEmployerReviewStatus,
  recordEmployerReviewAcceptance,
  recordEmployerReviewRefreshRequest,
  recordEmployerReviewRouting,
  resolveEmployerReviewSubject,
  resolveEmployerReviewSubjectByNpi,
  resolveReviewerAcceptanceIdentity,
  type EmployerReviewActionState,
} from '../services/entity/employerReviewActions';
import { evaluatePacketAcceptance } from '../services/entity/packetAcceptanceGuard';
import { buildAcceptanceSourceSnapshot } from '../services/entity/acceptanceSourceSnapshot';
import { resolveEmployerReviewAttribution } from '../services/entity/employerReviewAttribution';
import { getCachedTrustState } from '../services/trust/trustStateEngine';
import { getOrgProfile } from '../services/opportunities/opportunityService';
import {
  buildRuntimeMutationMetadata,
  type RuntimeReadonlyIndicator,
  type RuntimeTrustMetadata,
} from '../services/runtimeTrustCohesion';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

/**
 * Extract the LEGACY Clerk user ID header or throw 401.
 *
 * Read-only surfaces only (status, packet). Every mutating action and the
 * org-scoped queue read authenticate via `requireVerifiedClerkUserId`
 * instead — the raw x-clerk-user-id header is browser-forgeable and must
 * never authorize a write.
 */
function requireClerkUserId(req: Request): string {
  const id = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
}

// VcvEntity.id is a Postgres uuid column — querying it with a non-uuid string
// makes Prisma throw (a 500) instead of returning null.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolvePacketExportFormat(req: Request): 'json' | 'zip' {
  const queryFormat = typeof req.query.format === 'string'
    ? req.query.format.trim().toLowerCase()
    : null;

  if (queryFormat && queryFormat !== 'json' && queryFormat !== 'zip') {
    throw new HttpError(400, 'format must be either json or zip.');
  }

  if (queryFormat === 'zip') {
    return 'zip';
  }
  if (queryFormat === 'json') {
    return 'json';
  }

  return (req.get('accept') ?? '').includes('application/zip') ? 'zip' : 'json';
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function resolveCorrelationId(req: Request): string {
  const candidate = req.get('x-correlation-id')?.trim();
  return candidate && candidate.length <= 120 ? candidate : randomUUID();
}

function resolveReadonlyIndicator(req: Request): RuntimeReadonlyIndicator {
  const role = req.get('x-verifier-team-role')?.trim().toLowerCase();
  if (role === 'readonly') {
    return {
      attemptedByReadonly: true,
      source: 'x-verifier-team-role',
    };
  }
  return {
    attemptedByReadonly: false,
    source: null,
  };
}

function runtimeFields(metadata: RuntimeTrustMetadata): Record<string, unknown> {
  return {
    correlationId: metadata.correlationId,
    mutationFingerprint: metadata.mutationFingerprint,
    actor: metadata.actor,
    mutationClassification: metadata.mutationClassification,
    replayCategory: metadata.replayCategory,
    payloadHash: metadata.payloadHash,
    runtimeTrust: metadata,
  };
}

async function writeDeniedEmployerReviewMutation(input: {
  req: Request;
  actorId: string;
  entityId: string;
  clinicianNpi: string;
  denialReason: string;
  payload?: unknown;
}): Promise<void> {
  const runtimeTrust = buildRuntimeMutationMetadata({
    action: 'denied-mutation',
    actorId: input.actorId,
    entityId: input.entityId,
    clinicianNpi: input.clinicianNpi,
    correlationId: resolveCorrelationId(input.req),
    payload: input.payload ?? { denialReason: input.denialReason },
    outcome: 'denied',
    denialReason: input.denialReason,
    readonly: resolveReadonlyIndicator(input.req),
  });
  const metadata = {
    schema: 'vitalcv.employer-review.denied-mutation.v1',
    entityId: input.entityId,
    clinicianNpi: input.clinicianNpi,
    denialReason: input.denialReason,
    ...runtimeFields(runtimeTrust),
  };

  await prisma.auditEvent.create({
    data: {
      id: randomUUID(),
      type: 'EMPLOYER_REVIEW_MUTATION_DENIED',
      hash: sha256ForPayload({
        type: 'EMPLOYER_REVIEW_MUTATION_DENIED',
        referenceId: input.entityId,
        runtimeTrust,
      }),
      referenceId: input.entityId,
      clinicianId: input.clinicianNpi,
      anchored: false,
      metadata: toJsonValue(metadata),
    },
  });

  log('warn', 'employer_review_mutation_denied', {
    entityId: input.entityId,
    actorId: input.actorId,
    denialReason: input.denialReason,
    correlationId: runtimeTrust.correlationId,
    mutationFingerprint: runtimeTrust.mutationFingerprint,
    mutationClassification: runtimeTrust.mutationClassification,
    replayCategory: runtimeTrust.replayCategory,
    readonly: runtimeTrust.readonly,
  });
}

// ── Organisation membership (W0-15) + RBAC (Wave B) on employer-review
// mutations ────────────────────────────────────────────────────────────────
// Two gates, in order:
//
// 1. Membership — ALWAYS enforced. The caller must hold an active
//    reviewer-grade membership in the organisation their User row is bound
//    to (resolved from server-side rows only). Without it the mutation is
//    refused with 403 after the standard denied-mutation AuditEvent, in every
//    RBAC mode. A signed-in clinician has no such membership.
//
// 2. Platform-role RBAC — roles come from the User table (clerkUserId →
//    role/status), never from caller-supplied headers like
//    x-verifier-team-role. VERIFIER_RBAC_ENFORCED false = shadow mode:
//    would-deny decisions are logged but never block. Enforced mode writes
//    the standard denied-mutation AuditEvent before 403.
export const EMPLOYER_REVIEW_MEMBERSHIP_REQUIRED_MESSAGE =
  'Employer-review actions require an active organization membership with a reviewer role.';

async function enforceEmployerMutationRbac(input: {
  req: Request;
  employerId: string;
  entityId: string;
  clinicianNpi: string;
  action: 'accept' | 'request-refresh' | 'route-to-review' | 'share-packet' | 'confirm-start';
}): Promise<void> {
  const membership = await resolveEmployerReviewMembership(input.employerId);
  if (!membership) {
    await writeDeniedEmployerReviewMutation({
      req: input.req,
      actorId: input.employerId,
      entityId: input.entityId,
      clinicianNpi: input.clinicianNpi,
      denialReason: 'organization_membership_required',
      payload: {
        action: input.action,
        enforcement: 'membership',
      },
    });
    throw new HttpError(403, EMPLOYER_REVIEW_MEMBERSHIP_REQUIRED_MESSAGE);
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: input.employerId },
    select: { role: true, status: true },
  });
  const decision = decideEmployerActionRbac(user);
  if (decision.allowed) return;

  if (!env().VERIFIER_RBAC_ENFORCED) {
    log('warn', 'employer_rbac_shadow_would_deny', {
      action: input.action,
      entityId: input.entityId,
      actorId: input.employerId,
      denialReason: decision.denialReason,
      resolvedRole: decision.resolvedRole,
      enforcement: 'shadow',
    });
    return;
  }

  await writeDeniedEmployerReviewMutation({
    req: input.req,
    actorId: input.employerId,
    entityId: input.entityId,
    clinicianNpi: input.clinicianNpi,
    denialReason: decision.denialReason ?? 'rbac_denied',
    payload: {
      action: input.action,
      resolvedRole: decision.resolvedRole,
      enforcement: 'rbac',
    },
  });
  throw new HttpError(403, 'Employer-review mutations require an active verifier-role account.');
}

const SHARE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const SHARE_TOKEN_PATTERN = /^chk_[A-Za-z0-9_-]{43}$/;

function buildShareToken(): string {
  return `chk_${randomBytes(32).toString('base64url')}`;
}

function hashShareToken(token: string): string {
  return sha256ForPayload({
    schema: 'vitalcv.employer.share-token-hash.v1',
    token,
  });
}

function resolveAppOrigin(): string {
  const configured =
    process.env.APP_ORIGIN
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? process.env.WEB_ORIGIN
    ?? 'https://app.vitalcv.com';

  try {
    const url = new URL(configured);
    return url.origin;
  } catch {
    return 'https://app.vitalcv.com';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function buildEmployerDecisionMetadata(input: {
  attribution: {
    organizationContextId: string | null;
    bundleShareEventId: string | null;
    bundleId: string | null;
    organizationId: string | null;
    organizationName: string | null;
    purposeOfUse: string | null;
  };
  scopeSource?: Record<string, unknown> | null;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const scopeSource = input.scopeSource ?? {};

  return {
    eventName: 'employer_decision_recorded',
    organizationContextId: input.attribution.organizationContextId ?? null,
    bundleShareEventId: input.attribution.bundleShareEventId ?? null,
    bundleId: input.attribution.bundleId ?? null,
    organizationId: input.attribution.organizationId ?? null,
    organizationName: input.attribution.organizationName ?? null,
    purposeOfUse: input.attribution.purposeOfUse ?? null,
    pilotId: readOptionalString(scopeSource.pilotId),
    workflowLane: readOptionalString(scopeSource.workflowLane),
    geographyTag: readOptionalString(scopeSource.geographyTag),
    ...(input.extra ?? {}),
  };
}

// ── Route registration ─────────────────────────────────────────────────────

export function registerEmployerActionRoutes(app: Express): void {

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/employer-review/:entityId/accept
  // Accept as head start — creates EmployerAcceptance + mandatory audit event.
  // Returns: { ok, actionId, acceptanceId, auditEventId, timestamp }
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/api/employer-review/:entityId/accept',
    asyncHandler(async (req, res) => {
      const employerId = requireVerifiedClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found or has no NPI.`);

      await enforceEmployerMutationRbac({
        req, employerId, entityId, clinicianNpi: subject.clinicianNpi, action: 'accept',
      });

      // Guard: no duplicate open acceptances. Checked against BOTH ids that
      // may occupy employerId — the reviewer's organization id (ADR 0007
      // semantics) and their Clerk user id (legacy rows) — so the semantic
      // convergence cannot mint duplicates. With org semantics, a second
      // reviewer in the same organization now correctly 409s here.
      const reviewer = await resolveReviewerAcceptanceIdentity(employerId);
      const existing = await prisma.employerAcceptance.findFirst({
        where:  {
          employerId: { in: reviewer.acceptanceEmployerIds },
          clinicianNpi: subject.clinicianNpi,
          status: 'ACCEPTED',
        },
        select: { id: true },
      });
      if (existing) {
        await writeDeniedEmployerReviewMutation({
          req,
          actorId: employerId,
          entityId,
          clinicianNpi: subject.clinicianNpi,
          denialReason: 'already_accepted',
          payload: {
            body: req.body ?? {},
            existingAcceptanceId: existing.id,
          },
        });
        return void res.status(409).json({
          error:             'already_accepted',
          error_description: 'An active acceptance already exists for this employer/NPI pair.',
          acceptanceId:      existing.id,
        });
      }

      // ── Source coverage gate ────────────────────────────────────────
      // Validate that the passport is not BLOCKED at the moment of acceptance.
      // An employer must not accept a clinician whose spine sources are
      // not in a decision-grade state.
      const passport = await buildPassport(entityId);
      if (!passport) {
        await writeDeniedEmployerReviewMutation({
          req,
          actorId: employerId,
          entityId,
          clinicianNpi: subject.clinicianNpi,
          denialReason: 'passport_unavailable',
          payload: req.body ?? {},
        });
        throw new HttpError(422, 'Cannot accept: passport data is not available for this entity.');
      }
      if (passport.decisionPosture.status === 'BLOCKED') {
        await writeDeniedEmployerReviewMutation({
          req,
          actorId: employerId,
          entityId,
          clinicianNpi: subject.clinicianNpi,
          denialReason: 'acceptance_blocked',
          payload: {
            body: req.body ?? {},
            blockers: passport.decisionPosture.blockers,
            missingSources: passport.decisionPosture.missing.map((s) => s.sourceId),
          },
        });
        return void res.status(422).json({
          error: 'acceptance_blocked',
          error_description: 'Cannot accept: one or more critical source checks are blocking readiness.',
          blockers: passport.decisionPosture.blockers,
          missingSources: passport.decisionPosture.missing.map((s) => s.sourceId),
        });
      }

      const { role, facility, notes } = (req.body ?? {}) as {
        role?:     string;
        facility?: string;
        notes?:    string;
        acceptanceScope?: string;
        acceptanceReason?: string;
        organizationContextId?: string;
        bundleId?: string;
        applicationId?: string;
        packetHash?: string;
      };

      // ACT-1.2 — when the reviewer accepts BY application (passing the
      // applicationId + the packetHash they reviewed), verify BEFORE recording
      // that the packet is about the clinician under review, belongs to the
      // org the reviewer is acting for (when a review context resolves one),
      // still matches the reviewed hash, and is not revoked. This ties the
      // acceptance to exactly the evidence reviewed and fails closed on a
      // foreign, changed, or revoked packet. Absent → the legacy NPI-keyed
      // path, unchanged.
      const applicationId = typeof req.body?.applicationId === 'string' ? req.body.applicationId.trim() : '';
      const claimedPacketHash = typeof req.body?.packetHash === 'string' ? req.body.packetHash.trim() : '';
      let linkage: { applicationId: string; packetHash: string } | undefined;
      if (applicationId) {
        if (!claimedPacketHash) {
          throw new HttpError(400, 'packetHash is required when accepting by applicationId.');
        }
        // The only modeled "reviewer's org" at this boundary is the persisted
        // review context (org context / bundle share) the accept is scoped to;
        // recordEmployerReviewAcceptance re-resolves the same context for
        // attribution. Unscoped accepts have no org to compare — the subject
        // (NPI) check below still always runs.
        const reviewerAttribution = await resolveEmployerReviewAttribution({
          entityId,
          organizationContextId: req.body?.organizationContextId,
          bundleId: req.body?.bundleId,
        });
        const packetRow = await prisma.applicationPacket.findFirst({
          where: { applicationId },
          orderBy: { packetVersion: 'desc' },
          select: { packetHash: true, packetVersion: true, opportunityVersion: true, clinicianNpi: true, employerOrgId: true, revokedAt: true, supersededByPacketId: true },
        });
        const verdict = evaluatePacketAcceptance(
          claimedPacketHash,
          packetRow
            ? {
                applicationId,
                packetHash: packetRow.packetHash,
                packetVersion: packetRow.packetVersion,
                opportunityVersion: packetRow.opportunityVersion ?? null,
                clinicianNpi: packetRow.clinicianNpi,
                employerOrgId: packetRow.employerOrgId,
                revokedAt: packetRow.revokedAt ? packetRow.revokedAt.toISOString() : null,
                supersededByPacketId: packetRow.supersededByPacketId ?? null,
              }
            : null,
          {
            clinicianNpi: subject.clinicianNpi,
            employerOrgId: reviewerAttribution.organizationId,
          },
        );
        if (!verdict.ok) {
          await writeDeniedEmployerReviewMutation({
            req,
            actorId: employerId,
            entityId,
            clinicianNpi: subject.clinicianNpi,
            denialReason: verdict.reason,
            payload: {
              applicationId,
              claimedPacketHash,
              reviewerOrgId: reviewerAttribution.organizationId ?? null,
            },
          });
          throw new HttpError(409, `Cannot accept this packet: ${verdict.reason}.`);
        }
        linkage = { applicationId, packetHash: verdict.packetHash };
      }

      const state = await recordEmployerReviewAcceptance({
        entityId,
        employerId,
        clinicianNpi: subject.clinicianNpi,
        correlationId: resolveCorrelationId(req),
        organizationContextId: req.body?.organizationContextId,
        bundleId: req.body?.bundleId,
        role,
        facility,
        notes,
        acceptanceScope: req.body?.acceptanceScope,
        acceptanceReason: req.body?.acceptanceReason,
        applicationId: linkage?.applicationId,
        packetHash: linkage?.packetHash,
        // Freeze the source coverage the reviewer saw at this moment — the
        // "what changed since you accepted" diff replays against this.
        acceptedSourceSnapshot: buildAcceptanceSourceSnapshot(passport.sourceCoverage?.checks),
      });

      log('info', 'employer_review_accepted', {
        acceptanceId:  state.persistence.acceptanceId,
        auditEventId:  state.auditEventId,
        entityId,
        employerId,
        npi_prefix:    subject.clinicianNpi.slice(0, 4) + '····',
      });

      // SEAL: fire-and-forget employer decision signal with full trust snapshot
      const snap = state.trustSnapshot;
      void captureEmployerDecision({
        entityId,
        organizationContextId: state.attribution.organizationContextId,
        decision:                'PROCEED',
        reviewerRole:            'EMPLOYER',
        auditEventId:            state.auditEventId,
        trustSnapshotAtDecision: {
          acceptanceId:          state.persistence.acceptanceId,
          readinessStatus:       snap?.readinessStatus,
          readinessScore:        snap?.readinessScore,
          trustBand:             snap?.trustBand,
          trustScore:            snap?.trustScore,
          blockerCount:          snap?.blockerCount,
          exclusionStatus:       snap?.exclusionStatus,
          verifiedCredentials:   snap?.verifiedCredentialCount,
          staleCredentials:      snap?.staleCredentialCount,
          snapshotHash:          snap?.snapshotHash,
        },
        readinessScoreAtDecision: snap?.readinessScore ?? null,
        blockersAtDecision:      snap?.topBlockers ?? [],
        metadata:                buildEmployerDecisionMetadata({
          attribution: state.attribution,
          scopeSource: req.body ?? null,
          extra: {
            acceptedByOrgId: state.acceptance?.acceptedByOrgId ?? null,
            acceptanceScope: state.acceptance?.acceptanceScope ?? null,
            acceptanceReason: state.acceptance?.acceptanceReason ?? null,
            role: role ?? null,
            facility: facility ?? null,
          },
        }),
      });

      // Learning: capture accept decision signal + trigger boost recomputation
      void captureDecisionSignal({
        entityId,
        employerId,
        decision: 'accept',
        trustSnapshot: snap ? {
          readinessStatus: snap.readinessStatus,
          readinessScore: snap.readinessScore,
          trustBand: snap.trustBand,
          trustScore: snap.trustScore,
          blockerCount: snap.blockerCount,
          topBlockers: snap.topBlockers,
          exclusionStatus: snap.exclusionStatus,
          verifiedCredentialCount: snap.verifiedCredentialCount,
          staleCredentialCount: snap.staleCredentialCount,
          snapshotHash: snap.snapshotHash,
        } : null,
        bundleId: state.attribution.bundleId,
      });

      return void res.status(201).json({ ok: true, state });
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/employer-review/:entityId/request-refresh
  // Request the clinician refresh stale or missing data.
  // Writes audit event. Future: triggers clinician notification.
  // Returns: { ok, actionId, auditEventId, staleSources[], timestamp }
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/api/employer-review/:entityId/request-refresh',
    asyncHandler(async (req, res) => {
      const employerId = requireVerifiedClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found.`);

      await enforceEmployerMutationRbac({
        req, employerId, entityId, clinicianNpi: subject.clinicianNpi, action: 'request-refresh',
      });

      const { staleSources, missingDomains, message } = (req.body ?? {}) as {
        staleSources?:    string[];
        missingDomains?:  string[];
        message?:         string;
        organizationContextId?: string;
        bundleId?: string;
      };
      const state = await recordEmployerReviewRefreshRequest({
        entityId,
        employerId,
        clinicianNpi: subject.clinicianNpi,
        correlationId: resolveCorrelationId(req),
        organizationContextId: req.body?.organizationContextId,
        bundleId: req.body?.bundleId,
        staleSources,
        missingDomains,
        message,
      });

      log('info', 'employer_review_refresh_requested', {
        auditEventId: state.auditEventId,
        entityId,
        employerId,
        npi_prefix:    subject.clinicianNpi.slice(0, 4) + '····',
        staleSources:  state.details.staleSources,
        missingDomains: state.details.missingDomains,
      });

      // SEAL: fire-and-forget refresh request decision with full trust snapshot
      const snap = state.trustSnapshot;
      void captureEmployerDecision({
        entityId,
        organizationContextId: state.attribution.organizationContextId,
        decision: 'REQUEST_REFRESH',
        reviewerRole: 'EMPLOYER',
        auditEventId: state.auditEventId,
        trustSnapshotAtDecision: {
          staleSources: state.details.staleSources,
          missingDomains: state.details.missingDomains,
          readinessStatus: snap?.readinessStatus,
          readinessScore: snap?.readinessScore,
          trustBand: snap?.trustBand,
          trustScore: snap?.trustScore,
          blockerCount: snap?.blockerCount,
          topBlockers: snap?.topBlockers,
          exclusionStatus: snap?.exclusionStatus,
          snapshotHash: snap?.snapshotHash,
        },
        readinessScoreAtDecision: snap?.readinessScore ?? null,
        blockersAtDecision: [...new Set([
          ...(snap?.topBlockers ?? []),
          ...state.details.missingDomains,
        ])],
        metadata: buildEmployerDecisionMetadata({
          attribution: state.attribution,
          scopeSource: req.body ?? null,
          extra: {
            staleSources: state.details.staleSources,
            missingDomains: state.details.missingDomains,
            reason: state.details.reason,
          },
        }),
      });

      // Learning: capture request-info decision signal
      void captureDecisionSignal({
        entityId,
        employerId,
        decision: 'request_info',
        trustSnapshot: snap ? {
          readinessStatus: snap.readinessStatus,
          readinessScore: snap.readinessScore,
          trustBand: snap.trustBand,
          trustScore: snap.trustScore,
          blockerCount: snap.blockerCount,
          topBlockers: snap.topBlockers,
          exclusionStatus: snap.exclusionStatus,
          verifiedCredentialCount: snap.verifiedCredentialCount,
          staleCredentialCount: snap.staleCredentialCount,
          snapshotHash: snap.snapshotHash,
        } : null,
        bundleId: state.attribution.bundleId,
      });

      return void res.status(201).json({ ok: true, state });
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/employer-review/:entityId/route-to-review
  // Route to manual review queue. Writes audit event + creates HITL entry.
  // Returns: { ok, actionId, auditEventId, timestamp }
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/api/employer-review/:entityId/route-to-review',
    asyncHandler(async (req, res) => {
      const employerId = requireVerifiedClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found.`);

      await enforceEmployerMutationRbac({
        req, employerId, entityId, clinicianNpi: subject.clinicianNpi, action: 'route-to-review',
      });

      const { reason, priority } = (req.body ?? {}) as {
        reason?: string;
        priority?: string;
        organizationContextId?: string;
        bundleId?: string;
      };
      const state = await recordEmployerReviewRouting({
        entityId,
        employerId,
        clinicianNpi: subject.clinicianNpi,
        correlationId: resolveCorrelationId(req),
        organizationContextId: req.body?.organizationContextId,
        bundleId: req.body?.bundleId,
        reason,
        priority,
      });

      log('info', 'employer_review_routed_to_review', {
        auditEventId: state.auditEventId,
        entityId,
        employerId,
        npi_prefix:   subject.clinicianNpi.slice(0, 4) + '····',
        reason:       state.details.reason,
        priority:     state.details.priority,
        reviewItemId: state.persistence.reviewItemId,
      });

      // SEAL: fire-and-forget route-to-review decision signal with full trust snapshot
      void captureEmployerDecision({
        entityId,
        organizationContextId: state.attribution.organizationContextId,
        decision:                'ROUTE_TO_REVIEW',
        reviewerRole:            'EMPLOYER',
        auditEventId:            state.auditEventId,
        trustSnapshotAtDecision: (() => {
          const s = state.trustSnapshot;
          return {
            priority:            state.details.priority,
            reviewItemCreated:   state.persistence.reviewItemCreated,
            reviewItemId:        state.persistence.reviewItemId,
            readinessStatus:     s?.readinessStatus,
            readinessScore:      s?.readinessScore,
            trustBand:           s?.trustBand,
            trustScore:          s?.trustScore,
            blockerCount:        s?.blockerCount,
            topBlockers:         s?.topBlockers,
            exclusionStatus:     s?.exclusionStatus,
            snapshotHash:        s?.snapshotHash,
          };
        })(),
        readinessScoreAtDecision: state.trustSnapshot?.readinessScore ?? null,
        blockersAtDecision:      state.trustSnapshot?.topBlockers ?? [],
        metadata:                buildEmployerDecisionMetadata({
          attribution: state.attribution,
          scopeSource: req.body ?? null,
          extra: {
            reason: state.details.reason,
            reviewItemCreated: state.persistence.reviewItemCreated,
          },
        }),
      });

      // Learning: capture reject decision signal + trigger boost recomputation
      void captureDecisionSignal({
        entityId,
        employerId,
        decision: 'reject',
        trustSnapshot: state.trustSnapshot ? {
          readinessStatus: state.trustSnapshot.readinessStatus,
          readinessScore: state.trustSnapshot.readinessScore,
          trustBand: state.trustSnapshot.trustBand,
          trustScore: state.trustSnapshot.trustScore,
          blockerCount: state.trustSnapshot.blockerCount,
          topBlockers: state.trustSnapshot.topBlockers,
          exclusionStatus: state.trustSnapshot.exclusionStatus,
          verifiedCredentialCount: state.trustSnapshot.verifiedCredentialCount,
          staleCredentialCount: state.trustSnapshot.staleCredentialCount,
          snapshotHash: state.trustSnapshot.snapshotHash,
        } : null,
        bundleId: state.attribution.bundleId,
      });

      return void res.status(201).json({ ok: true, state });
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/employer-review/batch
  // Wave L — one decision applied across a selected set of candidates.
  //
  // Per-candidate semantics are IDENTICAL to the single-entity routes above:
  // same RBAC gate, same duplicate-acceptance guard, same BLOCKED fail-closed
  // check at the moment of action, and one AuditEvent per candidate written
  // by the same record* service calls — there is no batch shortcut that
  // skips per-entity audit. One candidate failing (blocked, not found,
  // already accepted) never aborts the rest; the response reports every
  // outcome individually.
  //
  // bundleId is deliberately NOT accepted here: a bundle belongs to one
  // clinician's share, so a shared bundle id across a batch would
  // mis-attribute evidence. Per-candidate bundle attribution stays on the
  // single-entity routes.
  //
  // Body: { action: 'accept'|'request-refresh'|'route-to-review',
  //         entityIds: string[] (1..25),
  //         ...same optional fields as the matching single route (minus bundleId) }
  // Returns: 200 { ok, action, results[], summary { requested, succeeded, failed } }
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/api/employer-review/batch',
    asyncHandler(async (req, res) => {
      const employerId = requireVerifiedClerkUserId(req);

      const BATCH_ACTIONS = ['accept', 'request-refresh', 'route-to-review'] as const;
      type BatchAction = (typeof BATCH_ACTIONS)[number];
      const BATCH_LIMIT = 25;

      const body = (req.body ?? {}) as {
        action?: unknown;
        entityIds?: unknown;
        role?: string;
        facility?: string;
        notes?: string;
        acceptanceScope?: string;
        acceptanceReason?: string;
        staleSources?: string[];
        missingDomains?: string[];
        message?: string;
        reason?: string;
        priority?: string;
        organizationContextId?: string;
      };

      const action = body.action as BatchAction;
      if (!BATCH_ACTIONS.includes(action)) {
        throw new HttpError(400, `action must be one of ${BATCH_ACTIONS.join(' | ')}.`);
      }
      if (!Array.isArray(body.entityIds) || body.entityIds.length === 0) {
        throw new HttpError(400, 'entityIds must be a non-empty array.');
      }
      const entityIds = [...new Set(
        body.entityIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
      )];
      if (entityIds.length === 0) {
        throw new HttpError(400, 'entityIds must contain at least one entity id.');
      }
      if (entityIds.length > BATCH_LIMIT) {
        throw new HttpError(400, `entityIds is limited to ${BATCH_LIMIT} candidates per batch.`);
      }

      type BatchResult = {
        entityId: string;
        ok: boolean;
        status: number;
        error?: string;
        error_description?: string;
        acceptanceId?: string;
        auditEventId?: string;
        blockers?: unknown;
      };

      const fail = (
        entityId: string,
        status: number,
        error: string,
        description: string,
        extra?: Partial<BatchResult>,
      ): BatchResult => ({ entityId, ok: false, status, error, error_description: description, ...extra });

      const snapshotBase = (snap: EmployerReviewActionState['trustSnapshot']) => ({
        readinessStatus: snap?.readinessStatus,
        readinessScore: snap?.readinessScore,
        trustBand: snap?.trustBand,
        trustScore: snap?.trustScore,
        blockerCount: snap?.blockerCount,
        exclusionStatus: snap?.exclusionStatus,
        snapshotHash: snap?.snapshotHash,
      });

      const learningSnapshot = (snap: EmployerReviewActionState['trustSnapshot']) => (snap ? {
        readinessStatus: snap.readinessStatus,
        readinessScore: snap.readinessScore,
        trustBand: snap.trustBand,
        trustScore: snap.trustScore,
        blockerCount: snap.blockerCount,
        topBlockers: snap.topBlockers,
        exclusionStatus: snap.exclusionStatus,
        verifiedCredentialCount: snap.verifiedCredentialCount,
        staleCredentialCount: snap.staleCredentialCount,
        snapshotHash: snap.snapshotHash,
      } : null);

      const results: BatchResult[] = [];

      // One reviewer identity for the whole batch — the actor is constant, so
      // the org resolution is done once, outside the loop.
      const batchReviewer = await resolveReviewerAcceptanceIdentity(employerId);

      // Sequential on purpose: deterministic audit ordering, and no fan-out of
      // passport builds against live sources.
      for (const entityId of entityIds) {
        const outcome = await (async (): Promise<BatchResult> => {
          try {
            if (!UUID_RE.test(entityId)) {
              return fail(entityId, 400, 'invalid_entity_id', 'entityId must be a UUID.');
            }

            const subject = await resolveEmployerReviewSubject(entityId);
            if (!subject) {
              return fail(entityId, 404, 'entity_not_found', 'Entity not found or has no NPI.');
            }

            // Same actor-role gate as the single routes — in enforced mode a
            // denial writes the standard denied-mutation AuditEvent for THIS
            // candidate before failing it closed.
            await enforceEmployerMutationRbac({
              req, employerId, entityId, clinicianNpi: subject.clinicianNpi, action,
            });

            if (action === 'accept') {
              // Same both-ids duplicate guard as the single accept route.
              const existing = await prisma.employerAcceptance.findFirst({
                where: {
                  employerId: { in: batchReviewer.acceptanceEmployerIds },
                  clinicianNpi: subject.clinicianNpi,
                  status: 'ACCEPTED',
                },
                select: { id: true },
              });
              if (existing) {
                await writeDeniedEmployerReviewMutation({
                  req,
                  actorId: employerId,
                  entityId,
                  clinicianNpi: subject.clinicianNpi,
                  denialReason: 'already_accepted',
                  payload: { batch: true, action, existingAcceptanceId: existing.id },
                });
                return fail(entityId, 409, 'already_accepted',
                  'An active acceptance already exists for this employer/NPI pair.',
                  { acceptanceId: existing.id });
              }

              // Source coverage gate — fail THIS candidate closed, never the batch.
              const passport = await buildPassport(entityId);
              if (!passport) {
                await writeDeniedEmployerReviewMutation({
                  req,
                  actorId: employerId,
                  entityId,
                  clinicianNpi: subject.clinicianNpi,
                  denialReason: 'passport_unavailable',
                  payload: { batch: true, action },
                });
                return fail(entityId, 422, 'passport_unavailable',
                  'Cannot accept: passport data is not available for this entity.');
              }
              if (passport.decisionPosture.status === 'BLOCKED') {
                await writeDeniedEmployerReviewMutation({
                  req,
                  actorId: employerId,
                  entityId,
                  clinicianNpi: subject.clinicianNpi,
                  denialReason: 'acceptance_blocked',
                  payload: {
                    batch: true,
                    action,
                    blockers: passport.decisionPosture.blockers,
                    missingSources: passport.decisionPosture.missing.map((s) => s.sourceId),
                  },
                });
                return fail(entityId, 422, 'acceptance_blocked',
                  'Cannot accept: one or more critical source checks are blocking readiness.',
                  { blockers: passport.decisionPosture.blockers });
              }

              const state = await recordEmployerReviewAcceptance({
                entityId,
                employerId,
                clinicianNpi: subject.clinicianNpi,
                correlationId: resolveCorrelationId(req),
                organizationContextId: body.organizationContextId,
                role: body.role,
                facility: body.facility,
                notes: body.notes,
                acceptanceScope: body.acceptanceScope,
                acceptanceReason: body.acceptanceReason,
              });

              const snap = state.trustSnapshot;
              void captureEmployerDecision({
                entityId,
                organizationContextId: state.attribution.organizationContextId,
                decision: 'PROCEED',
                reviewerRole: 'EMPLOYER',
                auditEventId: state.auditEventId,
                trustSnapshotAtDecision: {
                  acceptanceId: state.persistence.acceptanceId,
                  ...snapshotBase(snap),
                  verifiedCredentials: snap?.verifiedCredentialCount,
                  staleCredentials: snap?.staleCredentialCount,
                },
                readinessScoreAtDecision: snap?.readinessScore ?? null,
                blockersAtDecision: snap?.topBlockers ?? [],
                metadata: buildEmployerDecisionMetadata({
                  attribution: state.attribution,
                  scopeSource: req.body ?? null,
                  extra: {
                    batch: true,
                    acceptedByOrgId: state.acceptance?.acceptedByOrgId ?? null,
                    acceptanceScope: state.acceptance?.acceptanceScope ?? null,
                    acceptanceReason: state.acceptance?.acceptanceReason ?? null,
                    role: body.role ?? null,
                    facility: body.facility ?? null,
                  },
                }),
              });
              void captureDecisionSignal({
                entityId,
                employerId,
                decision: 'accept',
                trustSnapshot: learningSnapshot(snap),
                bundleId: state.attribution.bundleId,
              });

              return {
                entityId,
                ok: true,
                status: 201,
                acceptanceId: state.persistence.acceptanceId ?? undefined,
                auditEventId: state.auditEventId,
              };
            }

            if (action === 'request-refresh') {
              const state = await recordEmployerReviewRefreshRequest({
                entityId,
                employerId,
                clinicianNpi: subject.clinicianNpi,
                correlationId: resolveCorrelationId(req),
                organizationContextId: body.organizationContextId,
                staleSources: body.staleSources,
                missingDomains: body.missingDomains,
                message: body.message,
              });

              const snap = state.trustSnapshot;
              void captureEmployerDecision({
                entityId,
                organizationContextId: state.attribution.organizationContextId,
                decision: 'REQUEST_REFRESH',
                reviewerRole: 'EMPLOYER',
                auditEventId: state.auditEventId,
                trustSnapshotAtDecision: {
                  staleSources: state.details.staleSources,
                  missingDomains: state.details.missingDomains,
                  ...snapshotBase(snap),
                  topBlockers: snap?.topBlockers,
                },
                readinessScoreAtDecision: snap?.readinessScore ?? null,
                blockersAtDecision: [...new Set([
                  ...(snap?.topBlockers ?? []),
                  ...state.details.missingDomains,
                ])],
                metadata: buildEmployerDecisionMetadata({
                  attribution: state.attribution,
                  scopeSource: req.body ?? null,
                  extra: {
                    batch: true,
                    staleSources: state.details.staleSources,
                    missingDomains: state.details.missingDomains,
                    reason: state.details.reason,
                  },
                }),
              });
              void captureDecisionSignal({
                entityId,
                employerId,
                decision: 'request_info',
                trustSnapshot: learningSnapshot(snap),
                bundleId: state.attribution.bundleId,
              });

              return { entityId, ok: true, status: 201, auditEventId: state.auditEventId };
            }

            // route-to-review
            const state = await recordEmployerReviewRouting({
              entityId,
              employerId,
              clinicianNpi: subject.clinicianNpi,
              correlationId: resolveCorrelationId(req),
              organizationContextId: body.organizationContextId,
              reason: body.reason,
              priority: body.priority,
            });

            const snap = state.trustSnapshot;
            void captureEmployerDecision({
              entityId,
              organizationContextId: state.attribution.organizationContextId,
              decision: 'ROUTE_TO_REVIEW',
              reviewerRole: 'EMPLOYER',
              auditEventId: state.auditEventId,
              trustSnapshotAtDecision: {
                priority: state.details.priority,
                reviewItemCreated: state.persistence.reviewItemCreated,
                reviewItemId: state.persistence.reviewItemId,
                ...snapshotBase(snap),
                topBlockers: snap?.topBlockers,
              },
              readinessScoreAtDecision: snap?.readinessScore ?? null,
              blockersAtDecision: snap?.topBlockers ?? [],
              metadata: buildEmployerDecisionMetadata({
                attribution: state.attribution,
                scopeSource: req.body ?? null,
                extra: {
                  batch: true,
                  reason: state.details.reason,
                  reviewItemCreated: state.persistence.reviewItemCreated,
                },
              }),
            });
            void captureDecisionSignal({
              entityId,
              employerId,
              decision: 'reject',
              trustSnapshot: learningSnapshot(snap),
              bundleId: state.attribution.bundleId,
            });

            return { entityId, ok: true, status: 201, auditEventId: state.auditEventId };
          } catch (err) {
            if (err instanceof HttpError) {
              return fail(entityId, err.status,
                err.status === 403 ? 'rbac_denied' : 'action_failed', err.message);
            }
            log('error', 'employer_review_batch_candidate_failed', {
              entityId,
              action,
              error: err instanceof Error ? err.message : String(err),
            });
            return fail(entityId, 500, 'action_failed', 'Internal error applying this action.');
          }
        })();

        results.push(outcome);
      }

      const succeeded = results.filter((r) => r.ok).length;

      log('info', 'employer_review_batch_completed', {
        action,
        employerId,
        requested: entityIds.length,
        succeeded,
        failed: results.length - succeeded,
      });

      return void res.status(200).json({
        ok: true,
        action,
        results,
        summary: {
          requested: entityIds.length,
          succeeded,
          failed: results.length - succeeded,
        },
      });
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/employer-review/queue
  // Wave L — the organization's review inbox: clinicians who shared an apply
  // bundle WITH this organization, newest share first, one row per NPI.
  //
  // Scope integrity: the queue is ALWAYS bound to the calling employer's own
  // registered organization (resolved server-side from their Clerk user id).
  // A caller-supplied organizationId is never honored — org context from
  // query/header is unauthenticated (ASVS gap G1) and a candidate pipeline
  // must not be readable cross-tenant. No unscoped aggregation exists.
  //
  // Consent honesty: revoked shares and expired bundles fail closed out of
  // the queue. Readiness shown per row comes from the cached trust snapshot
  // (clearly labeled); accepting re-checks live posture and fails closed.
  // ─────────────────────────────────────────────────────────────────────────
  app.get(
    '/api/employer-review/queue',
    asyncHandler(async (req, res) => {
      // The queue is a cross-clinician candidate pipeline scoped to the
      // caller's organization — verified identity, same as the mutations.
      const employerId = requireVerifiedClerkUserId(req);

      const orgProfile = await getOrgProfile(employerId);
      if (!orgProfile) {
        throw new HttpError(403, 'No employer organization is registered for this account. Complete employer setup first.');
      }

      // Clinicians address shares by system id or slug — match both, exactly.
      const organization = await prisma.organization.findUnique({
        where: { id: orgProfile.organizationId },
        select: { id: true, slug: true, name: true },
      });
      const organizationIds = [orgProfile.organizationId, organization?.slug].filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      );
      // Acceptance rows for this reviewer may be keyed by their organization
      // id (ADR 0007) or by their Clerk user id (legacy rows).
      const queueEmployerIds = [...new Set([orgProfile.organizationId, employerId])];

      const limitRaw = Number.parseInt(String(req.query.limit ?? ''), 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 25;

      const shares = await prisma.bundleShareEvent.findMany({
        where: {
          organizationId: { in: organizationIds },
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { sharedAt: 'desc' },
        take: 200,
        select: {
          npi: true,
          subjectEntityId: true,
          sharedAt: true,
          purposeOfUse: true,
          organizationContextId: true,
          bundleId: true,
        },
      });

      // Latest live share per clinician.
      const latestByNpi = new Map<string, (typeof shares)[number]>();
      for (const share of shares) {
        if (!latestByNpi.has(share.npi)) latestByNpi.set(share.npi, share);
      }
      const picked = [...latestByNpi.values()].slice(0, limit);

      const candidates = [];
      for (const share of picked) {
        const subject = share.subjectEntityId && UUID_RE.test(share.subjectEntityId)
          ? await resolveEmployerReviewSubject(share.subjectEntityId)
          : await resolveEmployerReviewSubjectByNpi(share.npi);

        const npi = subject?.clinicianNpi ?? share.npi;
        const trust = await getCachedTrustState(npi).catch(() => null);
        const history = subject
          ? await loadEmployerAcceptanceHistory({
              entityId: subject.entityId,
              clinicianNpi: subject.clinicianNpi,
            }).catch(() => null)
          : null;
        const alreadyAccepted = subject
          ? await prisma.employerAcceptance.findFirst({
              where: {
                // Rows may be keyed by the organization id (ADR 0007) or by
                // the Clerk user id (legacy) — check both so the queue shows
                // acceptances written under either semantic.
                employerId: { in: queueEmployerIds },
                clinicianNpi: subject.clinicianNpi,
                status: 'ACCEPTED',
              },
              select: { id: true, acceptedAt: true },
            })
          : null;

        candidates.push({
          entityId: subject?.entityId ?? null,
          npi: share.npi,
          // A share whose subject cannot be resolved to an entity is shown but
          // not actionable — reviewing requires a resolved identity.
          reviewable: Boolean(subject),
          sharedAt: share.sharedAt.toISOString(),
          purposeOfUse: share.purposeOfUse,
          organizationContextId: share.organizationContextId,
          bundleId: share.bundleId,
          readiness: trust
            ? {
                level: trust.readiness_level,
                score: trust.readiness_score,
                status: trust.readiness_status,
                topBlockers: (trust.blockers ?? trust.gaps ?? []).slice(0, 3),
                source: 'cached_trust_snapshot',
              }
            : null,
          // Honest wording (headline/trustCopy) comes from the acceptance
          // history service — visibility and a soft signal only; this
          // employer still decides.
          headStart: history?.summary ?? null,
          alreadyAccepted: alreadyAccepted
            ? { acceptanceId: alreadyAccepted.id, acceptedAt: alreadyAccepted.acceptedAt.toISOString() }
            : null,
          reviewPath: subject ? `/review/${subject.entityId}` : null,
        });
      }

      return void res.status(200).json({
        ok: true,
        scope: {
          type: 'organization',
          organizationId: orgProfile.organizationId,
          organizationName: organization?.name ?? orgProfile.name,
        },
        total: candidates.length,
        liveShares: shares.length,
        candidates,
        readinessNote:
          'Readiness per row is the cached trust snapshot. Accepting re-checks live decision posture and fails closed if BLOCKED.',
        generatedAt: new Date().toISOString(),
      });
    }),
  );

  app.get(
    '/api/employer-review/:entityId/status',
    asyncHandler(async (req, res) => {
      const employerId = requireClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found.`);

      const state = await loadEmployerReviewStatus({
        entityId,
        employerId,
        clinicianNpi: subject.clinicianNpi,
        organizationContextId: typeof req.query.organizationContextId === 'string'
          ? req.query.organizationContextId
          : undefined,
        bundleId: typeof req.query.bundleId === 'string'
          ? req.query.bundleId
          : undefined,
      });

      // Learning: track employer viewed event (fire-and-forget)
      emitLearningEvent({
        type: 'EMPLOYER_VIEWED',
        providerId: entityId,
        employerId,
        metadata: {},
        payload: {},
      });

      return void res.status(200).json({ ok: true, state });
    }),
  );

  app.get(
    '/api/employer-review/:entityId/acceptance-history',
    asyncHandler(async (req, res) => {
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      // Holder surfaces only know the clinician NPI; a 10-digit key resolves by
      // NPI instead of entity UUID (also keeps non-UUID input away from the
      // uuid-typed findUnique). Read-only — mutation actions still require an
      // entity id.
      const subject = /^\d{10}$/.test(entityId.trim())
        ? await resolveEmployerReviewSubjectByNpi(entityId.trim())
        : await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found.`);

      const history = await loadEmployerAcceptanceHistory({
        entityId: subject.entityId,
        clinicianNpi: subject.clinicianNpi,
      });

      return void res.status(200).json(history);
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/employer-review/:entityId/packet
  // Evidence packet export — structured JSON or ZIP bundle of current trust state.
  // Every export writes an ARTIFACT_EXPORTED audit record before the payload is returned.
  // ─────────────────────────────────────────────────────────────────────────
  app.get(
    '/api/employer-review/:entityId/packet',
    asyncHandler(async (req, res): Promise<void> => {
      const employerId = requireClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');
      // Test the raw value — it is what buildPassport and the query below
      // receive, so a padded uuid must fail here rather than reach Prisma.
      if (!UUID_RE.test(entityId)) {
        throw new HttpError(404, `Entity ${entityId} not found.`);
      }

      const [passport, entity] = await Promise.all([
        buildPassport(entityId),
        prisma.vcvEntity.findUnique({
          where:  { id: entityId },
          select: { id: true, npi: true },
        }),
      ]);

      if (!passport || !entity?.npi) {
        throw new HttpError(404, `Entity ${entityId} not found.`);
      }

      const clinicianNpi = entity.npi;
      const format = resolvePacketExportFormat(req);
      const trustContainerEntry = await issueTrustContainerManifestEntry({ passport });
      const packet = buildEmployerEvidencePacket({
        passport,
        employerId,
        trustContainer: trustContainerEntry,
      });
      const runtimeTrust = buildRuntimeMutationMetadata({
        action: 'packet-export',
        actorId: employerId,
        entityId,
        clinicianNpi,
        correlationId: resolveCorrelationId(req),
        payload: {
          format,
          sourceIds: packet.manifest.sources.map((source) => source.sourceId),
          receiptReferenceCount: packet.receiptReferences.length,
          artifactReferenceCount: packet.artifactReferences.length,
          manifestHash: sha256ForPayload(packet.manifest),
        },
        outcome: 'allowed',
        readonly: resolveReadonlyIndicator(req),
      });
      const auditMetadata = toJsonValue(JSON.parse(JSON.stringify({
        schema: 'vitalcv.employer.packet-export.v1',
        exportType: 'EMPLOYER_PACKET',
        format,
        employerId,
        entityId,
        clinicianNpi,
        ...runtimeFields(runtimeTrust),
        exportedAt: packet.exportedAt,
        manifestHash: sha256ForPayload(packet.manifest),
        sourceIds: packet.manifest.sources.map((source) => source.sourceId),
        staleSources: packet.manifest.sources
          .filter((source) => source.state === 'stale')
          .map((source) => source.sourceId),
        reviewRequiredSources: packet.manifest.sources
          .filter((source) => source.reviewRequired)
          .map((source) => source.sourceId),
        receiptReferenceCount: packet.receiptReferences.length,
        artifactReferenceCount: packet.artifactReferences.length,
        sourceCoverageSummary: packet.sourceCoverageSummary,
        freshness: packet.freshness,
        trustContainer: toTrustContainerAuditMetadata(trustContainerEntry),
      })));
      await prisma.auditEvent.create({
        data: {
          type: 'ARTIFACT_EXPORTED',
          hash: sha256ForPayload({
            type: 'ARTIFACT_EXPORTED',
            referenceId: entityId,
            metadata: auditMetadata,
          }),
          referenceId: entityId,
          clinicianId: clinicianNpi,
          metadata: auditMetadata,
        },
      });

      log('info', 'employer_packet_exported', {
        entityId,
        employerId,
        npi_prefix:  clinicianNpi.slice(0, 4) + '····',
        exportedAt: packet.exportedAt,
        format,
        score:       packet.readiness.score,
        blockers:    packet.readiness.blockers.length,
      });

      const filenameStem = `vitalcv-packet-${clinicianNpi}-${new Date().toISOString().slice(0, 10)}`;
      if (format === 'zip') {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filenameStem}.zip"`,
        );
        res.setHeader('Content-Type', 'application/zip');
        createEmployerEvidencePacketZipStream(packet).pipe(res);
        return;
      }

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filenameStem}.json"`,
      );
      res.setHeader('Content-Type', 'application/json');
      void res.json(packet);
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/employer-review/:entityId/share-packet
  // Generate an ephemeral share link and log an EMPLOYER_PACKET_SHARED audit event.
  // Returns: { ok, shareUrl, auditEventId }
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/api/employer-review/:entityId/share-packet',
    asyncHandler(async (req, res) => {
      const employerId = requireVerifiedClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found or has no NPI.`);

      await enforceEmployerMutationRbac({
        req, employerId, entityId, clinicianNpi: subject.clinicianNpi, action: 'share-packet',
      });

      const { npi: bodyNpi, organizationContextId, bundleId } = (req.body ?? {}) as {
        npi?: string;
        organizationContextId?: string | null;
        bundleId?: string | null;
      };
      const clinicianNpi = bodyNpi?.trim() ?? subject.clinicianNpi;
      if (clinicianNpi !== subject.clinicianNpi) {
        await writeDeniedEmployerReviewMutation({
          req,
          actorId: employerId,
          entityId,
          clinicianNpi: subject.clinicianNpi,
          denialReason: 'npi_mismatch',
          payload: req.body ?? {},
        });
        throw new HttpError(400, 'Share packet NPI does not match the reviewed clinician.');
      }

      const sharedAt = new Date();
      const expiresAt = new Date(sharedAt.getTime() + SHARE_TOKEN_TTL_MS);
      const shareToken = buildShareToken();
      const shareTokenHash = hashShareToken(shareToken);
      const shareUrl = `${resolveAppOrigin()}/review/${shareToken}`;
      const runtimeTrust = buildRuntimeMutationMetadata({
        action: 'share-packet',
        actorId: employerId,
        entityId,
        clinicianNpi,
        correlationId: resolveCorrelationId(req),
        payload: {
          organizationContextId: readOptionalString(organizationContextId),
          bundleId: readOptionalString(bundleId),
          expiresAt: expiresAt.toISOString(),
        },
        outcome: 'allowed',
        readonly: resolveReadonlyIndicator(req),
      });

      const auditMetadata = toJsonValue({
        schema: 'vitalcv.employer.packet-shared.v1',
        employerId,
        entityId,
        clinicianNpi,
        ...runtimeFields(runtimeTrust),
        organizationContextId: readOptionalString(organizationContextId),
        bundleId: readOptionalString(bundleId),
        shareTokenHash,
        sharedAt: sharedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });

      const auditEvent = await prisma.auditEvent.create({
        data: {
          type: 'EMPLOYER_PACKET_SHARED',
          hash: sha256ForPayload({
            type: 'EMPLOYER_PACKET_SHARED',
            referenceId: entityId,
            metadata: auditMetadata,
          }),
          referenceId: entityId,
          clinicianId: clinicianNpi,
          metadata: auditMetadata,
        },
      });

      log('info', 'employer_packet_shared', {
        auditEventId: auditEvent.id,
        entityId,
        employerId,
        npi_prefix: clinicianNpi.slice(0, 4) + '····',
      });

      return void res.status(201).json({
        ok: true,
        shareUrl,
        auditEventId: auditEvent.id,
        expiresAt: expiresAt.toISOString(),
      });
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/employer-review/share-token/:token
  // Resolve an ephemeral employer review share token to its scoped review target.
  // Missing, malformed, or expired tokens fail closed.
  // ─────────────────────────────────────────────────────────────────────────
  app.get(
    '/api/employer-review/share-token/:token',
    asyncHandler(async (req, res) => {
      const token = req.params.token?.trim() ?? '';
      if (!SHARE_TOKEN_PATTERN.test(token)) {
        return void res.status(404).json({
          error: 'share_token_not_found',
          error_description: 'This review link is not available.',
        });
      }

      const shareTokenHash = hashShareToken(token);
      const shareEvent = await prisma.auditEvent.findFirst({
        where: {
          type: 'EMPLOYER_PACKET_SHARED',
          metadata: {
            path: ['shareTokenHash'],
            equals: shareTokenHash,
          },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          referenceId: true,
          clinicianId: true,
          createdAt: true,
          metadata: true,
        },
      });

      if (!shareEvent) {
        return void res.status(404).json({
          error: 'share_token_not_found',
          error_description: 'This review link is not available.',
        });
      }

      const metadata = metadataRecord(shareEvent.metadata);
      const resolvedEntityId = shareEvent.referenceId ?? readOptionalString(metadata.entityId);
      const resolvedClinicianNpi = shareEvent.clinicianId ?? readOptionalString(metadata.clinicianNpi);
      const expiresAt = readOptionalString(metadata.expiresAt);
      if (!resolvedEntityId || !resolvedClinicianNpi) {
        return void res.status(410).json({
          error: 'share_token_unresolved',
          error_description: 'This review link no longer resolves to a review target.',
        });
      }
      if (!expiresAt || Date.parse(expiresAt) <= Date.now()) {
        return void res.status(410).json({
          error: 'share_token_expired',
          error_description: 'This review link has expired. Ask the clinician to generate a fresh share link.',
        });
      }

      const contextId = readOptionalString(metadata.organizationContextId);
      const bundleId = readOptionalString(metadata.bundleId);
      const reviewParams = new URLSearchParams();
      if (contextId) reviewParams.set('contextId', contextId);
      if (bundleId) reviewParams.set('bundleId', bundleId);
      const reviewQuery = reviewParams.toString();

      return void res.status(200).json({
        ok: true,
        entityId: resolvedEntityId,
        clinicianNpi: resolvedClinicianNpi,
        organizationContextId: contextId,
        bundleId,
        reviewHref: `/review/${resolvedEntityId}${reviewQuery ? `?${reviewQuery}` : ''}`,
        shareEventAuditId: shareEvent.id,
        sharedAt: shareEvent.createdAt.toISOString(),
        expiresAt,
      });
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/employer-review/:entityId/confirm-start
  // Record the clinician's actual start date through the canonical
  // application-bound start command (ADR 0007 start-writer succession).
  // AUDIT CONTRACT: StartAttestation + START_ATTESTED + START_RECORDED +
  //                 outbound intent commit in ONE transaction before any 2xx.
  // Returns: { ok, attestationId, auditEventId, startedAt }
  //          201 on first confirmation, 200 on an identical idempotent replay.
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/api/employer-review/:entityId/confirm-start',
    asyncHandler(async (req, res) => {
      const employerId = requireVerifiedClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found or has no NPI.`);

      await enforceEmployerMutationRbac({
        req, employerId, entityId, clinicianNpi: subject.clinicianNpi, action: 'confirm-start',
      });

      const { startedAt, role, facility, acceptanceId: bodyAcceptanceId } = (req.body ?? {}) as {
        startedAt?: string;
        role?:      string;
        facility?:  string;
        acceptanceId?: string;
      };

      if (!startedAt) throw new HttpError(400, 'startedAt is required.');
      if (!role?.trim()) throw new HttpError(400, 'role is required.');
      if (!facility?.trim()) throw new HttpError(400, 'facility is required.');

      const startDate = new Date(startedAt);
      if (isNaN(startDate.getTime())) throw new HttpError(400, 'startedAt must be a valid ISO date.');

      // Resolve the open acceptance for this employer+clinician.
      // If a specific acceptanceId is provided, use it; otherwise find the most
      // recent ACCEPTED one. Rows may be keyed by the reviewer's organization
      // id (ADR 0007) or their Clerk user id (legacy) — match both.
      const startReviewer = await resolveReviewerAcceptanceIdentity(employerId);
      const acceptance = await (bodyAcceptanceId
        ? prisma.employerAcceptance.findFirst({
            where:  {
              id: bodyAcceptanceId,
              employerId: { in: startReviewer.acceptanceEmployerIds },
              clinicianNpi: subject.clinicianNpi,
              status: 'ACCEPTED',
            },
            select: { id: true, clinicianNpi: true },
          })
        : prisma.employerAcceptance.findFirst({
            where:   {
              employerId: { in: startReviewer.acceptanceEmployerIds },
              clinicianNpi: subject.clinicianNpi,
              status: 'ACCEPTED',
            },
            orderBy: { acceptedAt: 'desc' },
            select:  { id: true, clinicianNpi: true },
          })
      );

      if (!acceptance) {
        await writeDeniedEmployerReviewMutation({
          req,
          actorId: employerId,
          entityId,
          clinicianNpi: subject.clinicianNpi,
          denialReason: 'missing_acceptance',
          payload: {
            body: req.body ?? {},
            requestedAcceptanceId: bodyAcceptanceId ?? null,
          },
        });
        throw new HttpError(409, 'No active acceptance found for this employer/clinician pair. Accept first before recording a start.');
      }
      if (acceptance.clinicianNpi !== subject.clinicianNpi) {
        await writeDeniedEmployerReviewMutation({
          req,
          actorId: employerId,
          entityId,
          clinicianNpi: subject.clinicianNpi,
          denialReason: 'acceptance_npi_mismatch',
          payload: {
            body: req.body ?? {},
            acceptanceId: acceptance.id,
          },
        });
        throw new HttpError(409, 'No active acceptance found for this employer/clinician pair. Accept first before recording a start.');
      }

      // AUDIT: START_ATTESTED is one of the 5 canonical non-repudiation events.
      // The canonical application-bound start command (ADR 0007, start-writer
      // succession — COMPLETE) owns the whole consequence set atomically:
      // StartActivation advance, StartAttestation, START_ATTESTED +
      // START_RECORDED audit events, and the outbound HIRE_TO_START intent
      // commit in one transaction or not at all. Door B keeps only subject
      // resolution, RBAC, acceptance selection, and this legacy response
      // mapping. An acceptance with no application binding fails closed inside
      // the command (409 START_ACCEPTANCE_REQUIRED) — a legacy row cannot
      // manufacture a start. A repeat confirmation of the identical first day
      // answers idempotently (200), never a second attestation.
      const confirmed = await confirmStartByAcceptance({
        acceptanceId: acceptance.id,
        actorId: employerId,
        startedAt: startDate,
        role,
        facility,
        expectedClinicianNpi: subject.clinicianNpi,
        ...(startReviewer.organizationId
          ? { expectedOrganizationId: startReviewer.organizationId }
          : {}),
      });
      const attestation = confirmed.attestation;
      const auditEventId = confirmed.attestationAuditEventId;

      log('info', 'employer_start_attested', {
        attestationId:  attestation.id,
        auditEventId,
        acceptanceId:   acceptance.id,
        entityId,
        employerId,
        duplicate:      confirmed.duplicate,
        npi_prefix:     (acceptance.clinicianNpi ?? '0000000000').slice(0, 4) + '····',
        startedAt:      startDate.toISOString(),
      });

      // SEAL: fire-and-forget start outcome capture for KPI funnel. Only on a
      // first-time confirmation — an idempotent replay is not a second outcome.
      if (!confirmed.duplicate) {
        void captureStartOutcome({
          entityId,
          startedAt:             startDate,
          blockersAtStart:       [],
          sourceCoverageAtStart: {},
          metadata: {
            attestationId:  attestation.id,
            acceptanceId:   acceptance.id,
            employerId,
            role,
            facility,
            recordedVia: 'employer_review_confirm_start',
          },
        }).catch((err: unknown) => {
          log('warn', 'start_outcome_capture_failed', {
            attestationId: attestation.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      // Legacy response contract, unchanged: the web proxy
      // (apps/web/app/api/employer-review/[entityId]/[action]/route.ts)
      // requires { ok, attestationId, auditEventId, startedAt } on any 2xx.
      // 200 (not 201) signals an idempotent replay, mirroring /api/hiring/start.
      return void res.status(confirmed.duplicate ? 200 : 201).json({
        ok:            true,
        attestationId: attestation.id,
        auditEventId,
        startedAt:     attestation.startedAt.toISOString(),
      });
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/employer-review/npi/:npi/refresh-requests
  // Returns recent pending refresh requests for a clinician NPI.
  // Clinician-facing: surfaces "an employer has requested updated credentials."
  // No auth required — NPI is already public; the response contains no PII beyond count.
  // ─────────────────────────────────────────────────────────────────────────
  app.get(
    '/api/employer-review/npi/:npi([0-9]{10})/refresh-requests',
    asyncHandler(async (req, res) => {
      const { npi } = req.params;

      const LOOKBACK_DAYS = 30;
      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

      const latest = await prisma.auditEvent.findFirst({
        where: {
          type:        'EMPLOYER_REVIEW_REFRESH_REQUESTED',
          clinicianId: npi,
          createdAt:   { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        select:  { id: true, createdAt: true },
      });

      const count = latest
        ? await prisma.auditEvent.count({
            where: {
              type:        'EMPLOYER_REVIEW_REFRESH_REQUESTED',
              clinicianId: npi,
              createdAt:   { gte: since },
            },
          })
        : 0;

      return void res.status(200).json({
        hasPendingRequest: count > 0,
        count,
        latestAt: latest?.createdAt.toISOString() ?? null,
      });
    }),
  );

  log('info', 'employer_action_routes_registered', {
    routes: [
      'POST /api/employer-review/:entityId/accept',
      'POST /api/employer-review/:entityId/request-refresh',
      'POST /api/employer-review/:entityId/route-to-review',
      'GET  /api/employer-review/:entityId/status',
      'GET  /api/employer-review/:entityId/acceptance-history',
      'GET  /api/employer-review/:entityId/packet',
      'POST /api/employer-review/:entityId/share-packet',
      'GET  /api/employer-review/share-token/:token',
      'POST /api/employer-review/:entityId/confirm-start',
      'GET  /api/employer-review/npi/:npi/refresh-requests',
    ],
  });
}
