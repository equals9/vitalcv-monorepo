/**
 * constraintFit — evaluates a role record against the terms a clinician has actually
 * stated, one dimension at a time, and reports each as met, not met, or unknown.
 *
 * Truth contract:
 *  - A dimension is evaluated only when the clinician stated a preference for it. Nothing
 *    is inferred about what they might want.
 *  - `unknown` is a first-class result. When the role record does not state the term, or
 *    states it in terms that cannot be compared (an hourly rate against an annual floor),
 *    the result is unknown and carries the question that would resolve it. Unknown never
 *    becomes a pass, and never becomes a fail.
 *  - A hard constraint (see {@link HardConstraintKey}) changes only the reporting: a role
 *    that fails it is a hard miss the clinician decides on. It is not removed, and it is
 *    not quietly ranked lower.
 *  - Feed rows carry a hardcoded `hiringType`; it is not evidence of what the employer said
 *    (see opportunityRowFacts in opportunity-display). Arrangement is therefore read from
 *    `schedule` only.
 *
 * Pure: no fetch, no clock, no DOM. Complements preferenceMatchReasons, which explains
 * alignment; this module answers "does this role satisfy the terms I set?".
 */

import type { OpportunitySummary } from '@/lib/launch/marketplace';
import {
  type HardConstraintKey,
  type MatchaPreferences,
  HARD_CONSTRAINT_KEYS,
} from './preferences';

export type ConstraintKey = HardConstraintKey;
export type ConstraintStatus = 'met' | 'not_met' | 'unknown';

export interface ConstraintResult {
  key: ConstraintKey;
  /** Plain label, e.g. "Location". */
  label: string;
  /** True when the clinician marked this dimension non-negotiable. */
  hard: boolean;
  status: ConstraintStatus;
  /** What the clinician said, in their own units. */
  yours: string;
  /** What the role record states, or an explicit "not stated" line. */
  theirs: string;
  /** One sentence a person can read aloud explaining the status. */
  reason: string;
  /** Present only when status is `unknown`: the question that would settle it. */
  nextQuestion?: string;
}

export type ConstraintVerdict =
  /** The clinician stated no terms at all, so there is nothing to evaluate. */
  | 'no_terms'
  /** Terms exist but none is marked non-negotiable. */
  | 'no_hard_terms'
  | 'hard_met'
  | 'hard_unknown'
  | 'hard_not_met';

export interface ConstraintFit {
  results: ConstraintResult[];
  verdict: ConstraintVerdict;
  counts: { hardMet: number; hardUnknown: number; hardNotMet: number };
}

/** The inputs this evaluator reads from a role record. Subset of OpportunitySummary. */
export type ConstraintOpportunity = Pick<
  OpportunitySummary,
  | 'state'
  | 'remote'
  | 'schedule'
  | 'payRangeMin'
  | 'payRangeMax'
  | 'payUnit'
  | 'compensationProvenance'
  | 'visaSponsorshipStatus'
>;

const LABEL: Record<ConstraintKey, string> = {
  location: 'Location',
  compensation: 'Minimum pay',
  employment_type: 'Arrangement',
  visa_sponsorship: 'Visa sponsorship',
};

const SCHEDULE_TEXT: Record<string, string> = {
  full_time: 'full-time',
  part_time: 'part-time',
  per_diem: 'per diem',
  flexible: 'flexible',
};

/** Clinician employment types that a role's `schedule` field can actually answer. */
const SCHEDULE_COMPARABLE: Record<string, string> = {
  full_time: 'full_time',
  part_time: 'part_time',
  per_diem: 'per_diem',
};

function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function normalizeState(value: string | undefined | null): string {
  return (value ?? '').trim().toUpperCase();
}

