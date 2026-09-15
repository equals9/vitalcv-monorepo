/**
 * MATCHA conversational onboarding — a declarative question script.
 *
 * The onboarding UI (MatchaOnboarding.tsx) renders these steps one at a time as a
 * conversation, not a form. Each step maps to exactly one preference field so answers
 * flow straight into the MatchaPreferences model and update MATCHA's reasoning live.
 *
 * Keeping the script as data (not JSX) means the flow is testable, reorderable, and the
 * total step count / progress is always derivable.
 */

import type {
  EmploymentType,
  Importance,
  Interest,
  MatchaPreferences,
  PreferenceField,
  ShiftPreference,
  StartUrgency,
} from './preferences';

export type StepKind =
  | 'intro'        // no field — a MATCHA message that advances on continue
  | 'chips_multi'  // choose many from options, value: string[]
  | 'chips_single' // choose one from options, value: string
  | 'tags'         // free-entry list, value: string[]
  | 'number'       // numeric entry, value: number
  | 'scale'        // importance/interest, value: Importance | Interest
  | 'boolean';     // yes / no, value: boolean

export interface StepOption {
  value: string;
  label: string;
}

export interface OnboardingStep {
  id: string;
  section: string;
  kind: StepKind;
  /** What MATCHA "says" to introduce the question. */
  prompt: string;
  /** Optional supporting line. */
  hint?: string;
  /** The preference field this step writes (absent for intro steps). */
  field?: PreferenceField;
  options?: StepOption[];
  /** For number steps. */
  numberUnit?: string;
  numberPlaceholder?: string;
  /** Whether this answer currently influences the live match engine. */
  engineBacked?: boolean;
  optional?: boolean;
}

const IMPORTANCE_OPTIONS: StepOption[] = [
  { value: 'low', label: 'Not important' },
  { value: 'medium', label: 'Somewhat' },
  { value: 'high', label: 'Very important' },
];

