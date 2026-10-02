/**
 * Wave 187 — MATCHA Refoundation: Core Models
 *
 * Canonical type system for the MATCHA matching engine.
 * Replaces ad-hoc typing in eligibility.ts; eligibility.ts re-exports from here.
 */

// ── Credential system ─────────────────────────────────────────────────────────

export type CredentialKey =
  | 'state_license'
  | 'board_cert'
  | 'dea'
  | 'npi'
  | 'malpractice'
  | 'sanctions_clear'
  | 'work_auth'
  | 'cds' // controlled dangerous substances (state)
  | 'hospital_privileges'
  | 'bls'
  | 'acls'
  | 'atls';

export type ClaimLevel = 'L0' | 'L1' | 'L2' | 'L3';
export type CredentialStatus = 'active' | 'expiring' | 'expired' | 'not_found' | 'pending';

export interface HeldCredential {
  key: CredentialKey;
  status: CredentialStatus;
  claimLevel: ClaimLevel;
  issuer: string;
  state?: string;
  specialty?: string;
  expiresAt?: string;
}

// ── Opportunity model ─────────────────────────────────────────────────────────

export type HiringType = 'locums' | 'perm' | 'part-time' | 'telehealth' | 'prn' | 'short-term';
export type StartUrgency = 'immediate' | 'within_2_weeks' | 'within_month' | 'flexible';
export type EmployerType = 'hospital' | 'practice' | 'telehealth' | 'agency' | 'health_system';
export type MarketplaceUrgency = 'immediate' | 'within_30_days' | 'within_90_days';

export interface RequirementSpec {
  key: CredentialKey;
  label: string;
  level: 'L1' | 'L2' | 'L3';           // minimum claim level required
  priority: 'required' | 'preferred';
  state?: string;
  specialty?: string;
  note?: string;
}

export interface Opportunity {
  id: string;
  title: string;
  organization?: string;
  organizationId?: string;
  employerSlug: string;
  facility: string;
  location: string;
  state: string;
  specialty: string;
  department?: string;
  hiringType: HiringType;
  employerType: EmployerType;
  startUrgency: StartUrgency;
  payRange?: string;
  payMin?: number;   // USD/hr for normalization
  payMax?: number;
  premiumRate?: number;
  remote: boolean;
  requirements: RequirementSpec[];
  urgency: MarketplaceUrgency;
  minimumTrustBand: 'L1' | 'L2' | 'L3';
  credentialRequirements: string[];
  postedAt: string;
  expiresAt?: string;
  active: boolean;
  recentHires?: number;
  tags?: string[];
  /**
   * Whether "Apply with VitalCV" exists for this listing, decided by the one
   * server-side rule (`services/opportunities/integratedApply.ts`). Absent on
   * in-memory demo opportunities; every consumer treats absent as external.
   */
  applicationMode?: 'external' | 'vitalcv';
  /** The employer's own posting for a feed-carried row, when the feed had one. */
  sourceUrl?: string;
}

// ── Clinician profile ─────────────────────────────────────────────────────────

/**
 * Provenance of a ClinicianProfile.specialty value.
 *   nppes_taxonomy — read from the clinician's NPPES primary taxonomy (a real
 *                    source check; may be presented as "checked · NPPES").
 *   self_reported  — supplied by the clinician; on file, not source-confirmed.
 *   unknown        — no source (e.g. an unresolved default). Never checked.
 * A specialty may be called source-checked ONLY when this is `nppes_taxonomy`;
 * absent provenance is treated as `unknown`, so a caller that forgets to set it
 * can never over-claim. See matchaEngine `specialtyCoverageLabel`.
 */
export type SpecialtySource = 'nppes_taxonomy' | 'self_reported' | 'unknown';

export interface ClinicianProfile {
  npi: string;
  name: string;
  specialty: string;
  /** Where `specialty` came from. Absent ⇒ treated as unverified ('unknown'). */
  specialtySource?: SpecialtySource;
  states: string[];                      // licensed states
  workAuthStates?: string[];             // work auth regions
  credentials: HeldCredential[];
  prequalified?: boolean;
  assessmentsComplete?: string[];
  interviewComplete?: boolean;
}

// ── Candidate intent ──────────────────────────────────────────────────────────

export interface CandidateIntent {
  npi: string;
  preferredStates?: string[];
  preferredSpecialties?: string[];
  preferredHiringTypes?: HiringType[];
  payMin?: number;
  remoteOnly?: boolean;
  startUrgency?: StartUrgency;
  openToLocums?: boolean;
  openToTelehealth?: boolean;
  capturedAt?: string;
}

// ── Match output models ────────────────────────────────────────────────────────

export type MatchBand = 'CLEAR' | 'NEAR_CLEAR' | 'PARTIAL' | 'INELIGIBLE';

export interface MatchBlocker {
  credentialKey: CredentialKey;
  label: string;
  severity: 'hard' | 'soft';
  actionLabel: string;
  actionUrl?: string;
}

export interface FitReason {
  dimension: string;
  label: string;
  positive: boolean;
}

export interface MatchExplanation {
  matchBand: MatchBand;
  matchScore: number;              // 0–100
  confidence: number;             // 0–1
  fitReasons: FitReason[];
  blockers: MatchBlocker[];
  missingCredentials: CredentialKey[];
  instantOfferEligible: boolean;
  generatedAt: string;
}

export interface OpportunityMatch {
  opportunity: Opportunity;
  explanation: MatchExplanation;
}

// ── Instant offer eligibility ─────────────────────────────────────────────────

export interface InstantOfferEligibility {
  npi: string;
  opportunityId: string;
  eligible: boolean;
  score: number;
  reason: string;
  checkedAt: string;
}

// ── EligibilityDecision audit record ─────────────────────────────────────────

export interface EligibilityDecision {
  decisionId: string;
  npi: string;
  opportunityId: string;
  band: MatchBand;
  score: number;
  blockers: string[];
  decidedAt: string;
  version: '187.1';
}
