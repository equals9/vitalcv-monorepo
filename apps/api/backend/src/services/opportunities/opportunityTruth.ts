import prisma from '../../graphql/prisma_client';
import { parseOrganizationRequirementsEnvelope } from '../employers/pilotPolicy';
import { isFeedListingSource } from './integratedApply';

type RequirementLevel = 'L1' | 'L2' | 'L3';
type CredentialKey =
  | 'state_license'
  | 'board_cert'
  | 'dea'
  | 'npi'
  | 'malpractice'
  | 'sanctions_clear'
  | 'work_auth'
  | 'hospital_privileges'
  | 'bls'
  | 'acls'
  | 'atls';

export type OpportunityPayModel = 'salary' | 'hourly' | 'locums' | 'shift' | 'unknown';
export type OpportunityPayUnit = 'year' | 'hour' | 'shift' | 'unknown';
export type OpportunityVisaStatus = 'available' | 'case_by_case' | 'not_available' | 'not_stated';
export type OpportunityBenefitsAvailability = 'listed' | 'limited' | 'not_listed';
export type OpportunityStartUrgency = 'immediate' | 'within_2_weeks' | 'within_month' | 'flexible' | 'unknown';
export type OpportunityFreshness = 'fresh' | 'aging' | 'stale';
export type OpportunityDataStatus = 'complete' | 'partial' | 'limited';
export type OpportunityReadinessStatus = 'ready_now' | 'needs_review' | 'requirements_missing';
export type OpportunityProfession =
  | 'physician'
  | 'advanced_practice'
  | 'nursing'
  | 'behavioral_health'
  | 'allied_health'
  | 'not_stated';
export type OpportunitySchedule = 'full_time' | 'part_time' | 'per_diem' | 'flexible' | 'not_stated';
export type OpportunityAvailabilityState = 'open' | 'stale' | 'closed' | 'source_unavailable';
export type OpportunityAvailabilityConfidence =
  | 'recent_observation'
  | 'aging_observation'
  | 'stale_observation'
  | 'not_observed';

interface OrganizationRequirementRecord {
  label: string;
  level: RequirementLevel;
  note?: string;
  key?: string;
  priority?: 'required' | 'preferred';
  state?: string;
  specialty?: string;
}

interface CandidateCredentialRecord {
  status: string;
  data: unknown;
}

export interface ClinicianHeldCredential {
  key: CredentialKey;
  level: RequirementLevel;
  status: 'active' | 'pending' | 'expired' | 'unknown';
  state: string | null;
  specialty: string | null;
  source: string;
}

export interface ClinicianOpportunityProfile {
  npi: string;
  specialty: string | null;
  stateOfPractice: string | null;
  states: string[];
  workAuthStatus: string | null;
  credentials: ClinicianHeldCredential[];
}

export interface OpportunityRequirementTruth {
  label: string;
  level: RequirementLevel;
  note: string | null;
  key: CredentialKey | null;
  priority: 'required' | 'preferred';
  state: string | null;
  specialty: string | null;
}

export interface OpportunityComparisonItem {
  label: string;
  detail: string;
  key: CredentialKey | null;
  level: RequirementLevel | null;
  nextStep: string | null;
}

export interface OpportunityReadinessComparison {
  clinicianNpi: string;
  status: OpportunityReadinessStatus;
  satisfied: OpportunityComparisonItem[];
  missing: OpportunityComparisonItem[];
  unknown: OpportunityComparisonItem[];
  fitIndicators: string[];
  estimatedGap: string;
  shortestPath: string;
}

export interface OpportunityExplanation {
  whyThisMayFit: string[];
  whatMayBlockYou: string[];
  resolveNext: string[];
  stillUnknown: string[];
}

export interface OpportunityTruth {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  title: string;
  specialty: string;
  profession: OpportunityProfession;
  schedule: OpportunitySchedule;
  hiringType: string;
  state: string;
  payRange: string | null;
  requirementLevel: string;
  description: string | null;
  remote: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  employerType: string | null;
  payModel: OpportunityPayModel;
  payUnit: OpportunityPayUnit;
  payRangeMin: number | null;
  payRangeMax: number | null;
  visaSponsorshipStatus: OpportunityVisaStatus;
  visaSponsorshipSummary: string | null;
  benefitsAvailability: OpportunityBenefitsAvailability;
  benefitsSummary: string | null;
  benefitsItems: string[];
  startTimeline: string | null;
  startUrgency: OpportunityStartUrgency;
  speedToStartDays: number | null;
  credentialRequirements: OpportunityRequirementTruth[];
  trustIndicators: string[];
  freshness: {
    listingStatus: OpportunityFreshness;
    employerDataStatus: OpportunityDataStatus;
    completenessScore: number;
    isStale: boolean;
    isUncertain: boolean;
    lastUpdatedAt: string;
    compensationVerifiedAt: string | null;
    benefitsVerifiedAt: string | null;
    visaVerifiedAt: string | null;
  };
  source: {
    kind: 'employer_profile' | 'opportunity' | 'public_feed';
    label: string;
    updatedAt: string;
    /** Original feed posting or the canonical VitalCV opportunity record. */
    url: string | null;
    /** Feed listings only: when the feed was read. A fetch, not a verification. */
    fetchedAt: string | null;
  };
  /**
   * True when this row was copied from a public feed rather than posted by an
   * employer who claimed a Type 2 NPI. Consumers must not render employer-stated
   * language, a readiness comparison, or a VitalCV apply path for these.
   */
  isFeedListing: boolean;
  availability: {
    state: OpportunityAvailabilityState;
    confidence: OpportunityAvailabilityConfidence;
    observedAt: string | null;
    limitation: string;
  };
  applicationMode: 'external' | 'vitalcv';
  compensationProvenance: {
    state: 'supplied' | 'not_supplied';
    method: 'structured_source' | 'source_text' | 'not_supplied';
    sourceLabel: string;
    observedAt: string | null;
  };
  transparency: {
    hiringState: string;
    speedToStartEstimate: string;
    sponsorshipSupport: string;
    benefitsVisibility: string;
    listingFreshness: string;
    employerDataCompleteness: string;
    evidence: string[];
  };
  comparison: OpportunityReadinessComparison | null;
  explanation: OpportunityExplanation;
}

export interface OpportunityTruthFilters {
  specialty?: string;
  profession?: OpportunityProfession;
  schedule?: OpportunitySchedule;
  state?: string;
  hiringType?: string;
  organizationSlug?: string;
  remote?: boolean;
  payModel?: OpportunityPayModel;
  payMin?: number;
  payMax?: number;
  visaSponsorship?: OpportunityVisaStatus;
  benefits?: OpportunityBenefitsAvailability;
  applicationMode?: 'external' | 'vitalcv';
  compensation?: 'supplied' | 'not_supplied';
  observedWithinDays?: number;
  employerType?: string;
  startUrgency?: OpportunityStartUrgency;
  readinessStatus?: OpportunityReadinessStatus;
  missingRequirement?: string;
}

