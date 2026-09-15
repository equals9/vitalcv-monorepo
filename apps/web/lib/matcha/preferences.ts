/**
 * MATCHA Preferences — the honest preference spine for the clinician intelligence layer.
 *
 * Design contract (truth-first):
 *  - Everything in this module operates on preferences the clinician *states about themselves*.
 *    It is not credential verification and never asserts a verified fact about the clinician.
 *  - Every derived insight in {@link deriveMatchaProfile} carries `provenance` — the exact
 *    preference fields it was computed from. Nothing is fabricated. If the inputs are absent,
 *    the insight is omitted rather than invented.
 *  - Only a subset of these fields currently influence the MATCHA matching engine
 *    (see {@link ENGINE_BACKED_FIELDS} and {@link toCandidateIntent}). Fields outside that set
 *    are captured for the clinician's own profile and future matching, and the UI says so.
 *
 * The engine itself lives in apps/api/backend/src/services/matcha and emits a MatchExplanation
 * with its own provenance (fitReasons / blockers). This module is the *preference* half of the
 * story; the engine is the *match* half.
 */

// ── Scalar vocabularies ─────────────────────────────────────────────────────

/** A three-point importance scale used for benefit/priority questions. */
export type Importance = 'low' | 'medium' | 'high';

/** A four-point interest scale used for "how interested are you in X" questions. */
export type Interest = 'none' | 'curious' | 'interested' | 'passionate';

export type ShiftPreference = 'days' | 'nights' | 'rotating' | 'flexible';

/** Employment arrangements — superset of the engine's HiringType. */
export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'per_diem'
  | 'contract'
  | 'locums'
  | 'telehealth';

export type GreenCardStatus =
  | 'citizen'
  | 'permanent_resident'
  | 'ead'
  | 'visa_holder'
  | 'needs_sponsorship'
  | 'prefer_not_to_say';

/** How soon the clinician wants to start — mirrors the engine's StartUrgency band. */
export type StartUrgency = 'immediate' | 'within_2_weeks' | 'within_month' | 'flexible';

/**
 * The preference dimensions a clinician may mark as non-negotiable. Each key names an
 * existing preference field it hardens (see {@link HARD_CONSTRAINT_FIELD}); marking one
 * changes nothing about the preference's value, only how a role that fails it is
 * reported: as a hard miss the clinician decides on, never a quietly relaxed score.
 */
export type HardConstraintKey =
  | 'location'
  | 'compensation'
  | 'employment_type'
  | 'visa_sponsorship';

export const HARD_CONSTRAINT_KEYS: readonly HardConstraintKey[] = [
  'location',
  'compensation',
  'employment_type',
  'visa_sponsorship',
] as const;

/** The preference field each hard-constraint key hardens. */
export const HARD_CONSTRAINT_FIELD: Record<HardConstraintKey, PreferenceField> = {
  location: 'preferredStates',
  compensation: 'minimumSalary',
  employment_type: 'employmentTypes',
  visa_sponsorship: 'visaSponsorshipNeeded',
};

export function isHardConstraintKey(value: unknown): value is HardConstraintKey {
  return typeof value === 'string' && (HARD_CONSTRAINT_KEYS as readonly string[]).includes(value);
}

// ── The preference model ────────────────────────────────────────────────────

/**
 * The full clinician preference set. Every field is optional: the model is built up
 * incrementally as the clinician answers, and completeness is measured against what's present.
 */
export interface MatchaPreferences {
  // Career direction
  careerGoals?: string[];
  careerDirection?: string;
  leadershipAspiration?: Interest;

  // Specialties
  currentSpecialties?: string[];
  desiredSpecialties?: string[];
  favoriteProcedures?: string[];
  populationPreferences?: string[];

  // Location & mobility
  geographicFlexibility?: Importance;
  preferredStates?: string[];
  statesWillingToLicense?: string[];
  commuteRadiusMiles?: number;
  remoteInterest?: Interest;
  travelInterest?: Interest;

  // Work type & schedule
  employmentTypes?: EmploymentType[];
  shiftPreference?: ShiftPreference;
  scheduleFlexibility?: Importance;
  startUrgency?: StartUrgency;

  /**
   * Which of the clinician's stated preferences are non-negotiable. Empty or absent means
   * every preference is advisory, which is how the model behaved before this field existed.
   */
  hardConstraints?: HardConstraintKey[];

