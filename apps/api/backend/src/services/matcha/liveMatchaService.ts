// @ts-nocheck
/**
 * liveMatchaService.ts — Wave 235
 *
 * Bridges live DB Opportunity records → MATCHA scoring engine.
 * Replaces mock data with real data while keeping the engine pure.
 *
 * Pipeline:
 *   NPI → NPPES profile → ClinicianProfile
 *   DB Opportunities (ACTIVE) → MATCHA Opportunity[]
 *   matchOpportunities() → scored, ranked results
 */

import { PrismaClient } from '@prisma/client';

import { matchOpportunities, scoreOpportunity } from './matchaEngine';
import { simulateCredentialImpact } from './matchaSimulator';
import type {
  CandidateIntent,
  ClinicianProfile,
  HeldCredential,
  HiringType,
  Opportunity as MatchaOpportunity,
  RequirementSpec,
  SpecialtySource,
} from './matchaModels';
import {
  seededOrgExclusionFilter,
} from '../opportunities/launchOpportunitySeed';
import { applicationModeFor } from '../opportunities/integratedApply';
import { buildBaseClinicianProfile } from './clinicianProfileFromNppes';

const prisma = new PrismaClient();

// seededOrgExclusionFilter (shared): when SEED_DEMO_OPPORTUNITIES is off (the
// prod default) it excludes opportunities belonging to the demo/launch seed
// organizations so live matching sees only real postings; on (dev/demo) it's a
// no-op. The same helper gates the public opportunity list/detail.

// ── NPPES → base profile ──────────────────────────────────────────────────────
// The NPPES mapping and its honesty rules live in a PURE module so they can be
// unit-tested without a database — this file cannot be loaded under ts-jest
// (`@ts-nocheck` + a module-scope PrismaClient), which is exactly why the
// fabrication it now prevents went untested. See clinicianProfileFromNppes.ts.

async function buildClinicianProfile(npi: string): Promise<ClinicianProfile | null> {
  const profile = await buildBaseClinicianProfile(npi);
  if (!profile) return null;

  const credentials = [...profile.credentials];

  // ── Enrich from CandidateCredential records (Wave 238) ──────────
  // If the clinician uploaded + confirmed credentials via Document Intelligence,
  // upgrade the claim level. This is the key loop: upload → parse → verify → better matches.
  try {
    const candidateCreds = await prisma.candidateCredential.findMany({
      where: { clinicianId: npi },
      orderBy: { createdAt: 'desc' },
    });

    for (const cc of candidateCreds) {
      const data = cc.data as Record<string, unknown> | null;
      if (!data) continue;
      const docType = (data.documentType as string) ?? '';
      const confidence = (data.overallConfidence as number) ?? 0;
      const ccStatus = cc.status; // UNVERIFIED, PENDING_VERIFICATION, VERIFIED

      // Map document type to credential key
      const typeToKey: Record<string, string> = {
        MEDICAL_LICENSE: 'state_license',
        DEA_CERTIFICATE: 'dea',
        BOARD_CERTIFICATION: 'board_cert',
      };

      const credKey = typeToKey[docType];
      if (!credKey) continue;

      // Determine claim level based on verification status + confidence
      let upgradedLevel: string;
      if (ccStatus === 'VERIFIED' || (ccStatus === 'PENDING_VERIFICATION' && confidence > 0.9)) {
        upgradedLevel = 'L3'; // Document verified or high-confidence confirmed
      } else if (ccStatus === 'PENDING_VERIFICATION') {
        upgradedLevel = 'L2'; // Confirmed by clinician, pending PSV
      } else {
        upgradedLevel = 'L2'; // Uploaded but unconfirmed — still better than L1
      }

      // Find and upgrade the credential entry
      const idx = credentials.findIndex(c => c.key === credKey);
      if (idx >= 0) {
        const existing = credentials[idx];
        // Only upgrade, never downgrade
        const levelOrder = ['L1', 'L2', 'L3'];
        if (levelOrder.indexOf(upgradedLevel) > levelOrder.indexOf(existing.claimLevel)) {
          credentials[idx] = {
            ...existing,
            status: 'active',
            claimLevel: upgradedLevel as 'L1' | 'L2' | 'L3',
          };
        }
      }
    }
  } catch (err) {
    // CandidateCredential enrichment is best-effort — don't fail the whole profile
  }

  // No jurisdiction default. An empty states list means "NPPES gave us no state",
  // which the engine reads as not-practising-there — the honest reading — rather
  // than silently placing every unknown provider in California.
  return { ...profile, credentials };
}

// ── Map DB Opportunity → MATCHA Opportunity ───────────────────────────────────