/**
 * The structured columns win over the text derivations.
 *
 * createOpportunity writes pay_min/pay_max/employer_type/start_urgency and the
 * MATCHA engine scores on them, but the public read path used to re-derive all
 * four by regex over prose and never look at the columns. A role posted with a
 * structured pay range and no prose one therefore reported payRangeMin/Max as
 * null — and matchesOpportunityTruthFilters DROPS a row whose payRangeMax is
 * null, so filtering by pay hid exactly the roles with the best pay data.
 *
 * These resolvers read the column first and fall back to the derivation, so
 * rows written before the columns existed keep working unchanged.
 */
function resolveStructuredPay(
  opportunity: Pick<OpportunityTruthRecord, 'payMin' | 'payMax'>,
): { min: number | null; max: number | null } {
  const clean = (value: number | null | undefined): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

  const min = clean(opportunity.payMin);
  const max = clean(opportunity.payMax);

  // A reversed pair is employer data entry, not a reason to publish nonsense.
  if (min !== null && max !== null && min > max) {
    return { min: max, max: min };
  }

  return { min, max };
}

function resolveEmployerType(
  opportunity: Pick<OpportunityTruthRecord, 'employerType'>,
  organizationProfile: { facilityType?: string | null } | null | undefined,
): string | null {
  const own = normalizeEmployerType(opportunity.employerType ?? null);
  return own ?? normalizeEmployerType(organizationProfile?.facilityType ?? null);
}

function resolveStartUrgency(
  opportunity: Pick<OpportunityTruthRecord, 'startUrgency'>,
  startTimeline: string | null,
): OpportunityStartUrgency {
  const own = (opportunity.startUrgency ?? '').trim();
  // Validated against the known set — an unrecognised column value must not
  // leak into the API as if it were a real state.
  if ((SUPPORTED_START_URGENCIES as readonly string[]).includes(own)) {
    return own as OpportunityStartUrgency;
  }
  return deriveStartUrgency(startTimeline);
}

/**
 * Display names for the feeds we ingest. The label names the FEED, never the
 * employer — "Listed on USAJOBS" is a fact we can stand behind; anything
 * phrased as the employer speaking to VitalCV would not be.
 */
const FEED_LABEL: Record<string, string> = {
  usajobs: 'USAJOBS',
};

const SUPPORTED_START_URGENCIES: readonly OpportunityStartUrgency[] = [
  'immediate',
  'within_2_weeks',
  'within_month',
  'flexible',
  'unknown',
];

export interface OpportunityTruthRecord {
  id: string;
  organizationId: string;
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  payRange: string | null;
  /**
   * Structured columns on Opportunity, written by createOpportunity and scored
   * by the MATCHA engine. AUTHORITATIVE where present — the free-text
   * derivations are the fallback for rows posted before these columns existed.
   * Optional because several call sites build partial records.
   */
  payMin?: number | null;
  payMax?: number | null;
  employerType?: string | null;
  startUrgency?: string | null;
  /** 'employer_posted' (default) or 'public_feed'. See the Prisma model. */
  listingSource?: string | null;
  sourceFeed?: string | null;
  sourceRef?: string | null;
  sourceUrl?: string | null;
  fetchedAt?: Date | null;
  requirementLevel: string;
  description: string | null;
  remote: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    name: string;
    slug: string;
    organizationProfile: {
      facilityType: string | null;
      hiringStatus: string;
      timeToStart: string | null;
      timeToOnboard: string | null;
      clearToStartThreshold: string | null;
      payTransparency: boolean;
      payRange: string | null;
      description: string | null;
      tagline: string | null;
      requirements: unknown;
      verifiedSince: Date | null;
      verified: boolean;
      updatedAt: Date;
    } | null;
  };
}

const SUPPORTED_CREDENTIAL_KEYS: readonly CredentialKey[] = [
  'state_license',
  'board_cert',
  'dea',
  'npi',
  'malpractice',
  'sanctions_clear',
  'work_auth',
  'hospital_privileges',
  'bls',
  'acls',
  'atls',
] as const;

const BENEFIT_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'Housing stipend', pattern: /\bhousing stipend\b/i },
  { label: 'Travel support', pattern: /\btravel (support|coverage|stipend)\b/i },
  { label: 'Night shift differential', pattern: /\bnight shift differential\b/i },
  { label: 'Credentialing coordination', pattern: /\bcredentialing coordination\b/i },
  { label: 'Onboarding support', pattern: /\bonboarding support\b/i },
  { label: 'Payer enrollment support', pattern: /\bpayer enrollment\b/i },
];

const LEVEL_ORDER: Record<RequirementLevel, number> = {
  L1: 1,
  L2: 2,
  L3: 3,
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface NppesTaxonomyRecord {
  primary?: boolean;
  state?: string;
  desc?: string;
}

interface NppesAddressRecord {
  address_purpose?: string;
  state?: string;
}

interface NppesBasicRecord {
  first_name?: string;
  last_name?: string;
  authorized_official_first_name?: string;
  authorized_official_last_name?: string;
}

interface NppesResultRecord {
  basic?: NppesBasicRecord;
  taxonomies?: NppesTaxonomyRecord[];
  addresses?: NppesAddressRecord[];
}

interface NppesResponse {
  results?: NppesResultRecord[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRequirementLevel(value: string | null | undefined): RequirementLevel {
  return value === 'L3' || value === 'L2' || value === 'L1' ? value : 'L1';
}

function normalizeCredentialKey(value: string | null | undefined): CredentialKey | null {
  if (!value) {
    return null;
  }

  return SUPPORTED_CREDENTIAL_KEYS.includes(value as CredentialKey)
    ? value as CredentialKey
    : null;
}

function isoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parsePayRange(payRange: string | null): {
  min: number | null;
  max: number | null;
  unit: OpportunityPayUnit;
} {
  if (!payRange) {
    return { min: null, max: null, unit: 'unknown' };
  }

  const unit: OpportunityPayUnit = /\/\s*hr\b/i.test(payRange)
    ? 'hour'
    : /\bshift\b/i.test(payRange)
      ? 'shift'
      : /\bk\b/i.test(payRange) || /\b(year|annual|salary)\b/i.test(payRange)
        ? 'year'
        : 'unknown';

  const values = [...payRange.matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*(k)?/gi)]
    .map((match) => {
      const raw = Number.parseFloat(match[1] ?? '');
      if (!Number.isFinite(raw)) {
        return null;
      }

      return match[2] ? raw * 1000 : raw;
    })
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return { min: null, max: null, unit };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    unit,
  };
}

function inferPayModel(hiringType: string, payRange: string | null): OpportunityPayModel {
  if (hiringType === 'locums') {
    return 'locums';
  }
  if (/\bshift\b/i.test(payRange ?? '')) {
    return 'shift';
  }
  if (/\bk\b/i.test(payRange ?? '') || /\b(year|annual|salary)\b/i.test(payRange ?? '') || hiringType === 'perm') {
    return 'salary';
  }
  if (/\/\s*hr\b/i.test(payRange ?? '') || hiringType === 'telehealth' || hiringType === 'contract') {
    return 'hourly';
  }

  return 'unknown';
}

/**
 * Conservative title classification for public browsing. This is a display
 * facet, not a license inference or an eligibility decision.
 */
export function classifyOpportunityProfession(title: string): OpportunityProfession {
  const value = title.trim().toLowerCase();
  if (!value) return 'not_stated';

  if (/\b(nurse practitioner|physician assistant|pa-c|advanced practice|app)\b/i.test(value)) {
    return 'advanced_practice';
  }
  if (/\b(physician|medical director|psychiatrist|doctor|md\/do|md or do|hospitalist|cardiologist|anesthesiologist|neurologist|radiologist|surgeon|oncologist|internist|pediatrician|dermatologist|gastroenterologist|nephrologist|pulmonologist|rheumatologist|urologist|pathologist|ophthalmologist|otolaryngologist|endocrinologist|hematologist|intensivist|physiatrist|gynecologist|obstetrician)\b/i.test(value)) {
    return 'physician';
  }
  if (/\b(registered nurse|nurse|nursing|rn|lpn|lvn|cna)\b/i.test(value)) {
    return 'nursing';
  }
  if (/\b(therapist|therapy|psychologist|counselor|counsellor|social worker|lcsw|lmft|lpcc?)\b/i.test(value)) {
    return 'behavioral_health';
  }
  if (/\b(pharmacist|dietitian|dietician|medical assistant|phlebotom|sonographer|radiolog|midwife|dentist|hygienist|optometrist|podiatrist|paramedic)\b/i.test(value)) {
    return 'allied_health';
  }
  return 'not_stated';
}

/**
 * Schedule is published only when the title or a labelled listing field says
 * it. A stray mention of a full-time colleague must not classify the role.
 */
export function classifyOpportunitySchedule(
  title: string,
  description: string | null,
): OpportunitySchedule {
  const titleText = title.trim();
  const labelled = (description ?? '').match(
    /\b(?:employment type|position type|schedule)\s*:?\s*(full[- ]time|part[- ]time|per diem|prn|flexible)\b/i,
  )?.[1] ?? '';
  const signal = `${titleText} ${labelled}`;

  if (/\b(part[- ]time)\b/i.test(signal)) return 'part_time';
  if (/\b(per diem|prn)\b/i.test(signal)) return 'per_diem';
  if (/\b(full[- ]time)\b/i.test(signal)) return 'full_time';
  if (/\bflexible\b/i.test(signal)) return 'flexible';
  return 'not_stated';
}

function normalizeEmployerType(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/_/g, ' ').trim();
}