function evaluateLocation(prefs: MatchaPreferences, opp: ConstraintOpportunity): ConstraintResult | null {
  const states = (prefs.preferredStates ?? []).map(normalizeState).filter(Boolean);
  if (states.length === 0) return null;
  const yours = states.join(', ');
  const base = { key: 'location' as const, label: LABEL.location, hard: false, yours };
  const roleState = normalizeState(opp.state);

  if (roleState) {
    if (states.includes(roleState)) {
      return { ...base, status: 'met', theirs: roleState, reason: `The role is in ${roleState}, one of the states you named.` };
    }
    return {
      ...base,
      status: 'not_met',
      theirs: roleState,
      reason: `The role is in ${roleState}. You named ${yours}.`,
    };
  }
  if (opp.remote === true) {
    return {
      ...base,
      status: 'unknown',
      theirs: 'Remote, state not stated',
      reason: 'The role is listed as remote without a state. Remote work can still carry a state licensure requirement.',
      nextQuestion: 'Ask which state licensure the remote role requires.',
    };
  }
  return {
    ...base,
    status: 'unknown',
    theirs: 'Not stated by source',
    reason: 'The role record does not state a location.',
    nextQuestion: `Ask whether the role is in ${yours}.`,
  };
}

function evaluateCompensation(prefs: MatchaPreferences, opp: ConstraintOpportunity): ConstraintResult | null {
  const floor = prefs.minimumSalary;
  if (typeof floor !== 'number' || !Number.isFinite(floor)) return null;
  const yours = `${money(floor)}/year minimum`;
  const base = { key: 'compensation' as const, label: LABEL.compensation, hard: false, yours };

  const supplied = opp.compensationProvenance?.state === 'supplied';
  const min = typeof opp.payRangeMin === 'number' ? opp.payRangeMin : null;
  const max = typeof opp.payRangeMax === 'number' ? opp.payRangeMax : null;
  if (!supplied || (min === null && max === null)) {
    return {
      ...base,
      status: 'unknown',
      theirs: 'Not supplied by source',
      reason: 'The source did not publish a pay range, so your minimum cannot be checked.',
      nextQuestion: 'Ask the source for the pay range before spending time on this role.',
    };
  }
  const top = max ?? min;
  const bottom = min ?? max;
  if (opp.payUnit !== 'year') {
    const unit = opp.payUnit === 'hour' ? 'per hour' : opp.payUnit === 'shift' ? 'per shift' : 'in an unstated unit';
    const range = top !== null && bottom !== null && top !== bottom
      ? `${money(bottom as number)}–${money(top as number)}`
      : money((top ?? bottom) as number);
    return {
      ...base,
      status: 'unknown',
      theirs: `${range} ${unit}`,
      reason: `The role states pay ${unit}; your minimum is annual. Without expected hours the two cannot be compared.`,
      nextQuestion: 'Ask for expected hours or an annualized figure.',
    };
  }
  const theirs = top !== null && bottom !== null && top !== bottom
    ? `${money(bottom as number)}–${money(top as number)}/year`
    : `${money((top ?? bottom) as number)}/year`;
  if ((top as number) >= floor) {
    return { ...base, status: 'met', theirs, reason: `The stated range reaches ${money(floor)}.` };
  }
  return {
    ...base,
    status: 'not_met',
    theirs,
    reason: `The top of the stated range is below your ${money(floor)} minimum.`,
  };
}

function evaluateEmploymentType(prefs: MatchaPreferences, opp: ConstraintOpportunity): ConstraintResult | null {
  const wanted = prefs.employmentTypes ?? [];
  if (wanted.length === 0) return null;
  const yours = wanted.map((t) => t.replace(/_/g, ' ')).join(', ');
  const base = { key: 'employment_type' as const, label: LABEL.employment_type, hard: false, yours };
  const comparable = wanted.map((t) => SCHEDULE_COMPARABLE[t]).filter(Boolean);
  const schedule = opp.schedule;

  if (!schedule || schedule === 'not_stated') {
    return {
      ...base,
      status: 'unknown',
      theirs: 'Not stated by source',
      reason: 'The role record does not state whether it is full-time, part-time or per diem.',
      nextQuestion: 'Ask whether the role is full-time, part-time or per diem.',
    };
  }
  const theirs = SCHEDULE_TEXT[schedule] ?? schedule;
  if (comparable.length === 0) {
    return {
      ...base,
      status: 'unknown',
      theirs,
      reason: `You asked for ${yours}; the role record only states its schedule (${theirs}), which does not answer that.`,
      nextQuestion: `Ask whether the role is offered as ${yours}.`,
    };
  }
  if (schedule === 'flexible') {
    return { ...base, status: 'met', theirs, reason: 'The role states a flexible schedule.' };
  }
  if (comparable.includes(schedule)) {
    return { ...base, status: 'met', theirs, reason: `The role is ${theirs}, which you said works for you.` };
  }
  return {
    ...base,
    status: 'not_met',
    theirs,
    reason: `The role is ${theirs}. You asked for ${yours}.`,
  };
}

