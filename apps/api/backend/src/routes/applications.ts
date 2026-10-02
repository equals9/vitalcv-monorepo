/**
 * applications.ts — Wave 229
 *
 * Routes:
 *   POST   /api/opportunities/:id/apply       — clinician applies
 *   GET    /api/clinician/applications         — clinician lists own applications
 *   DELETE /api/applications/:appId/withdraw   — clinician withdraws
 *
 *   GET    /api/employer/applications           — verifier lists all org applications
 *   GET    /api/employer/applications/dashboard — verifier lists workflow buckets
 *   GET    /api/opportunities/:id/applications  — verifier lists for one opportunity
 *   PATCH  /api/applications/:appId/review      — verifier reviews (REVIEWED|ACCEPTED|DECLINED)
 *   GET    /api/applications/:appId/workflow    — verifier reads workflow detail
 *   POST   /api/applications/:appId/workflow-action — verifier runs accept/request_info/reject
 */

import prisma from '../graphql/prisma_client';
import { requireIdentityTier } from '../services/identity/identityGate';
import type { Express, NextFunction, Request, Response } from 'express';
import {
  applyToOpportunity,
  listClinicianApplications,
  withdrawApplication,
  listAllOrgApplications,
  listApplicationsForOpportunity,
} from '../services/opportunities/applicationService';
import {
  getEmployerWorkflowApplication,
  listEmployerWorkflowDashboard,
  runEmployerWorkflowAction,
} from '../services/opportunities/employerWorkflowService';
import {
  parseApplicationPacketApplicationId,
  parseRequestedPacketVersion,
  readApplicationPacket,
  readApplicationEvidenceView,
} from '../services/opportunities/applicationPacketReadService';
import { readHireToStartCase } from '../services/opportunities/hireToStartReadService';
import { HttpError } from '../utils/httpError';
import { requireOrgRole, VERIFIER_MUTATION_ROLES } from '../middleware/orgRoleGuard';
import {
  requireNpiAuthorization,
  requireVerifiedClerkUserId,
} from '../middleware/verifiedActor';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

/*
 * Identity on every route in this file comes from the verified Clerk session
 * (`requireVerifiedClerkUserId`, middleware/verifiedActor.ts). No handler
 * here reads `x-clerk-user-id`: the header is a caller assertion, and this
 * file left the header-trust baseline when the last raw read was removed.
 * Do not add one back — the ratchet (scripts/check-header-trust-ratchet.ts)
 * fails the build if a file re-enters.
 */

// Opportunity.id and Application.id are Postgres uuid columns — querying them
// with a non-uuid string makes Prisma throw (a 500) instead of returning null.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuidParam(value: string | undefined, label: string): string {
  const id = value?.trim();
  if (!id || !UUID_RE.test(id)) {
    throw new HttpError(404, `${label} not found.`);
  }
  return id;
}