function deriveStartUrgency(value: string | null): OpportunityStartUrgency {
  if (!value) {
    return 'unknown';
  }

  const lower = value.toLowerCase();
  if (lower.includes('immediate') || lower.includes('asap')) {
    return 'immediate';
  }
  if (lower.includes('flexible')) {
    return 'flexible';
  }

  const numbers = [...lower.matchAll(/(\d+)/g)]
    .map((match) => Number.parseInt(match[1] ?? '', 10))
    .filter((entry) => Number.isFinite(entry));
  const maxValue = numbers.length > 0 ? Math.max(...numbers) : null;

  if (maxValue !== null && lower.includes('day')) {
    if (maxValue <= 14) {
      return 'within_2_weeks';
    }
    if (maxValue <= 31) {
      return 'within_month';
    }
  }

  if (maxValue !== null && lower.includes('week')) {
    if (maxValue <= 2) {
      return 'within_2_weeks';
    }
    if (maxValue <= 4) {
      return 'within_month';
    }
  }

  return 'unknown';
}

function deriveSpeedToStartDays(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const lower = value.toLowerCase();
  if (lower.includes('immediate')) {
    return 3;
  }
  if (lower.includes('flexible')) {
    return null;
  }

  const numbers = [...lower.matchAll(/(\d+)/g)]
    .map((match) => Number.parseInt(match[1] ?? '', 10))
    .filter((entry) => Number.isFinite(entry));
  if (numbers.length === 0) {
    return null;
  }

  const average = Math.round(numbers.reduce((sum, current) => sum + current, 0) / numbers.length);
  if (lower.includes('day')) {
    return average;
  }
  if (lower.includes('week')) {
    return average * 7;
  }

  return null;
}

function classifyFreshness(updatedAt: string, now: Date): OpportunityFreshness {
  const ageDays = Math.floor((now.getTime() - new Date(updatedAt).getTime()) / DAY_IN_MS);
  if (ageDays <= 14) {
    return 'fresh';
  }
  if (ageDays <= 45) {
    return 'aging';
  }
  return 'stale';
}

function inferCredentialKey(requirement: OrganizationRequirementRecord): CredentialKey | null {
  const explicit = normalizeCredentialKey(asString(requirement.key));
  if (explicit) {
    return explicit;
  }

  const text = `${requirement.label} ${requirement.note ?? ''}`.toLowerCase();
  if (text.includes('license')) return 'state_license';
  if (text.includes('board')) return 'board_cert';
  if (text.includes('dea')) return 'dea';
  if (text.includes('npi')) return 'npi';
  if (text.includes('malpractice')) return 'malpractice';
  if (text.includes('sanction') || text.includes('npdb')) return 'sanctions_clear';
  if (text.includes('privileg') || text.includes('credentialing file')) return 'hospital_privileges';
  if (/\bbls\b/i.test(text)) return 'bls';
  if (/\bacls\b/i.test(text)) return 'acls';
  if (/\batls\b/i.test(text)) return 'atls';
  if (text.includes('work auth') || text.includes('visa')) return 'work_auth';
  return null;
}

function normalizeRequirementPriority(value: string | null | undefined, note: string | null): 'required' | 'preferred' {
  if (value === 'preferred' || (note ?? '').toLowerCase().includes('preferred')) {
    return 'preferred';
  }
  return 'required';
}

function buildFallbackRequirements(input: {
  requirementLevel: string;
  opportunityState: string;
  specialty: string;
}): OpportunityRequirementTruth[] {
  const base: OpportunityRequirementTruth[] = [
    {
      label: 'NPI Verified',
      level: 'L1',
      note: null,
      key: 'npi',
      priority: 'required',
      state: null,
      specialty: null,
    },
    {
      label: `${input.opportunityState} Medical License`,
      level: input.requirementLevel === 'L3' ? 'L3' : 'L2',
      note: null,
      key: 'state_license',
      priority: 'required',
      state: input.opportunityState,
      specialty: null,
    },
    {
      label: 'Sanctions Clear',
      level: 'L2',
      note: null,
      key: 'sanctions_clear',
      priority: 'required',
      state: null,
      specialty: null,
    },
  ];

  if (input.requirementLevel === 'L2' || input.requirementLevel === 'L3') {
    base.push({
      label: 'DEA Registration',
      level: 'L2',
      note: null,
      key: 'dea',
      priority: 'required',
      state: input.opportunityState,
      specialty: null,
    });
  }

  if (input.requirementLevel === 'L3') {
    base.push({
      label: `${input.specialty} Board Certification`,
      level: 'L3',
      note: null,
      key: 'board_cert',
      priority: 'required',
      state: null,
      specialty: input.specialty,
    });
  }

  return base;
}

function buildRequirementTruth(
  requirement: OrganizationRequirementRecord,
  opportunityState: string,
  specialty: string,
): OpportunityRequirementTruth {
  const key = inferCredentialKey(requirement);
  const note = asString(requirement.note);

  return {
    label: requirement.label,
    level: normalizeRequirementLevel(requirement.level),
    note,
    key,
    priority: normalizeRequirementPriority(asString(requirement.priority), note),
    state: asString(requirement.state) ?? (key === 'state_license' ? opportunityState : null),
    specialty: asString(requirement.specialty) ?? (key === 'board_cert' ? specialty : null),
  };
}