  // Compensation & benefits
  desiredSalary?: number;
  minimumSalary?: number;
  signOnBonusImportance?: Importance;
  ptoImportance?: Importance;
  retirementImportance?: Importance;
  healthInsuranceImportance?: Importance;

  // Eligibility & background
  visaSponsorshipNeeded?: boolean;
  greenCardStatus?: GreenCardStatus;
  military?: boolean;
  newGraduate?: boolean;
  yearsExperience?: number;

  // Interests & growth
  academicMedicineInterest?: Interest;
  researchInterest?: Interest;
  teachingInterest?: Interest;
  managementInterest?: Interest;
  telehealthInterest?: Interest;
  aiInterest?: Interest;
  blockchainInterest?: Interest;
  entrepreneurInterest?: Interest;
  workLifeBalanceImportance?: Importance;

  // Organization fit
  missionDrivenImportance?: Importance;
  communityHospitalInterest?: Interest;
  academicHospitalInterest?: Interest;
  privatePracticeInterest?: Interest;
  largeHealthSystemInterest?: Interest;
  startupInterest?: Interest;
  culturePreference?: string[];
  diversityImportance?: Importance;
  teamSizePreference?: 'small' | 'medium' | 'large' | 'no_preference';
  patientVolumePreference?: 'low' | 'moderate' | 'high' | 'no_preference';

  // Credentials & capabilities
  certifications?: string[];
  futureCertifications?: string[];
  licenses?: string[];
  languagesSpoken?: string[];
  preferredEMRs?: string[];
}

export type PreferenceField = keyof MatchaPreferences;

/** An empty, well-typed starting point. */
export function emptyPreferences(): MatchaPreferences {
  return {};
}

// ── Completeness ────────────────────────────────────────────────────────────

/**
 * A field is "answered" when it holds a meaningful value:
 * a non-empty array, a non-empty string, a finite number, or a boolean.
 */
export function isFieldAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  return false;
}

/** The canonical list of fields completeness is measured against. */
export const ALL_PREFERENCE_FIELDS: readonly PreferenceField[] = [
  'careerGoals', 'careerDirection', 'leadershipAspiration',
  'currentSpecialties', 'desiredSpecialties', 'favoriteProcedures', 'populationPreferences',
  'geographicFlexibility', 'preferredStates', 'statesWillingToLicense', 'commuteRadiusMiles',
  'remoteInterest', 'travelInterest',
  'employmentTypes', 'shiftPreference', 'scheduleFlexibility', 'startUrgency',
  'hardConstraints',
  'desiredSalary', 'minimumSalary', 'signOnBonusImportance', 'ptoImportance',
  'retirementImportance', 'healthInsuranceImportance',
  'visaSponsorshipNeeded', 'greenCardStatus', 'military', 'newGraduate', 'yearsExperience',
  'academicMedicineInterest', 'researchInterest', 'teachingInterest', 'managementInterest',
  'telehealthInterest', 'aiInterest', 'blockchainInterest', 'entrepreneurInterest',
  'workLifeBalanceImportance',
  'missionDrivenImportance', 'communityHospitalInterest', 'academicHospitalInterest',
  'privatePracticeInterest', 'largeHealthSystemInterest', 'startupInterest',
  'culturePreference', 'diversityImportance', 'teamSizePreference', 'patientVolumePreference',
  'certifications', 'futureCertifications', 'licenses', 'languagesSpoken', 'preferredEMRs',
] as const;

export function countAnsweredFields(prefs: MatchaPreferences): number {
  return ALL_PREFERENCE_FIELDS.reduce(
    (n, field) => (isFieldAnswered(prefs[field]) ? n + 1 : n),
    0,
  );
}

/** Completeness as a 0–100 integer. Drives MATCHA's honest "confidence" and learning progress. */
export function completenessPercent(prefs: MatchaPreferences): number {
  const total = ALL_PREFERENCE_FIELDS.length;
  if (total === 0) return 0;
  return Math.round((countAnsweredFields(prefs) / total) * 100);
}

/**
 * Sanitize an untrusted preferences payload (e.g. a request body or a stored
 * blob) down to the known MatchaPreferences shape: ONLY whitelisted fields,
 * type-checked values, and bounded sizes. Unknown keys are dropped and nothing
 * is coerced. Used before persisting server-side so the store can never hold
 * arbitrary data — and, per the truth contract, these are self-stated
 * preferences only, never a credential or evidence claim.
 */