export function registerApplicationRoutes(app: Express): void {
  /* ── Clinician: apply ── */
  app.post(
    '/api/opportunities/:id/apply',
    asyncHandler(async (req, res) => {
      // An application seals a disclosure of the clinician's evidence to an
      // employer. Who is disclosing is decided by the verified session — a
      // forged identity header, or a header with no token behind it, is 401.
      const clerkUserId = requireVerifiedClerkUserId(req);
      const opportunityId = requireUuidParam(req.params.id, 'Opportunity');
      // Deliberately NOT read from the body: `npi`. The subject of the
      // disclosure is the clinician the session resolves to, and their NPI is
      // the one bound to their profile. A body NPI, if sent, is ignored.
      const { coverNote, selectedSections, purpose } = req.body as {
        coverNote?: string;
        selectedSections?: string[];
        purpose?: string;
      };

      // Applications carry the clinician's readiness snapshot to an employer —
      // they unlock at the work_email_confirmed identity tier.
      const applicant = await prisma.user.findUnique({ where: { clerkUserId } });
      if (!applicant) throw new HttpError(404, 'User not found. Complete onboarding first.');
      await requireIdentityTier(applicant.id, 'work_email_confirmed');

      // The NPI the packet will name is the profile's, and the session must
      // hold a VERIFIED (or delegated) binding to it before anything seals. A
      // pending self-asserted claim is a request, not authority — it gets the
      // ownership 403 and writes nothing.
      const profile = await prisma.personProfile.findUnique({
        where: { userId: applicant.id },
        select: { npi: true },
      });
      const npi = profile?.npi?.trim();
      if (!npi) {
        throw new HttpError(409, 'Complete clinician onboarding before applying with VitalCV.');
      }
      await requireNpiAuthorization(clerkUserId, npi, req);

      const application = await applyToOpportunity({
        opportunityId,
        clerkUserId,
        coverNote,
        selectedSections,
        purpose,
      });
      res.status(201).json(application);
    }),
  );

  /* ── Clinician: list own applications ── */
  app.get(
    '/api/clinician/applications',
    asyncHandler(async (req, res) => {
      // Verified identity: this is a self-scoped read exempted from the tenant
      // turnstile, so the raw header alone must never select whose
      // applications are returned.
      const clerkUserId = requireVerifiedClerkUserId(req);
      const applications = await listClinicianApplications(clerkUserId);
      res.json(applications);
    }),
  );

  /* ── Clinician: withdraw application ── */
  app.delete(
    '/api/applications/:appId/withdraw',
    asyncHandler(async (req, res) => {
      // Verified identity: exempted from the tenant turnstile; a forged
      // header must not be able to withdraw an application.
      const clerkUserId = requireVerifiedClerkUserId(req);
      const appId = requireUuidParam(req.params.appId, 'Application');
      const updated = await withdrawApplication(appId, clerkUserId);
      res.json(updated);
    }),
  );

  /* ── Authorized immutable submission packet ── */
  app.get(
    '/api/applications/:applicationId/packet',
    asyncHandler(async (req, res) => {
      // This high-value read boundary requires a cryptographically verified
      // Clerk JWT even while the repository-wide middleware remains in shadow
      // rollout. A forgeable x-clerk-user-id header is never sufficient.
      const clerkUserId = requireVerifiedClerkUserId(req);
      const applicationId = parseApplicationPacketApplicationId(req.params.applicationId);
      const packetVersion = parseRequestedPacketVersion(req.query.version);

      const readInput = {
        applicationId,
        clerkUserId,
        packetVersion,
      };
      const packet = req.query.includeCurrent === 'true'
        ? await readApplicationEvidenceView(readInput)
        : await readApplicationPacket(readInput);
      res.json(packet);
    }),
  );

  /* ── Authorized joined hire-to-start case ── */
  app.get(
    '/api/applications/:applicationId/hire-to-start',
    asyncHandler(async (req, res) => {
      res.setHeader('Cache-Control', 'private, no-store');
      const clerkUserId = requireVerifiedClerkUserId(req);
      const applicationId = parseApplicationPacketApplicationId(req.params.applicationId);
      const view = await readHireToStartCase({ applicationId, clerkUserId });
      res.json(view);
    }),
  );

  // The ACT-7.1 clinician activation read (GET /api/applications/:appId/
  // activation) was DELETED here: the authorized joined hire-to-start case
  // above superseded it, nothing on the web called it (before-greps in the
  // deleting PR), and it never left the tenant-guard turnstile.

  /* ── Verifier: list all org applications ── */
  app.get(
    '/api/employer/applications',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const applications = await listAllOrgApplications(clerkUserId);
      res.json(applications);
    }),
  );

  /* ── Verifier: workflow dashboard ── */
  app.get(
    '/api/employer/applications/dashboard',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const dashboard = await listEmployerWorkflowDashboard(clerkUserId);
      res.json(dashboard);
    }),
  );

  /* ── Verifier: list applications for one opportunity ── */
  app.get(
    '/api/opportunities/:id/applications',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const opportunityId = requireUuidParam(req.params.id, 'Opportunity');
      const applications = await listApplicationsForOpportunity(opportunityId, clerkUserId);
      res.json(applications);
    }),
  );

  /* ── Verifier: review application ── */
  app.patch(
    '/api/applications/:appId/review',
    requireOrgRole(VERIFIER_MUTATION_ROLES),
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const applicationId = requireUuidParam(req.params.appId, 'Application');
      const {
        status,
        reviewNote,
        packetVersion,
        packetHash,
        intendedStartDate,
        urgency,
      } = req.body as {
        status?: string;
        reviewNote?: string;
        packetVersion?: number;
        packetHash?: string;
        intendedStartDate?: string | null;
        urgency?: string | null;
      };

      if (!status || !['REVIEWED', 'ACCEPTED', 'DECLINED'].includes(status)) {
        throw new HttpError(400, 'status must be REVIEWED, ACCEPTED, or DECLINED.');
      }

      const action = status === 'ACCEPTED'
        ? 'accept'
        : status === 'DECLINED'
          ? 'reject'
          : 'start_review';
      const result = await runEmployerWorkflowAction({
        action,
        applicationId,
        reviewerClerkUserId: clerkUserId,
        reviewNote,
        packetVersion,
        packetHash,
        intendedStartDate,
        urgency,
      });

      // Compatibility response: the legacy route still returns its original
      // application-shaped result, while all mutations now pass through the
      // canonical workflow command service.
      res.json(result.application);
    }),
  );

  /* ── Verifier: workflow detail ── */
  app.get(
    '/api/applications/:appId/workflow',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const appId = requireUuidParam(req.params.appId, 'Application');
      const workflowApplication = await getEmployerWorkflowApplication(appId, clerkUserId);
      res.json(workflowApplication);
    }),
  );

  /* ── Verifier: workflow action ── */
  app.post(
    '/api/applications/:appId/workflow-action',
    requireOrgRole(VERIFIER_MUTATION_ROLES),
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const appId = requireUuidParam(req.params.appId, 'Application');
      const {
        action,
        requests,
        reviewNote,
        packetVersion,
        packetHash,
        intendedStartDate,
        urgency,
      } = req.body as {
        action?: string;
        requests?: Array<{ field?: string; message?: string }>;
        reviewNote?: string;
        packetVersion?: number;
        packetHash?: string;
        intendedStartDate?: string | null;
        urgency?: string | null;
      };

      if (!action || !['accept', 'request_info', 'reject'].includes(action)) {
        throw new HttpError(400, 'action must be accept, request_info, or reject.');
      }

      const result = await runEmployerWorkflowAction({
        action: action as 'accept' | 'request_info' | 'reject',
        applicationId: appId,
        reviewerClerkUserId: clerkUserId,
        requests: requests?.map((request) => ({
          field: request.field ?? '',
          message: request.message ?? '',
        })),
        reviewNote,
        packetVersion,
        packetHash,
        intendedStartDate,
        urgency,
      });

      res.json(result);
    }),
  );
}