function buildRequirementList(opportunity: OpportunityTruthRecord): OpportunityRequirementTruth[] {
  const organizationProfile = opportunity.organization.organizationProfile;
  const envelope = parseOrganizationRequirementsEnvelope(
    organizationProfile?.requirements,
    [],
  );
  const requirements = envelope.requirements.map((requirement) => buildRequirementTruth({
    label: requirement.label,
    level: requirement.level,
    note: requirement.note,
    key: requirement.key,
    priority: requirement.priority,
    state: requirement.state,
    specialty: requirement.specialty,
  }, opportunity.state, opportunity.specialty));

  return requirements.length > 0
    ? requirements
    : buildFallbackRequirements({
      requirementLevel: opportunity.requirementLevel,
      opportunityState: opportunity.state,
      specialty: opportunity.specialty,
    });
}

function deriveBenefits(input: {
  description: string | null;
  employerDescription: string | null;
  tagline: string | null;
}): {
  availability: OpportunityBenefitsAvailability;
  summary: string | null;
  items: string[];
} {
  const texts = [input.description, input.employerDescription, input.tagline].filter((value): value is string => Boolean(value));
  const items = BENEFIT_PATTERNS
    .filter((entry) => texts.some((text) => entry.pattern.test(text)))
    .map((entry) => entry.label);

  if (items.length === 0) {
    return {
      availability: 'not_listed',
      summary: null,
      items: [],
    };
  }

  return {
    availability: items.length >= 2 ? 'listed' : 'limited',
    summary: items.join(', '),
    items,
  };
}