export function sanitizeStoredPreferences(input: unknown): MatchaPreferences {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const MAX_ARRAY_ITEMS = 60;
  const MAX_STRING = 240;

  for (const field of ALL_PREFERENCE_FIELDS) {
    const value = src[field as string];
    if (field === 'hardConstraints') {
      // Closed vocabulary: an unknown key can never become a constraint the
      // evaluator silently ignores, so it is dropped here, not downstream.
      if (Array.isArray(value)) {
        const keys = Array.from(new Set(value.filter(isHardConstraintKey)));
        if (keys.length > 0) out[field] = keys;
      }
      continue;
    }
    if (Array.isArray(value)) {
      const arr = value
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .slice(0, MAX_ARRAY_ITEMS)
        .map((x) => x.slice(0, MAX_STRING));
      if (arr.length > 0) out[field] = arr;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[field] = value;
    } else if (typeof value === 'boolean') {
      out[field] = value;
    } else if (typeof value === 'string' && value.trim().length > 0) {
      out[field] = value.slice(0, MAX_STRING);
    }
  }

  return out as MatchaPreferences;
}

// ── Engine mapping ──────────────────────────────────────────────────────────

/**
 * The preference fields that currently influence the MATCHA matching engine.
 * The UI uses this set to honestly label which answers change matches *today* vs.
 * which are captured for the clinician's profile and future matching.
 */
export const ENGINE_BACKED_FIELDS: readonly PreferenceField[] = [
  'preferredStates',
  'desiredSpecialties',
  'currentSpecialties',
  'employmentTypes',
  'minimumSalary',
  'remoteInterest',
  'startUrgency',
  'telehealthInterest',
] as const;

/**
 * The engine's CandidateIntent shape (mirrors matchaModels.ts CandidateIntent).
 * Kept local to avoid a cross-package import into the web bundle.
 */
export interface CandidateIntentPayload {
  npi: string;
  preferredStates?: string[];
  preferredSpecialties?: string[];
  preferredHiringTypes?: string[];
  payMin?: number;
  remoteOnly?: boolean;
  startUrgency?: StartUrgency;
  openToLocums?: boolean;
  openToTelehealth?: boolean;
  capturedAt?: string;
}

const ENGINE_HIRING_TYPES = new Set(['locums', 'perm', 'part-time', 'telehealth', 'prn', 'short-term']);

/** Map the rich preference model down to the engine's CandidateIntent subset. */
export function toCandidateIntent(
  npi: string,
  prefs: MatchaPreferences,
  capturedAt?: string,
): CandidateIntentPayload {
  const hiringTypes = (prefs.employmentTypes ?? [])
    .map((t): string | null => {
      switch (t) {
        case 'full_time': return 'perm';
        case 'part_time': return 'part-time';
        case 'per_diem': return 'prn';
        case 'contract': return 'short-term';
        case 'locums': return 'locums';
        case 'telehealth': return 'telehealth';
        default: return null;
      }
    })
    .filter((t): t is string => t !== null && ENGINE_HIRING_TYPES.has(t));

  const specialties = [
    ...(prefs.desiredSpecialties ?? []),
    ...(prefs.currentSpecialties ?? []),
  ];
  const uniqueSpecialties = Array.from(new Set(specialties));

  const payload: CandidateIntentPayload = { npi };
  if (prefs.preferredStates?.length) payload.preferredStates = prefs.preferredStates;
  if (uniqueSpecialties.length) payload.preferredSpecialties = uniqueSpecialties;
  if (hiringTypes.length) payload.preferredHiringTypes = Array.from(new Set(hiringTypes));
  if (Number.isFinite(prefs.minimumSalary)) payload.payMin = prefs.minimumSalary;
  if (prefs.remoteInterest === 'passionate') payload.remoteOnly = true;
  if (prefs.startUrgency) payload.startUrgency = prefs.startUrgency;
  if (prefs.employmentTypes?.includes('locums')) payload.openToLocums = true;
  if (
    prefs.employmentTypes?.includes('telehealth') ||
    prefs.telehealthInterest === 'interested' ||
    prefs.telehealthInterest === 'passionate'
  ) {
    payload.openToTelehealth = true;
  }
  if (capturedAt) payload.capturedAt = capturedAt;
  return payload;
}