function evaluateVisaSponsorship(prefs: MatchaPreferences, opp: ConstraintOpportunity): ConstraintResult | null {
  if (prefs.visaSponsorshipNeeded !== true) return null;
  const base = { key: 'visa_sponsorship' as const, label: LABEL.visa_sponsorship, hard: false, yours: 'Sponsorship needed' };
  switch (opp.visaSponsorshipStatus) {
    case 'available':
      return { ...base, status: 'met', theirs: 'Available', reason: 'The role states that sponsorship is available.' };
    case 'not_available':
      return { ...base, status: 'not_met', theirs: 'Not available', reason: 'The role states that sponsorship is not available.' };
    case 'case_by_case':
      return {
        ...base,
        status: 'unknown',
        theirs: 'Case by case',
        reason: 'The employer decides sponsorship per case; the record does not settle yours.',
        nextQuestion: 'Ask whether sponsorship would be considered for your situation.',
      };
    default:
      return {
        ...base,
        status: 'unknown',
        theirs: 'Not stated by source',
        reason: 'The role record does not state a sponsorship position.',
        nextQuestion: 'Ask whether the role offers visa sponsorship.',
      };
  }
}

const EVALUATORS: Record<ConstraintKey, (p: MatchaPreferences, o: ConstraintOpportunity) => ConstraintResult | null> = {
  location: evaluateLocation,
  compensation: evaluateCompensation,
  employment_type: evaluateEmploymentType,
  visa_sponsorship: evaluateVisaSponsorship,
};

/**
 * Evaluate every term the clinician stated against the role record. Hard terms are listed
 * first so a miss on a non-negotiable is the first thing read.
 */
export function evaluateConstraintFit(
  prefs: MatchaPreferences,
  opp: ConstraintOpportunity,
): ConstraintFit {
  const hard = new Set<ConstraintKey>(prefs.hardConstraints ?? []);
  const results: ConstraintResult[] = [];
  for (const key of HARD_CONSTRAINT_KEYS) {
    const result = EVALUATORS[key](prefs, opp);
    if (result) results.push({ ...result, hard: hard.has(key) });
  }
  results.sort((a, b) => Number(b.hard) - Number(a.hard));

  const counts = { hardMet: 0, hardUnknown: 0, hardNotMet: 0 };
  for (const r of results) {
    if (!r.hard) continue;
    if (r.status === 'met') counts.hardMet += 1;
    else if (r.status === 'unknown') counts.hardUnknown += 1;
    else counts.hardNotMet += 1;
  }

  let verdict: ConstraintVerdict;
  if (results.length === 0) verdict = 'no_terms';
  else if (!results.some((r) => r.hard)) verdict = 'no_hard_terms';
  else if (counts.hardNotMet > 0) verdict = 'hard_not_met';
  else if (counts.hardUnknown > 0) verdict = 'hard_unknown';
  else verdict = 'hard_met';

  return { results, verdict, counts };
}

export const CONSTRAINT_STATUS_LABEL: Record<ConstraintStatus, string> = {
  met: 'Met',
  not_met: 'Not met',
  unknown: 'Unknown',
};

/** The heading a surface shows for the verdict. Names the person's own decision, never a ranking. */
export const CONSTRAINT_VERDICT_HEADING: Record<ConstraintVerdict, string> = {
  no_terms: 'You have not set any terms yet.',
  no_hard_terms: 'Your terms, checked against this role record.',
  hard_met: 'Every term you marked non-negotiable is met by this role record.',
  hard_unknown: 'A term you marked non-negotiable is not settled by this role record.',
  hard_not_met: 'This role fails a term you marked non-negotiable.',
};