function deriveVisaSponsorship(input: {
  description: string | null;
  employerDescription: string | null;
  tagline: string | null;
  clearToStartThreshold: string | null;
}): {
  status: OpportunityVisaStatus;
  summary: string | null;
} {
  const combined = [
    input.description,
    input.employerDescription,
    input.tagline,
    input.clearToStartThreshold,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  const lower = combined.toLowerCase();

  if (/\b(no visa|no sponsorship|does not sponsor)\b/i.test(lower)) {
    return { status: 'not_available', summary: 'Current employer data says sponsorship is not supported for this role.' };
  }
  if (/\b(case[- ]by[- ]case|waiver support|cap[- ]exempt)\b/i.test(lower)) {
    return { status: 'case_by_case', summary: 'Current employer data indicates sponsorship is reviewed case by case.' };
  }
  if (/\bvisa sponsorship|h-1b|j-1|green card|immigration support|sponsor\b/i.test(lower)) {
    return { status: 'available', summary: 'Current employer data states that sponsorship support is available.' };
  }

  return { status: 'not_stated', summary: null };
}

function buildTrustIndicators(input: {
  payRange: string | null;
  requirements: OpportunityRequirementTruth[];
  verified: boolean;
  startTimeline: string | null;
  benefitsAvailability: OpportunityBenefitsAvailability;
  visaStatus: OpportunityVisaStatus;
  freshness: OpportunityFreshness;
}): string[] {
  const indicators: string[] = [];

  if (input.payRange) {
    indicators.push('Pay range disclosed');
  }
  if (input.requirements.length > 0) {
    indicators.push('Requirements listed');
  }
  if (input.verified) {
    indicators.push('Verified employer profile');
  }
  if (input.startTimeline) {
    indicators.push('Start timeline shared');
  }
  if (input.benefitsAvailability !== 'not_listed') {
    indicators.push('Support details listed');
  }
  if (input.visaStatus !== 'not_stated') {
    indicators.push('Visa policy stated');
  }
  if (input.freshness === 'fresh') {
    indicators.push('Recently updated');
  }

  return indicators;
}

function buildFreshness(input: {
  opportunityUpdatedAt: string;
  employerUpdatedAt: string | null;
  payRange: string | null;
  benefitsAvailability: OpportunityBenefitsAvailability;
  visaStatus: OpportunityVisaStatus;
  now: Date;
}): OpportunityTruth['freshness'] {
  // Listing freshness belongs to the opportunity record. A recently edited
  // organization profile must not make an old role look newly observed.
  const lastUpdatedAt = input.opportunityUpdatedAt;
  const listingStatus = classifyFreshness(lastUpdatedAt, input.now);

  const completenessFactors = [
    input.payRange ? 1 : 0,
    input.benefitsAvailability !== 'not_listed' ? 1 : 0,
    input.visaStatus !== 'not_stated' ? 1 : 0,
    input.employerUpdatedAt ? 1 : 0,
  ];
  const baseScore = 45 + completenessFactors.reduce((sum, current) => sum + current, 0) * 13;
  const freshnessBonus = listingStatus === 'fresh' ? 10 : listingStatus === 'aging' ? 5 : 0;
  const completenessScore = Math.min(100, baseScore + freshnessBonus);
  const employerDataStatus: OpportunityDataStatus = completenessScore >= 80
    ? 'complete'
    : completenessScore >= 55
      ? 'partial'
      : 'limited';

  return {
    listingStatus,
    employerDataStatus,
    completenessScore,
    isStale: listingStatus === 'stale',
    isUncertain: employerDataStatus !== 'complete'
      || input.benefitsAvailability === 'not_listed'
      || input.visaStatus === 'not_stated',
    lastUpdatedAt,
    compensationVerifiedAt: input.payRange ? lastUpdatedAt : null,
    benefitsVerifiedAt: input.benefitsAvailability !== 'not_listed' ? lastUpdatedAt : null,
    visaVerifiedAt: input.visaStatus !== 'not_stated' ? lastUpdatedAt : null,
  };
}

function buildTransparency(input: {
  hiringStatus: string;
  startTimeline: string | null;
  timeToOnboard: string | null;
  visaStatus: OpportunityVisaStatus;
  benefitsAvailability: OpportunityBenefitsAvailability;
  freshness: OpportunityTruth['freshness'];
}): OpportunityTruth['transparency'] {
  const evidence: string[] = [];
  if (input.startTimeline) {
    evidence.push(`Employer shared start timing (${input.startTimeline}).`);
  }
  if (input.timeToOnboard) {
    evidence.push(`Onboarding window listed as ${input.timeToOnboard}.`);
  }
  if (input.freshness.compensationVerifiedAt) {
    evidence.push('Compensation is disclosed in the current source data.');
  }
  if (input.benefitsAvailability !== 'not_listed') {
    evidence.push('Support details are visible in the current source data.');
  }
  if (input.visaStatus !== 'not_stated') {
    evidence.push('Visa policy is stated in the current source data.');
  }

  return {
    hiringState: input.hiringStatus.replace(/_/g, ' ').toLowerCase(),
    speedToStartEstimate: input.startTimeline
      ? input.timeToOnboard
        ? `${input.startTimeline} to start; ${input.timeToOnboard} onboarding`
        : input.startTimeline
      : 'Start timing not stated',
    sponsorshipSupport: input.visaStatus === 'available'
      ? 'Sponsorship available'
      : input.visaStatus === 'case_by_case'
        ? 'Sponsorship case by case'
        : input.visaStatus === 'not_available'
          ? 'No sponsorship support'
          : 'Visa policy not stated',
    benefitsVisibility: input.benefitsAvailability === 'listed'
      ? 'Benefits/support listed'
      : input.benefitsAvailability === 'limited'
        ? 'Some support details listed'
        : 'Benefits not listed',
    listingFreshness: input.freshness.listingStatus === 'fresh'
      ? 'Freshly updated'
      : input.freshness.listingStatus === 'aging'
        ? 'Aging listing'
        : 'Potentially stale listing',
    employerDataCompleteness: `${input.freshness.employerDataStatus} source coverage (${input.freshness.completenessScore}%)`,
    evidence,
  };
}

function levelSatisfies(held: RequirementLevel, required: RequirementLevel): boolean {
  return LEVEL_ORDER[held] >= LEVEL_ORDER[required];
}

function makeComparisonItem(input: {
  requirement: OpportunityRequirementTruth;
  detail: string;
  nextStep?: string;
}): OpportunityComparisonItem {
  return {
    label: input.requirement.label,
    detail: input.detail,
    key: input.requirement.key,
    level: input.requirement.level,
    nextStep: input.nextStep ?? null,
  };
}

function findHeldCredential(
  clinician: ClinicianOpportunityProfile,
  requirement: OpportunityRequirementTruth,
): ClinicianHeldCredential | null {
  const candidates = clinician.credentials.filter((credential) => credential.key === requirement.key);
  if (candidates.length === 0) {
    return null;
  }

  if (requirement.key === 'state_license' && requirement.state) {
    return candidates.find((credential) => credential.state === requirement.state) ?? null;
  }
  if (requirement.key === 'board_cert' && requirement.specialty) {
    return candidates.find((credential) => credential.specialty?.toLowerCase() === requirement.specialty?.toLowerCase()) ?? null;
  }

  return candidates[0] ?? null;
}

function buildClinicianComparison(
  opportunity: OpportunityTruth,
  clinician: ClinicianOpportunityProfile,
): OpportunityReadinessComparison {
  const satisfied: OpportunityComparisonItem[] = [];
  const missing: OpportunityComparisonItem[] = [];
  const unknown: OpportunityComparisonItem[] = [];
  const fitIndicators: string[] = [];

  if (clinician.states.includes(opportunity.state)) {
    fitIndicators.push(`State alignment: ${opportunity.state} license already mapped on your file`);
  } else if (opportunity.remote) {
    fitIndicators.push('Remote delivery can reduce relocation friction, but state licensure still matters');
  }

  if (clinician.specialty && clinician.specialty.toLowerCase().includes(opportunity.specialty.toLowerCase())) {
    fitIndicators.push(`Specialty alignment: ${clinician.specialty}`);
  } else if (clinician.specialty) {
    unknown.push({
      label: 'Specialty alignment',
      detail: `Your current specialty on file is ${clinician.specialty}; this role is listed as ${opportunity.specialty}.`,
      key: null,
      level: null,
      nextStep: 'Confirm with the employer whether your current specialty is acceptable.',
    });
  }

  for (const requirement of opportunity.credentialRequirements) {
    if (!requirement.key) {
      unknown.push(makeComparisonItem({
        requirement,
        detail: 'This requirement is listed, but the current record does not map it to a verifiable credential type yet.',
        nextStep: `Confirm how ${requirement.label} is documented for this employer.`,
      }));
      continue;
    }

    if (requirement.key === 'state_license' && requirement.state && !clinician.states.includes(requirement.state)) {
      missing.push(makeComparisonItem({
        requirement,
        detail: `${requirement.state} is required for this role and it is not on your current state list.`,
        nextStep: `Add or verify your ${requirement.state} license before applying.`,
      }));
      continue;
    }

    const held = findHeldCredential(clinician, requirement);
    if (!held) {
      unknown.push(makeComparisonItem({
        requirement,
        detail: `VitalCV does not yet have source-backed evidence for ${requirement.label} on your file.`,
        nextStep: `Upload or verify ${requirement.label}.`,
      }));
      continue;
    }

    if (held.status === 'active' && levelSatisfies(held.level, requirement.level)) {
      satisfied.push(makeComparisonItem({
        requirement,
        detail: `${requirement.label} is already supported by ${held.source}.`,
      }));
      continue;
    }

    if (held.status === 'expired') {
      missing.push(makeComparisonItem({
        requirement,
        detail: `${requirement.label} appears expired on your current file.`,
        nextStep: `Renew ${requirement.label}.`,
      }));
      continue;
    }

    unknown.push(makeComparisonItem({
      requirement,
      detail: `${requirement.label} exists on your file, but the current evidence is still below the employer's required verification level.`,
      nextStep: `Upgrade verification for ${requirement.label}.`,
    }));
  }

  if (clinician.workAuthStatus === 'visa_required') {
    if (opportunity.visaSponsorshipStatus === 'available' || opportunity.visaSponsorshipStatus === 'case_by_case') {
      fitIndicators.push('Visa support signal is present for clinicians who need sponsorship');
    } else if (opportunity.visaSponsorshipStatus === 'not_available') {
      missing.push({
        label: 'Visa sponsorship support',
        detail: 'This opportunity says sponsorship is not available, which conflicts with your current work authorization need.',
        key: 'work_auth',
        level: null,
        nextStep: 'Focus on roles that explicitly support sponsorship.',
      });
    } else {
      unknown.push({
        label: 'Visa sponsorship support',
        detail: 'Your profile says sponsorship is required, but this opportunity does not state a visa policy.',
        key: 'work_auth',
        level: null,
        nextStep: 'Confirm sponsorship support before spending time on the application.',
      });
    }
  }

  const status: OpportunityReadinessStatus = missing.length > 0
    ? 'requirements_missing'
    : unknown.length > 0
      ? 'needs_review'
      : 'ready_now';

  const estimatedGap = missing.length > 0 && unknown.length > 0
    ? `${missing.length} confirmed blocker${missing.length === 1 ? '' : 's'} and ${unknown.length} item${unknown.length === 1 ? '' : 's'} still unverified.`
    : missing.length > 0
      ? `${missing.length} confirmed blocker${missing.length === 1 ? '' : 's'} remain${missing.length === 1 ? 's' : ''}.`
      : unknown.length > 0
        ? `${unknown.length} requirement${unknown.length === 1 ? ' is' : 's are'} still unverified.`
        : 'No confirmed readiness gap from the current source-backed record.';

  const shortestPath = missing[0]?.nextStep
    ?? unknown[0]?.nextStep
    ?? 'You can move straight into employer review with the evidence already on file.';

  return {
    clinicianNpi: clinician.npi,
    status,
    satisfied,
    missing,
    unknown,
    fitIndicators,
    estimatedGap,
    shortestPath,
  };
}

function buildExplanation(
  opportunity: OpportunityTruth,
  comparison: OpportunityReadinessComparison | null,
): OpportunityExplanation {
  const whyThisMayFit = new Set<string>();
  const whatMayBlockYou = new Set<string>();
  const resolveNext = new Set<string>();
  const stillUnknown = new Set<string>();

  if (opportunity.payRange) {
    whyThisMayFit.add(`Compensation is disclosed upfront (${opportunity.payRange}).`);
  } else {
    stillUnknown.add('Compensation is not disclosed in the current source data.');
  }

  if (opportunity.startTimeline) {
    whyThisMayFit.add(`The employer shared a start timeline (${opportunity.startTimeline}).`);
  }

  if (opportunity.freshness.employerDataStatus !== 'limited') {
    whyThisMayFit.add('This employer profile includes source-backed requirement and freshness data.');
  }

  if (opportunity.benefitsAvailability !== 'not_listed') {
    whyThisMayFit.add(`Support details are visible: ${opportunity.benefitsSummary}.`);
  } else {
    stillUnknown.add('Benefits are not listed in the current employer data.');
  }

  if (opportunity.visaSponsorshipStatus === 'not_stated') {
    stillUnknown.add('Visa sponsorship is not stated in the current employer data.');
  } else if (opportunity.visaSponsorshipSummary) {
    whyThisMayFit.add(opportunity.visaSponsorshipSummary);
  }

  if (comparison) {
    comparison.satisfied.slice(0, 3).forEach((item) => {
      whyThisMayFit.add(item.detail);
    });
    comparison.missing.forEach((item) => {
      whatMayBlockYou.add(item.detail);
      if (item.nextStep) {
        resolveNext.add(item.nextStep);
      }
    });
    comparison.unknown.forEach((item) => {
      stillUnknown.add(item.detail);
      if (item.nextStep) {
        resolveNext.add(item.nextStep);
      }
    });
  } else {
    opportunity.credentialRequirements.slice(0, 4).forEach((requirement) => {
      whatMayBlockYou.add(`${requirement.label} is part of this employer's listed requirements.`);
    });
    resolveNext.add('Compare your current file to these requirements before you apply.');
  }

  if (resolveNext.size === 0) {
    resolveNext.add('Proceed to apply while the current market signals stay favorable.');
  }

  return {
    whyThisMayFit: [...whyThisMayFit],
    whatMayBlockYou: [...whatMayBlockYou],
    resolveNext: [...resolveNext],
    stillUnknown: [...stillUnknown],
  };
}

function buildCredentialLabel(key: CredentialKey, state: string | null, specialty: string | null): string {
  switch (key) {
    case 'state_license':
      return state ? `${state} medical license` : 'state medical license';
    case 'board_cert':
      return specialty ? `${specialty} board certification` : 'board certification';
    case 'dea':
      return 'DEA registration';
    case 'npi':
      return 'NPI enrollment';
    case 'malpractice':
      return 'malpractice coverage';
    case 'sanctions_clear':
      return 'sanctions clearance';
    case 'work_auth':
      return 'work authorization';
    case 'hospital_privileges':
      return 'hospital credentialing file';
    case 'bls':
      return 'BLS';
    case 'acls':
      return 'ACLS';
    case 'atls':
      return 'ATLS';
    default:
      return key;
  }
}

function upsertCredential(
  credentials: ClinicianHeldCredential[],
  next: ClinicianHeldCredential,
): void {
  const existingIndex = credentials.findIndex((credential) => (
    credential.key === next.key
    && credential.state === next.state
    && credential.specialty === next.specialty
  ));

  if (existingIndex === -1) {
    credentials.push(next);
    return;
  }

  const existing = credentials[existingIndex];
  if (LEVEL_ORDER[next.level] > LEVEL_ORDER[existing.level]) {
    credentials[existingIndex] = next;
    return;
  }

  if (existing.status !== 'active' && next.status === 'active') {
    credentials[existingIndex] = next;
  }
}

function documentTypeToCredentialKey(value: string | null): CredentialKey | null {
  switch ((value ?? '').toUpperCase()) {
    case 'MEDICAL_LICENSE':
    case 'STATE_LICENSE':
      return 'state_license';
    case 'DEA_CERTIFICATE':
      return 'dea';
    case 'BOARD_CERTIFICATION':
      return 'board_cert';
    default:
      return null;
  }
}

function buildCandidateCredentialRecord(raw: unknown): CandidateCredentialRecord | null {
  if (!isRecord(raw)) {
    return null;
  }

  return {
    status: asString(raw.status) ?? 'UNVERIFIED',
    data: raw.data,
  };
}

/**
 * NPPES identity lookup, cached per NPI for a few minutes.
 *
 * The public board resolves the viewer's profile on EVERY request, and the
 * board refetches on every filter change — so without this, one signed-in
 * clinician adjusting filters issued an external call each time, each able to
 * block for the full 6s timeout before the page could render.
 *
 * Only the registry response is cached. The clinician's own credentials are
 * read from the database on every call, so adding a licence is reflected
 * immediately rather than sitting behind a TTL — a readiness answer must never
 * be stale in the direction of "you still don't qualify".
 *
 * A failure is NOT cached: an outage should recover on the next request, not
 * persist for the TTL.
 */
const NPPES_CACHE_TTL_MS = 5 * 60 * 1000;
const nppesIdentityCache = new Map<string, {
  expiresAt: number;
  value: { specialty: string | null; stateOfPractice: string | null };
}>();

async function fetchNppesIdentity(npi: string): Promise<{
  specialty: string | null;
  stateOfPractice: string | null;
}> {
  const now = Date.now();
  const cached = nppesIdentityCache.get(npi);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const empty = { specialty: null, stateOfPractice: null };

  try {
    const response = await fetch(
      `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`,
      { signal: AbortSignal.timeout(6_000) },
    );
    if (!response.ok) {
      return empty;
    }

    const payload = await response.json() as NppesResponse;
    const result = payload.results?.[0];
    const taxonomy = result?.taxonomies?.find((entry) => entry.primary) ?? result?.taxonomies?.[0];
    const location = result?.addresses?.find((entry) => entry.address_purpose === 'LOCATION') ?? result?.addresses?.[0];

    const value = {
      specialty: asString(taxonomy?.desc),
      stateOfPractice: asString(location?.state) ?? asString(taxonomy?.state),
    };

    // Bound the map so a long-lived process cannot grow one entry per NPI seen.
    if (nppesIdentityCache.size > 5_000) {
      nppesIdentityCache.clear();
    }
    nppesIdentityCache.set(npi, { expiresAt: now + NPPES_CACHE_TTL_MS, value });
    return value;
  } catch {
    // Best effort only; the caller keeps its local profile values.
    return empty;
  }
}

/** Test seam — the cache is process-wide and would otherwise leak between cases. */
export function __resetNppesIdentityCache(): void {
  nppesIdentityCache.clear();
}

export async function buildClinicianOpportunityProfile(input: {
  npi: string;
}): Promise<ClinicianOpportunityProfile | null> {
  const npi = input.npi.trim();
  if (!/^\d{10}$/.test(npi)) {
    return null;
  }

  const [personProfile, candidateCredentialRows] = await Promise.all([
    prisma.personProfile.findUnique({
      where: { npi },
      select: {
        specialty: true,
        stateOfPractice: true,
        workAuthStatus: true,
      },
    }).catch(() => null),
    prisma.candidateCredential.findMany({
      where: { clinicianId: npi },
      select: {
        status: true,
        data: true,
      },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),
  ]);

  let specialty = personProfile?.specialty ?? null;
  let stateOfPractice = personProfile?.stateOfPractice ?? null;
  const states = new Set<string>();

  const nppes = await fetchNppesIdentity(npi);
  specialty = specialty ?? nppes.specialty;
  stateOfPractice = stateOfPractice ?? nppes.stateOfPractice;

  if (stateOfPractice) {
    states.add(stateOfPractice);
  }

  const credentials: ClinicianHeldCredential[] = [];
  upsertCredential(credentials, {
    key: 'npi',
    level: 'L3',
    status: 'active',
    state: null,
    specialty: null,
    source: 'CMS NPPES',
  });

  if (stateOfPractice) {
    upsertCredential(credentials, {
      key: 'state_license',
      level: 'L2',
      status: 'active',
      state: stateOfPractice,
      specialty: specialty,
      source: `${stateOfPractice} licensure signal`,
    });
  }

  upsertCredential(credentials, {
    key: 'sanctions_clear',
    level: 'L2',
    status: 'active',
    state: null,
    specialty: null,
    source: 'NPI registry active record',
  });

  if (personProfile?.workAuthStatus === 'authorized') {
    upsertCredential(credentials, {
      key: 'work_auth',
      level: 'L2',
      status: 'active',
      state: null,
      specialty: null,
      source: 'Clinician work authorization profile',
    });
  }

  for (const row of candidateCredentialRows.map(buildCandidateCredentialRecord)) {
    if (!row || !isRecord(row.data)) {
      continue;
    }

    const documentType = asString(row.data.documentType) ?? asString(row.data.type) ?? asString(row.data.credentialType);
    const key = documentTypeToCredentialKey(documentType);
    if (!key) {
      continue;
    }

    const status = row.status.toUpperCase();
    // The candidate-credential lane is self-attested: a clinician uploads a
    // document, the OCR/regex pipeline (services/ai/documentPipeline.ts) parses
    // it, and the clinician confirms the extracted fields (status
    // PENDING_VERIFICATION). `overallConfidence` is the mean of hardcoded
    // per-pattern regex constants (0.82-0.90) — it measures how confidently a
    // regex matched text, never whether a source corroborated the claim. L3 is
    // the primary-source-verified requirement tier ("Primary Source
    // Verification Packet", "NPI Verified" — see launchOpportunitySeed.ts);
    // nothing in this lane has been checked against a source, so it must never
    // reach it. Cap at L2 regardless of status or confidence — reaching L3
    // requires a real source-corroboration path this lane does not provide.
    const level: RequirementLevel = 'L2';
    const heldStatus: ClinicianHeldCredential['status'] = status === 'VERIFIED'
      ? 'active'
      : 'pending';
    const state = asString(row.data.state) ?? stateOfPractice;
    const credentialSpecialty = asString(row.data.specialty) ?? specialty;

    if (state) {
      states.add(state);
    }

    upsertCredential(credentials, {
      key,
      level,
      status: heldStatus,
      state: key === 'state_license' ? state : null,
      specialty: key === 'board_cert' ? credentialSpecialty : specialty,
      source: 'Candidate credential record',
    });
  }

  return {
    npi,
    specialty,
    stateOfPractice,
    states: [...states],
    workAuthStatus: personProfile?.workAuthStatus ?? null,
    credentials,
  };
}

export function buildOpportunityTruth(input: {
  opportunity: OpportunityTruthRecord;
  clinicianProfile?: ClinicianOpportunityProfile | null;
  now?: Date;
}): OpportunityTruth {
  const now = input.now ?? new Date();
  const opportunity = input.opportunity;
  const isFeedListing = isFeedListingSource(opportunity.listingSource);
  // A feed row is sourced from the feed, never from a profile attached to the
  // placeholder organization. Keeping that boundary here prevents a later
  // profile merge from silently relabelling pay, benefits, start timing, or
  // other organization claims as facts about the external listing.
  const organizationProfile = isFeedListing
    ? null
    : opportunity.organization.organizationProfile;
  /**
   * Feed listings carry NO requirements.
   *
   * buildRequirementList falls back to buildFallbackRequirements() — NPI, a
   * "{state} Medical License", sanctions-clear — which are VitalCV's inference
   * from the state and requirement level, not anything an employer told us. For
   * an employer-posted row that inference is a reasonable floor, because that
   * employer did claim their organization here. For a row copied off a public
   * feed, publishing it would put our own guesses behind the words "Employer
   * requires". An empty list is the honest answer: nobody stated anything.
   */
  const requirements = isFeedListing ? [] : buildRequirementList(opportunity);
  const compensationText = opportunity.payRange ?? organizationProfile?.payRange ?? null;
  const parsedPayRange = parsePayRange(compensationText);
  const payModel = inferPayModel(opportunity.hiringType, compensationText);
  const benefits = deriveBenefits({
    description: opportunity.description,
    employerDescription: organizationProfile?.description ?? null,
    tagline: organizationProfile?.tagline ?? null,
  });
  const visa = deriveVisaSponsorship({
    description: opportunity.description,
    employerDescription: organizationProfile?.description ?? null,
    tagline: organizationProfile?.tagline ?? null,
    clearToStartThreshold: organizationProfile?.clearToStartThreshold ?? null,
  });
  const startTimeline = organizationProfile?.timeToStart ?? null;
  const structuredPay = resolveStructuredPay(opportunity);
  const freshness = buildFreshness({
    opportunityUpdatedAt: opportunity.updatedAt.toISOString(),
    employerUpdatedAt: organizationProfile?.updatedAt ? isoString(organizationProfile.updatedAt) : null,
    payRange: compensationText,
    benefitsAvailability: benefits.availability,
    visaStatus: visa.status,
    now,
  });
  const trustIndicators = buildTrustIndicators({
    payRange: compensationText,
    requirements,
    // A feed listing has no claimed employer behind it, so it can never carry
    // the verified-employer indicator no matter what the org row happens to say.
    verified: !isFeedListing && organizationProfile?.verified === true,
    startTimeline,
    benefitsAvailability: benefits.availability,
    visaStatus: visa.status,
    freshness: freshness.listingStatus,
  });
  const observedAt = isFeedListing
    ? opportunity.fetchedAt ? isoString(opportunity.fetchedAt) : null
    : opportunity.updatedAt.toISOString();
  const observationFreshness = observedAt ? classifyFreshness(observedAt, now) : null;
  const availabilityState: OpportunityAvailabilityState = opportunity.status !== 'ACTIVE'
    ? 'closed'
    : isFeedListing && !opportunity.sourceUrl
      ? 'source_unavailable'
      : observationFreshness === 'stale'
        ? 'stale'
        : 'open';
  const availabilityConfidence: OpportunityAvailabilityConfidence = !observedAt
    ? 'not_observed'
    : observationFreshness === 'fresh'
      ? 'recent_observation'
      : observationFreshness === 'aging'
        ? 'aging_observation'
        : 'stale_observation';
  const compensationMethod = structuredPay.min !== null || structuredPay.max !== null
    ? 'structured_source' as const
    : compensationText
      ? 'source_text' as const
      : 'not_supplied' as const;
  const sourceLabel = isFeedListing
    ? opportunity.sourceFeed
      ? `Listed on ${FEED_LABEL[opportunity.sourceFeed] ?? opportunity.sourceFeed}`
      : 'Listed on a public job feed'
    : organizationProfile
      ? 'Employer profile + public opportunity record'
      : 'Public opportunity record';
  const baseTruth: OpportunityTruth = {
    id: opportunity.id,
    organizationId: opportunity.organizationId,
    organizationName: opportunity.organization.name,
    organizationSlug: opportunity.organization.slug,
    title: opportunity.title,
    specialty: opportunity.specialty,
    profession: classifyOpportunityProfession(opportunity.title),
    schedule: classifyOpportunitySchedule(opportunity.title, opportunity.description),
    hiringType: opportunity.hiringType,
    state: opportunity.state,
    payRange: compensationText,
    requirementLevel: opportunity.requirementLevel,
    description: opportunity.description,
    remote: opportunity.remote,
    status: opportunity.status,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
    employerType: resolveEmployerType(opportunity, organizationProfile),
    payModel,
    payUnit: parsedPayRange.unit,
    payRangeMin: structuredPay.min ?? parsedPayRange.min,
    payRangeMax: structuredPay.max ?? parsedPayRange.max,
    visaSponsorshipStatus: visa.status,
    visaSponsorshipSummary: visa.summary,
    benefitsAvailability: benefits.availability,
    benefitsSummary: benefits.summary,
    benefitsItems: benefits.items,
    startTimeline,
    startUrgency: resolveStartUrgency(opportunity, startTimeline),
    speedToStartDays: deriveSpeedToStartDays(startTimeline),
    credentialRequirements: requirements,
    trustIndicators,
    freshness,
    source: isFeedListing
      ? {
        kind: 'public_feed' as const,
        // Names the feed, never the employer — the employer told us nothing.
        label: sourceLabel,
        updatedAt: freshness.lastUpdatedAt,
        url: opportunity.sourceUrl ?? null,
        fetchedAt: opportunity.fetchedAt ? isoString(opportunity.fetchedAt) : null,
      }
      : {
        kind: (organizationProfile ? 'employer_profile' : 'opportunity') as 'employer_profile' | 'opportunity',
        label: sourceLabel,
        updatedAt: freshness.lastUpdatedAt,
        url: `/opportunities/${opportunity.id}`,
        fetchedAt: null,
      },
    isFeedListing,
    availability: {
      state: availabilityState,
      confidence: availabilityConfidence,
      observedAt,
      limitation: availabilityState === 'closed'
        ? 'This role is recorded as closed.'
        : availabilityState === 'source_unavailable'
          ? 'No source page is available for this listing.'
          : availabilityState === 'stale'
            ? 'The last source observation is stale; confirm the role before acting.'
            : 'The source was observed recently; the employer can still change or close the role.',
    },
    applicationMode: isFeedListing ? 'external' : 'vitalcv',
    compensationProvenance: {
      state: compensationMethod === 'not_supplied' ? 'not_supplied' : 'supplied',
      method: compensationMethod,
      sourceLabel,
      observedAt,
    },
    transparency: buildTransparency({
      hiringStatus: organizationProfile?.hiringStatus ?? opportunity.status,
      startTimeline,
      timeToOnboard: organizationProfile?.timeToOnboard ?? null,
      visaStatus: visa.status,
      benefitsAvailability: benefits.availability,
      freshness,
    }),
    comparison: null,
    explanation: {
      whyThisMayFit: [],
      whatMayBlockYou: [],
      resolveNext: [],
      stillUnknown: [],
    },
  };

  /**
   * No readiness comparison for a feed listing.
   *
   * A comparison answers "do you meet THIS employer's requirements". A feed
   * listing has no employer-stated requirements, so any verdict would be
   * measuring the clinician against requirements VitalCV made up — including a
   * "Ready now" that nobody has agreed to. Withholding the answer is the only
   * honest option, and it keeps the readiness facet meaning one thing.
   */
  const comparison = input.clinicianProfile && !isFeedListing
    ? buildClinicianComparison(baseTruth, input.clinicianProfile)
    : null;
  const explanation = buildExplanation(baseTruth, comparison);

  return {
    ...baseTruth,
    comparison,
    explanation,
  };
}

function stringIncludes(haystack: string | null | undefined, needle: string): boolean {
  return (haystack ?? '').toLowerCase().includes(needle.toLowerCase());
}

export function matchesOpportunityTruthFilters(
  opportunity: OpportunityTruth,
  filters: OpportunityTruthFilters,
): boolean {
  if (filters.specialty && !stringIncludes(opportunity.specialty, filters.specialty)) {
    return false;
  }
  if (filters.profession && opportunity.profession !== filters.profession) {
    return false;
  }
  if (filters.schedule && opportunity.schedule !== filters.schedule) {
    return false;
  }
  if (filters.state && opportunity.state !== filters.state) {
    return false;
  }
  if (filters.hiringType && opportunity.hiringType !== filters.hiringType) {
    return false;
  }
  if (filters.organizationSlug && opportunity.organizationSlug !== filters.organizationSlug) {
    return false;
  }
  if (filters.remote === true && !opportunity.remote) {
    return false;
  }
  if (filters.payModel && opportunity.payModel !== filters.payModel) {
    return false;
  }
  if (filters.payMin !== undefined) {
    if (opportunity.payRangeMax === null || opportunity.payRangeMax < filters.payMin) {
      return false;
    }
  }
  if (filters.payMax !== undefined) {
    if (opportunity.payRangeMin === null || opportunity.payRangeMin > filters.payMax) {
      return false;
    }
  }
  if (filters.visaSponsorship && opportunity.visaSponsorshipStatus !== filters.visaSponsorship) {
    return false;
  }
  if (filters.benefits && opportunity.benefitsAvailability !== filters.benefits) {
    return false;
  }
  if (filters.applicationMode && opportunity.applicationMode !== filters.applicationMode) {
    return false;
  }
  if (filters.compensation && opportunity.compensationProvenance.state !== filters.compensation) {
    return false;
  }
  if (filters.observedWithinDays !== undefined) {
    const observedAt = opportunity.availability.observedAt
      ? Date.parse(opportunity.availability.observedAt)
      : Number.NaN;
    const cutoff = Date.now() - (filters.observedWithinDays * 24 * 60 * 60 * 1000);
    if (!Number.isFinite(observedAt) || observedAt < cutoff) {
      return false;
    }
  }
  if (filters.employerType && !stringIncludes(opportunity.employerType, filters.employerType)) {
    return false;
  }
  if (filters.startUrgency && opportunity.startUrgency !== filters.startUrgency) {
    return false;
  }
  if (filters.readinessStatus && opportunity.comparison?.status !== filters.readinessStatus) {
    return false;
  }
  if (filters.missingRequirement) {
    const needle = filters.missingRequirement.toLowerCase();
    const hasMissingRequirement = opportunity.comparison?.missing.some((item) => (
      stringIncludes(item.label, needle) || stringIncludes(item.key, needle)
    )) ?? false;
    if (!hasMissingRequirement) {
      return false;
    }
  }

  return true;
}

export function buildClinicianSummaryLine(clinician: ClinicianOpportunityProfile): string {
  const state = clinician.stateOfPractice ? `${clinician.stateOfPractice} licensed` : 'state not yet mapped';
  const specialty = clinician.specialty ?? 'specialty not yet mapped';
  return `${specialty} clinician, ${state}`;
}

export function buildCredentialActionLabel(key: CredentialKey | null, requirement: OpportunityRequirementTruth): string {
  if (key) {
    return `Verify ${buildCredentialLabel(key, requirement.state, requirement.specialty)}`;
  }
  return `Clarify ${requirement.label}`;
}