function requirementsFromLevel(
  level: string,
  specialty: string,
  state: string,
): RequirementSpec[] {
  const base: RequirementSpec[] = [
    { key: 'npi', label: 'NPI Verified', level: 'L1', priority: 'required' },
    { key: 'sanctions_clear', label: 'Sanctions Clear', level: 'L2', priority: 'required' },
    { key: 'state_license', label: `${state} Medical License`, level: 'L2', priority: 'required', state },
  ];

  if (level === 'L2' || level === 'L3') {
    base.push({ key: 'dea', label: 'DEA Registration', level: 'L2', priority: 'required' });
    base.push({ key: 'malpractice', label: 'Malpractice Insurance', level: 'L2', priority: 'preferred' });
  }

  if (level === 'L3') {
    base.push({
      key: 'board_cert',
      label: `${specialty} Board Certification`,
      level: 'L3',
      priority: 'required',
      specialty,
    });
  }

  return base;
}

// Employer-posted enums → engine enums, with a safe fallback for older postings
// (or free-text) that predate the structured columns.
const EMPLOYER_TYPES = new Set(['hospital', 'practice', 'telehealth', 'agency', 'health_system']);
function normalizeEmployerType(v: string | null | undefined): MatchaOpportunity['employerType'] {
  return v && EMPLOYER_TYPES.has(v) ? (v as MatchaOpportunity['employerType']) : 'hospital';
}
const START_URGENCIES = new Set(['immediate', 'within_2_weeks', 'within_month', 'flexible']);
function normalizeStartUrgency(v: string | null | undefined): MatchaOpportunity['startUrgency'] {
  return v && START_URGENCIES.has(v) ? (v as MatchaOpportunity['startUrgency']) : 'flexible';
}

function dbOppToMatcha(opp: {
  id: string;
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  payRange: string | null;
  payMin?: number | null;
  payMax?: number | null;
  employerType?: string | null;
  startUrgency?: string | null;
  requirementLevel: string;
  remote: boolean;
  status: string;
  createdAt: Date;
  listingSource?: string | null;
  sourceUrl?: string | null;
  organization?: {
    id: string;
    name: string;
    organizationProfile?: { id: string } | null;
  } | null;
}): MatchaOpportunity {
  return {
    id: opp.id,
    title: opp.title,
    organization: opp.organization?.name ?? 'Healthcare Organization',
    organizationId: opp.organization?.id,
    // Whether "Apply with VitalCV" exists for this row — the SAME rule the
    // apply service enforces, so the deck, the public-safe projection and the
    // matcha cards never advertise a path the server refuses. A feed-carried
    // row keeps its source page so a surface can point at the real posting.
    applicationMode: applicationModeFor({
      listingSource: opp.listingSource,
      organizationName: opp.organization?.name,
      hasOrganizationProfile: Boolean(opp.organization?.organizationProfile),
    }),
    sourceUrl: opp.sourceUrl ?? undefined,
    employerSlug: opp.organization?.id ?? 'unknown',
    facility: opp.organization?.name ?? 'Healthcare Organization',
    location: `${opp.state}`,
    state: opp.state,
    specialty: opp.specialty,
    hiringType: (opp.hiringType as HiringType) || 'perm',
    // Employer-posted structured fields drive real scoring (comp/urgency/
    // employer-fit); fall back to the old defaults when a posting omits them.
    employerType: normalizeEmployerType(opp.employerType),
    startUrgency: normalizeStartUrgency(opp.startUrgency),
    urgency: 'within_90_days',
    payRange: opp.payRange ?? undefined,
    payMin: opp.payMin ?? undefined,
    payMax: opp.payMax ?? undefined,
    remote: opp.remote ?? false,
    requirements: requirementsFromLevel(opp.requirementLevel, opp.specialty, opp.state),
    minimumTrustBand: opp.requirementLevel === 'L3'
      ? 'L3'
      : opp.requirementLevel === 'L2'
        ? 'L2'
        : 'L1',
    credentialRequirements: requirementsFromLevel(opp.requirementLevel, opp.specialty, opp.state)
      .map((requirement) => requirement.label),
    postedAt: opp.createdAt.toISOString(),
    active: opp.status === 'ACTIVE',
    tags: [opp.specialty.toLowerCase(), opp.state, opp.hiringType],
  };
}

// ── Main service functions ─────────────────────────────────────────────────────