const INTEREST_OPTIONS: StepOption[] = [
  { value: 'none', label: 'Not for me' },
  { value: 'curious', label: 'Curious' },
  { value: 'interested', label: 'Interested' },
  { value: 'passionate', label: 'Passionate' },
];

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'welcome',
    section: 'Welcome',
    kind: 'intro',
    prompt: "Hi, I'm MATCHA. I learn what matters to you, then keep working in the background to surface roles worth your time.",
    hint: 'Everything you share stays yours. You can stop anytime — I use whatever you give me.',
  },

  // Career direction
  {
    id: 'career-goals', section: 'Career goals', kind: 'tags', field: 'careerGoals',
    prompt: 'What are you working toward right now?',
    hint: 'A few words or phrases — e.g. "attending role", "more autonomy", "relocate".',
  },
  {
    id: 'career-direction', section: 'Career goals', kind: 'chips_single', field: 'careerDirection',
    prompt: 'Where do you see your career heading?',
    options: [
      { value: 'deepen clinical practice', label: 'Deepen clinical practice' },
      { value: 'move into leadership', label: 'Move into leadership' },
      { value: 'shift toward academia', label: 'Shift toward academia' },
      { value: 'explore something new', label: 'Explore something new' },
      { value: 'stay the course', label: 'Stay the course' },
    ],
  },
  {
    id: 'leadership', section: 'Career goals', kind: 'scale', field: 'leadershipAspiration',
    prompt: 'How much do leadership roles appeal to you?', options: INTEREST_OPTIONS,
  },

  // Specialties
  {
    id: 'current-specialties', section: 'Specialties', kind: 'tags', field: 'currentSpecialties',
    prompt: 'What do you practice today?', hint: 'Your current specialties.', engineBacked: true,
  },
  {
    id: 'desired-specialties', section: 'Specialties', kind: 'tags', field: 'desiredSpecialties',
    prompt: 'Any specialties or subspecialties you want to move toward?', engineBacked: true, optional: true,
  },
  {
    id: 'procedures', section: 'Specialties', kind: 'tags', field: 'favoriteProcedures',
    prompt: 'Which procedures do you most want to keep doing?', optional: true,
  },
  {
    id: 'populations', section: 'Specialties', kind: 'tags', field: 'populationPreferences',
    prompt: 'Any patient populations you prefer?', hint: 'e.g. pediatric, geriatric, underserved.', optional: true,
  },

  // Location & mobility
  {
    id: 'preferred-states', section: 'Location', kind: 'tags', field: 'preferredStates',
    prompt: 'Where would you like to work?', hint: 'State abbreviations or names.', engineBacked: true,
  },
  {
    id: 'geo-flex', section: 'Location', kind: 'scale', field: 'geographicFlexibility',
    prompt: 'How flexible are you on location?', options: IMPORTANCE_OPTIONS,
  },
  {
    id: 'license-states', section: 'Location', kind: 'tags', field: 'statesWillingToLicense',
    prompt: 'Which states would you get licensed in for the right role?', optional: true,
  },
  {
    id: 'commute', section: 'Location', kind: 'number', field: 'commuteRadiusMiles',
    prompt: "What's the furthest you'd commute?", numberUnit: 'miles', numberPlaceholder: '30', optional: true,
  },
  {
    id: 'remote', section: 'Location', kind: 'scale', field: 'remoteInterest',
    prompt: 'How interested are you in remote work?', options: INTEREST_OPTIONS, engineBacked: true,
  },
  {
    id: 'travel', section: 'Location', kind: 'scale', field: 'travelInterest',
    prompt: 'And travel or locums assignments?', options: INTEREST_OPTIONS,
  },

  // Work type & schedule
  {
    id: 'employment-types', section: 'Work style', kind: 'chips_multi', field: 'employmentTypes',
    prompt: 'What kinds of arrangements work for you?', engineBacked: true,
    options: [
      { value: 'full_time', label: 'Full time' },
      { value: 'part_time', label: 'Part time' },
      { value: 'per_diem', label: 'Per diem' },
      { value: 'contract', label: 'Contract' },
      { value: 'locums', label: 'Locums' },
      { value: 'telehealth', label: 'Telehealth' },
    ],
  },
  {
    id: 'shift', section: 'Work style', kind: 'chips_single', field: 'shiftPreference',
    prompt: 'Which shifts suit you best?',
    options: [
      { value: 'days', label: 'Days' },
      { value: 'nights', label: 'Nights' },
      { value: 'rotating', label: 'Rotating' },
      { value: 'flexible', label: 'Flexible' },
    ],
  },
  {
    id: 'schedule-flex', section: 'Work style', kind: 'scale', field: 'scheduleFlexibility',
    prompt: 'How important is schedule flexibility?', options: IMPORTANCE_OPTIONS,
  },
  {
    id: 'start-urgency', section: 'Work style', kind: 'chips_single', field: 'startUrgency',
    prompt: 'How soon are you looking to start?', engineBacked: true,
    options: [
      { value: 'immediate', label: 'Immediately' },
      { value: 'within_2_weeks', label: 'Within 2 weeks' },
      { value: 'within_month', label: 'Within a month' },
      { value: 'flexible', label: "I'm flexible" },
    ],
  },

  // Compensation & benefits
  {
    id: 'desired-salary', section: 'Compensation', kind: 'number', field: 'desiredSalary',
    prompt: "What's your target annual compensation?", numberUnit: 'USD/yr', numberPlaceholder: '300000', optional: true,
  },
  {
    id: 'min-salary', section: 'Compensation', kind: 'number', field: 'minimumSalary',
    prompt: "And the minimum you'd consider?", numberUnit: 'USD/yr', numberPlaceholder: '250000', engineBacked: true, optional: true,
  },
  {
    id: 'hard-constraints', section: 'Compensation', kind: 'chips_multi', field: 'hardConstraints',
    prompt: 'Which of these will you not move on?',
    hint: 'A role that fails one of these is shown as a hard miss for you to decide on, not quietly ranked lower. Leave it empty and everything stays advisory.',
    optional: true,
    options: [
      { value: 'location', label: 'Where I work' },
      { value: 'compensation', label: 'My minimum pay' },
      { value: 'employment_type', label: 'Full-time, part-time or per diem' },
      { value: 'visa_sponsorship', label: 'Visa sponsorship' },
    ],
  },
  {
    id: 'signon', section: 'Compensation', kind: 'scale', field: 'signOnBonusImportance',
    prompt: 'How much does a sign-on bonus matter?', options: IMPORTANCE_OPTIONS,
  },
  {
    id: 'pto', section: 'Compensation', kind: 'scale', field: 'ptoImportance',
    prompt: 'How important is PTO?', options: IMPORTANCE_OPTIONS,
  },
  {
    id: 'retirement', section: 'Compensation', kind: 'scale', field: 'retirementImportance',
    prompt: 'Retirement benefits?', options: IMPORTANCE_OPTIONS,
  },
  {
    id: 'health-ins', section: 'Compensation', kind: 'scale', field: 'healthInsuranceImportance',
    prompt: 'Health insurance?', options: IMPORTANCE_OPTIONS,
  },

  // Eligibility & background
  {
    id: 'years-exp', section: 'Background', kind: 'number', field: 'yearsExperience',
    prompt: 'How many years have you been practicing?', numberUnit: 'years', numberPlaceholder: '8', optional: true,
  },
  {
    id: 'new-grad', section: 'Background', kind: 'boolean', field: 'newGraduate',
    prompt: 'Are you a new graduate?', optional: true,
  },
  {
    id: 'visa', section: 'Background', kind: 'boolean', field: 'visaSponsorshipNeeded',
    prompt: 'Will you need visa sponsorship?', optional: true,
  },
  {
    id: 'green-card', section: 'Background', kind: 'chips_single', field: 'greenCardStatus',
    prompt: 'What best describes your work authorization?', optional: true,
    options: [
      { value: 'citizen', label: 'US citizen' },
      { value: 'permanent_resident', label: 'Permanent resident' },
      { value: 'ead', label: 'EAD' },
      { value: 'visa_holder', label: 'Visa holder' },
      { value: 'needs_sponsorship', label: 'Need sponsorship' },
      { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'military', section: 'Background', kind: 'boolean', field: 'military',
    prompt: 'Any military service or affiliation?', optional: true,
  },

  // Interests & growth
  {
    id: 'academic', section: 'Interests', kind: 'scale', field: 'academicMedicineInterest',
    prompt: 'Interest in academic medicine?', options: INTEREST_OPTIONS,
  },
  {
    id: 'research', section: 'Interests', kind: 'scale', field: 'researchInterest',
    prompt: 'Research?', options: INTEREST_OPTIONS,
  },
  {
    id: 'teaching', section: 'Interests', kind: 'scale', field: 'teachingInterest',
    prompt: 'Teaching and mentorship?', options: INTEREST_OPTIONS,
  },
  {
    id: 'management', section: 'Interests', kind: 'scale', field: 'managementInterest',
    prompt: 'Management or administration?', options: INTEREST_OPTIONS,
  },
  {
    id: 'telehealth-interest', section: 'Interests', kind: 'scale', field: 'telehealthInterest',
    prompt: 'Telehealth?', options: INTEREST_OPTIONS, engineBacked: true,
  },
  {
    id: 'ai', section: 'Interests', kind: 'scale', field: 'aiInterest',
    prompt: 'Working with AI-enabled tools?', options: INTEREST_OPTIONS,
  },
  {
    id: 'entrepreneur', section: 'Interests', kind: 'scale', field: 'entrepreneurInterest',
    prompt: 'Entrepreneurial or founding roles?', options: INTEREST_OPTIONS,
  },
  {
    id: 'wlb', section: 'Interests', kind: 'scale', field: 'workLifeBalanceImportance',
    prompt: 'How important is work–life balance?', options: IMPORTANCE_OPTIONS,
  },

  // Organization fit
  {
    id: 'mission', section: 'Organization fit', kind: 'scale', field: 'missionDrivenImportance',
    prompt: 'How much does a mission-driven organization matter?', options: IMPORTANCE_OPTIONS,
  },
  {
    id: 'academic-hosp', section: 'Organization fit', kind: 'scale', field: 'academicHospitalInterest',
    prompt: 'Academic hospitals?', options: INTEREST_OPTIONS,
  },
  {
    id: 'community-hosp', section: 'Organization fit', kind: 'scale', field: 'communityHospitalInterest',
    prompt: 'Community hospitals?', options: INTEREST_OPTIONS,
  },
  {
    id: 'private-practice', section: 'Organization fit', kind: 'scale', field: 'privatePracticeInterest',
    prompt: 'Private practice?', options: INTEREST_OPTIONS,
  },
  {
    id: 'large-system', section: 'Organization fit', kind: 'scale', field: 'largeHealthSystemInterest',
    prompt: 'Large health systems?', options: INTEREST_OPTIONS,
  },
  {
    id: 'startup', section: 'Organization fit', kind: 'scale', field: 'startupInterest',
    prompt: 'Healthcare startups?', options: INTEREST_OPTIONS,
  },
  {
    id: 'team-size', section: 'Organization fit', kind: 'chips_single', field: 'teamSizePreference',
    prompt: 'What team size do you thrive in?',
    options: [
      { value: 'small', label: 'Small & tight-knit' },
      { value: 'medium', label: 'Mid-sized' },
      { value: 'large', label: 'Large' },
      { value: 'no_preference', label: 'No preference' },
    ],
  },
  {
    id: 'patient-volume', section: 'Organization fit', kind: 'chips_single', field: 'patientVolumePreference',
    prompt: 'Preferred patient volume?',
    options: [
      { value: 'low', label: 'Lower, more time each' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'high', label: 'High volume' },
      { value: 'no_preference', label: 'No preference' },
    ],
  },
  {
    id: 'culture', section: 'Organization fit', kind: 'tags', field: 'culturePreference',
    prompt: 'How would you describe the culture you want?', hint: 'A few words.', optional: true,
  },
  {
    id: 'diversity', section: 'Organization fit', kind: 'scale', field: 'diversityImportance',
    prompt: 'How important is a diverse workplace?', options: IMPORTANCE_OPTIONS,
  },

  // Credentials & capabilities
  {
    id: 'certifications', section: 'Credentials', kind: 'tags', field: 'certifications',
    prompt: 'Which certifications do you hold?', hint: 'e.g. ABIM, BLS, ACLS.', optional: true,
  },
  {
    id: 'future-certs', section: 'Credentials', kind: 'tags', field: 'futureCertifications',
    prompt: 'Any you plan to earn?', optional: true,
  },
  {
    id: 'licenses', section: 'Credentials', kind: 'tags', field: 'licenses',
    prompt: 'Which state licenses do you hold?', optional: true,
  },
  {
    id: 'languages', section: 'Credentials', kind: 'tags', field: 'languagesSpoken',
    prompt: 'Languages you speak with patients?', optional: true,
  },
  {
    id: 'emrs', section: 'Credentials', kind: 'tags', field: 'preferredEMRs',
    prompt: 'Which EMRs are you comfortable with?', hint: 'e.g. Epic, Cerner.', optional: true,
  },
];

/** Ordered, de-duplicated section names for the progress rail. */
export const ONBOARDING_SECTIONS: readonly string[] = Array.from(
  ONBOARDING_STEPS.reduce((set, step) => set.add(step.section), new Set<string>()),
);

/** Number of steps that actually capture a preference (excludes intro steps). */
export const ANSWERABLE_STEP_COUNT = ONBOARDING_STEPS.filter((s) => s.kind !== 'intro').length;

/** Coerce a raw step answer into the correctly-typed preference value. */
export function coerceAnswer(step: OnboardingStep, raw: unknown): MatchaPreferences[PreferenceField] {
  switch (step.kind) {
    case 'number': {
      // An empty input is "not yet shared", never a stored zero: Number('')
      // is 0, and that parser artifact used to persist as a stated preference
      // ("Target ~$0") with you-told-MATCHA provenance. Blank stays blank.
      const cleaned = typeof raw === 'number' ? raw : String(raw).replace(/[^0-9.]/g, '');
      if (cleaned === '') return undefined as never;
      const n = typeof cleaned === 'number' ? cleaned : Number(cleaned);
      return Number.isFinite(n) ? (n as never) : (undefined as never);
    }
    case 'boolean':
      return Boolean(raw) as never;
    case 'chips_multi':
    case 'tags':
      return (Array.isArray(raw) ? raw : []) as never;
    case 'scale':
    case 'chips_single':
    default:
      return raw as never;
  }
}

// Re-export the option constants for any consumer that wants to render legends.
export { IMPORTANCE_OPTIONS, INTEREST_OPTIONS };
export type { EmploymentType, Importance, Interest, ShiftPreference, StartUrgency };
