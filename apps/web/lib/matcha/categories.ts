/**
 * MATCHA match-question categories — Personal / Professional / Place.
 *
 * Mirrors the three-bucket "Match Questions" model clinicians expect: answer as many as you
 * like, and the more you answer, the sharper the match. Every preference field maps to exactly
 * one category, so per-category completeness is well-defined and honest (answered / total).
 *
 * This is a pure re-view of the existing MatchaPreferences spine — no new data, no fabrication.
 */

import {
  type MatchaPreferences,
  type PreferenceField,
  ALL_PREFERENCE_FIELDS,
  isFieldAnswered,
} from './preferences';
import { ONBOARDING_STEPS, type OnboardingStep } from './onboarding';

export type MatchCategory = 'personal' | 'professional' | 'place';

export interface CategoryMeta {
  key: MatchCategory;
  label: string;
  blurb: string;
}

export const CATEGORY_META: Record<MatchCategory, CategoryMeta> = {
  personal: {
    key: 'personal',
    label: 'Personal',
    blurb: 'Who you are, what you value, and where your career is headed.',
  },
  professional: {
    key: 'professional',
    label: 'Professional',
    blurb: 'Your practice, credentials, and the terms you work under.',
  },
  place: {
    key: 'place',
    label: 'Place',
    blurb: 'Where you want to work and the kind of setting that fits.',
  },
};

export const CATEGORY_ORDER: readonly MatchCategory[] = ['personal', 'professional', 'place'];

/** Every preference field mapped to exactly one category. */
export const FIELD_CATEGORY: Record<PreferenceField, MatchCategory> = {
  // Personal — identity, values, background, growth
  careerGoals: 'personal',
  careerDirection: 'personal',
  leadershipAspiration: 'personal',
  yearsExperience: 'personal',
  newGraduate: 'personal',
  visaSponsorshipNeeded: 'personal',
  greenCardStatus: 'personal',
  military: 'personal',
  languagesSpoken: 'personal',
  workLifeBalanceImportance: 'personal',
  academicMedicineInterest: 'personal',
  researchInterest: 'personal',
  teachingInterest: 'personal',
  managementInterest: 'personal',
  aiInterest: 'personal',
  blockchainInterest: 'personal',
  entrepreneurInterest: 'personal',

  // Professional — practice, credentials, work terms, compensation
  currentSpecialties: 'professional',
  desiredSpecialties: 'professional',
  favoriteProcedures: 'professional',
  populationPreferences: 'professional',
  certifications: 'professional',
  futureCertifications: 'professional',
  licenses: 'professional',
  preferredEMRs: 'professional',
  hardConstraints: 'professional',
  employmentTypes: 'professional',
  shiftPreference: 'professional',
  scheduleFlexibility: 'professional',
  startUrgency: 'professional',
  telehealthInterest: 'professional',
  desiredSalary: 'professional',
  minimumSalary: 'professional',
  signOnBonusImportance: 'professional',
  ptoImportance: 'professional',
  retirementImportance: 'professional',
  healthInsuranceImportance: 'professional',

  // Place — location, mobility, organization type & culture
  preferredStates: 'place',
  statesWillingToLicense: 'place',
  geographicFlexibility: 'place',
  commuteRadiusMiles: 'place',
  remoteInterest: 'place',
  travelInterest: 'place',
  missionDrivenImportance: 'place',
  communityHospitalInterest: 'place',
  academicHospitalInterest: 'place',
  privatePracticeInterest: 'place',
  largeHealthSystemInterest: 'place',
  startupInterest: 'place',
  teamSizePreference: 'place',
  patientVolumePreference: 'place',
  culturePreference: 'place',
  diversityImportance: 'place',
};

/** The preference fields belonging to a category. */
export function categoryFields(category: MatchCategory): PreferenceField[] {
  return ALL_PREFERENCE_FIELDS.filter((f) => FIELD_CATEGORY[f] === category);
}

/** The onboarding steps (question definitions) for a category, in script order. */
export function stepsForCategory(category: MatchCategory): OnboardingStep[] {
  return ONBOARDING_STEPS.filter(
    (s) => s.kind !== 'intro' && s.field !== undefined && FIELD_CATEGORY[s.field] === category,
  );
}

export interface CategoryProgress {
  category: MatchCategory;
  answered: number;
  total: number;
  percent: number;
}

/** Per-category completeness — answered vs total fields in that category. */
export function categoryProgress(
  prefs: MatchaPreferences,
  category: MatchCategory,
): CategoryProgress {
  const fields = categoryFields(category);
  const answered = fields.reduce((n, f) => (isFieldAnswered(prefs[f]) ? n + 1 : n), 0);
  const total = fields.length;
  return {
    category,
    answered,
    total,
    percent: total === 0 ? 0 : Math.round((answered / total) * 100),
  };
}

/** Progress for all three categories, in canonical order. */
export function allCategoryProgress(prefs: MatchaPreferences): CategoryProgress[] {
  return CATEGORY_ORDER.map((c) => categoryProgress(prefs, c));
}