export async function getLiveMatchesForNpi(
  npi: string,
  filters?: { specialty?: string; state?: string; hiringType?: string },
  // The clinician's stated preferences, mapped to the engine's CandidateIntent
  // by the web proxy (which holds the durable, Clerk-scoped preference store).
  // When present, ~50 of the 100 scoring points respond to what the clinician
  // WANTS (location, hiring type, pay, remote, timing) on top of what they're
  // credentialed FOR. When absent, ranking falls back to credentials only.
  intent?: CandidateIntent | null,
) {
  const [profile, dbOpportunities] = await Promise.all([
    buildClinicianProfile(npi),
    prisma.opportunity.findMany({
      where: {
        status: 'ACTIVE',
        ...seededOrgExclusionFilter(),
        ...(filters?.specialty ? { specialty: { contains: filters.specialty, mode: 'insensitive' } } : {}),
        ...(filters?.state ? { state: filters.state } : {}),
        ...(filters?.hiringType ? { hiringType: filters.hiringType } : {}),
      },
      include: { organization: { select: { id: true, name: true, organizationProfile: { select: { id: true } } } } },
      take: 50,
    }),
  ]);

  // NPPES could not resolve this NPI to an individual provider — it does not
  // exist, it is an organisation, or the registry was unreachable. Matching a
  // clinician we cannot identify means inventing one, so return an honest empty
  // result instead. `unresolved` lets callers say why rather than show "no roles".
  if (!profile) {
    return {
      npi,
      unresolved: true as const,
      reason: 'npi_not_resolved_to_individual_provider' as const,
      clinicianName: null,
      specialty: null,
      state: null,
      matches: [],
      profileCompleteness: { level: 'unknown' as const, missingForHigherMatches: [] },
    };
  }

  const matchaOpps = dbOpportunities.map(dbOppToMatcha);
  const matches = matchOpportunities(profile, intent ?? null, matchaOpps);

  return {
    npi,
    clinicianName: profile.name,
    specialty: profile.specialty,
    state: profile.states[0],
    matches: matches.map(m => ({
      opportunityId: m.opportunity.id,
      band: m.explanation.matchBand,
      score: m.explanation.matchScore,
      blockers: m.explanation.blockers.map(b => ({ label: b.label, action: b.actionLabel })),
      fitReasons: m.explanation.fitReasons.map(f => f.label),
      // Full objects for the clinician surfaces (cards + detail view). The slim
      // fields above are kept for existing consumers — additive only.
      opportunity: m.opportunity,
      explanation: m.explanation,
    })),
    profileCompleteness: {
      level: profile.credentials.some(c => c.claimLevel === 'L1') ? 'partial' : 'full',
      missingForHigherMatches: profile.credentials
        .filter(c => c.status === 'pending' || c.claimLevel === 'L1')
        .map(c => c.key),
    },
  };
}

/**
 * Deterministic "what if" simulation for a clinician's real live roles.
 * Loads the same real ClinicianProfile + active Opportunity set as the live
 * match, then re-scores with each blocking credential hypothetically earned.
 * Never mutates evidence; every number is the engine's own recomputed output.
 */
export async function simulateForNpi(npi: string) {
  const [profile, dbOpportunities] = await Promise.all([
    buildClinicianProfile(npi),
    prisma.opportunity.findMany({
      where: { status: 'ACTIVE', ...seededOrgExclusionFilter() },
      include: { organization: { select: { id: true, name: true, organizationProfile: { select: { id: true } } } } },
      take: 50,
    }),
  ]);

  // Same rule as the live match: no identified provider, no simulation. A
  // "what if you earned X" projection over an invented profile is fiction.
  if (!profile) {
    return {
      npi,
      unresolved: true as const,
      reason: 'npi_not_resolved_to_individual_provider' as const,
      clinicianName: null,
      specialty: null,
      scenarios: [],
    };
  }

  const matchaOpps = dbOpportunities.map(dbOppToMatcha);
  const result = simulateCredentialImpact(profile, matchaOpps, new Date().toISOString());

  return {
    npi,
    clinicianName: profile.name,
    specialty: profile.specialty,
    ...result,
  };
}

export async function scoreOpportunityForNpi(
  npi: string,
  opportunityId: string,
  intent?: CandidateIntent | null,
) {
  const [profile, dbOpp] = await Promise.all([
    buildClinicianProfile(npi),
    prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { organization: { select: { id: true, name: true, organizationProfile: { select: { id: true } } } } },
    }),
  ]);

  if (!dbOpp) return null;
  // An unidentified NPI cannot be scored against a role without inventing the
  // credentials the score would be made of. Null, same as an unknown opportunity.
  if (!profile) return null;
  const matchaOpp = dbOppToMatcha(dbOpp);
  const explanation = scoreOpportunity(profile, intent ?? null, matchaOpp);

  return {
    npi,
    opportunityId,
    band: explanation.matchBand,
    score: explanation.matchScore,
    blockers: explanation.blockers.map(b => ({ label: b.label, action: b.actionLabel })),
    fitReasons: explanation.fitReasons.map(f => f.label),
  };
}
