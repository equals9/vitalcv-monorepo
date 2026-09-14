/**
 * constraintFit — the clinician's stated terms checked against a role record.
 *
 * Pins the three-way answer (met / not met / unknown), that an unstated or
 * incomparable term is unknown rather than a pass or a fail, that a hard term is
 * reported and never relaxed, and that the sanitizer's closed vocabulary keeps an
 * unknown constraint key from ever reaching the evaluator.
 */
import { describe, expect, it } from 'vitest';

import {
  CONSTRAINT_VERDICT_HEADING,
  evaluateConstraintFit,
  type ConstraintOpportunity,
} from '@/lib/matcha/constraintFit';
import { sanitizeStoredPreferences, type MatchaPreferences } from '@/lib/matcha/preferences';

function role(overrides: Partial<ConstraintOpportunity> = {}): ConstraintOpportunity {
  return {
    state: 'TX',
    remote: false,
    schedule: 'not_stated',
    payRangeMin: null,
    payRangeMax: null,
    payUnit: 'unknown',
    compensationProvenance: {
      state: 'not_supplied',
      method: 'not_supplied',
      sourceLabel: 'Listed on greenhouse',
      observedAt: null,
    },
    visaSponsorshipStatus: 'not_stated',
    ...overrides,
  };
}

const byKey = (prefs: MatchaPreferences, opp: ConstraintOpportunity) =>
  Object.fromEntries(evaluateConstraintFit(prefs, opp).results.map((r) => [r.key, r]));

describe('evaluateConstraintFit', () => {
  it('evaluates nothing when the clinician stated no terms', () => {
    const fit = evaluateConstraintFit({}, role({ state: 'CA', schedule: 'full_time' }));
    expect(fit.results).toEqual([]);
    expect(fit.verdict).toBe('no_terms');
  });

  it('a role that fails a hard term is reported as a hard miss, not relaxed', () => {
    const fit = evaluateConstraintFit(
      { preferredStates: ['CA', 'WA'], hardConstraints: ['location'] },
      role({ state: 'TX' }),
    );
    expect(fit.verdict).toBe('hard_not_met');
    expect(fit.counts.hardNotMet).toBe(1);
    const loc = fit.results[0];
    expect(loc.key).toBe('location');
    expect(loc.hard).toBe(true);
    expect(loc.status).toBe('not_met');
    expect(loc.reason).toContain('TX');
    expect(loc.reason).toContain('CA, WA');
    expect(CONSTRAINT_VERDICT_HEADING[fit.verdict]).toMatch(/fails a term you marked non-negotiable/);
  });

  it('the same miss on an advisory term is still "not met", just not a hard verdict', () => {
    const fit = evaluateConstraintFit({ preferredStates: ['CA'] }, role({ state: 'TX' }));
    expect(fit.results[0].status).toBe('not_met');
    expect(fit.results[0].hard).toBe(false);
    expect(fit.verdict).toBe('no_hard_terms');
  });

  it('a term the source does not state is unknown and carries the settling question', () => {
    const r = byKey(
      { employmentTypes: ['part_time'], hardConstraints: ['employment_type'] },
      role({ schedule: 'not_stated' }),
    );
    expect(r.employment_type.status).toBe('unknown');
    expect(r.employment_type.theirs).toBe('Not stated by source');
    expect(r.employment_type.nextQuestion).toMatch(/full-time, part-time or per diem/);
    expect(evaluateConstraintFit(
      { employmentTypes: ['part_time'], hardConstraints: ['employment_type'] },
      role({ schedule: 'not_stated' }),
    ).verdict).toBe('hard_unknown');
  });

  it('unknown never becomes met: a hard unknown does not count toward hard_met', () => {
    const fit = evaluateConstraintFit(
      { preferredStates: ['TX'], minimumSalary: 200000, hardConstraints: ['location', 'compensation'] },
      role({ state: 'TX' }),
    );
    expect(fit.counts).toEqual({ hardMet: 1, hardUnknown: 1, hardNotMet: 0 });
    expect(fit.verdict).toBe('hard_unknown');
  });

  it('compares pay only when the source supplied an annual range', () => {
    const supplied = {
      state: 'supplied' as const,
      method: 'structured_source' as const,
      sourceLabel: 'Employer record',
      observedAt: '2026-09-01T00:00:00.000Z',
    };
    const prefs: MatchaPreferences = { minimumSalary: 150000 };

    expect(byKey(prefs, role({ compensationProvenance: supplied, payRangeMin: 140000, payRangeMax: 160000, payUnit: 'year' }))
      .compensation.status).toBe('met');
    expect(byKey(prefs, role({ compensationProvenance: supplied, payRangeMin: 120000, payRangeMax: 140000, payUnit: 'year' }))
      .compensation.status).toBe('not_met');

    // Hourly against an annual floor is not a comparison — it is a question about hours.
    const hourly = byKey(prefs, role({ compensationProvenance: supplied, payRangeMin: 95, payRangeMax: 135, payUnit: 'hour' }));
    expect(hourly.compensation.status).toBe('unknown');
    expect(hourly.compensation.theirs).toBe('$95–$135 per hour');
    expect(hourly.compensation.nextQuestion).toMatch(/hours|annualized/);

    // A range present in the row but not marked supplied by provenance is not evidence.
    expect(byKey(prefs, role({ payRangeMin: 140000, payRangeMax: 160000, payUnit: 'year' }))
      .compensation.status).toBe('unknown');
  });

  it('reads arrangement from schedule only, never from the hardcoded hiringType', () => {
    const prefs: MatchaPreferences = { employmentTypes: ['full_time', 'per_diem'] };
    expect(byKey(prefs, role({ schedule: 'full_time' })).employment_type.status).toBe('met');
    expect(byKey(prefs, role({ schedule: 'part_time' })).employment_type.status).toBe('not_met');
    expect(byKey(prefs, role({ schedule: 'flexible' })).employment_type.status).toBe('met');
    // Wanting locums only: the schedule field cannot answer that, so it stays unknown.
    const locums = byKey({ employmentTypes: ['locums'] }, role({ schedule: 'full_time' }));
    expect(locums.employment_type.status).toBe('unknown');
    expect(locums.employment_type.nextQuestion).toMatch(/locums/);
  });

  it('remote without a state is unknown for location, because licensure can still bind', () => {
    const r = byKey({ preferredStates: ['CA'] }, role({ state: '', remote: true }));
    expect(r.location.status).toBe('unknown');
    expect(r.location.nextQuestion).toMatch(/licensure/);
  });

  it('sponsorship: available, not available, case by case, and silence are four answers', () => {
    const prefs: MatchaPreferences = { visaSponsorshipNeeded: true };
    expect(byKey(prefs, role({ visaSponsorshipStatus: 'available' })).visa_sponsorship.status).toBe('met');
    expect(byKey(prefs, role({ visaSponsorshipStatus: 'not_available' })).visa_sponsorship.status).toBe('not_met');
    expect(byKey(prefs, role({ visaSponsorshipStatus: 'case_by_case' })).visa_sponsorship.status).toBe('unknown');
    expect(byKey(prefs, role({ visaSponsorshipStatus: undefined })).visa_sponsorship.status).toBe('unknown');
    // Not needing sponsorship is not a term; nothing is evaluated.
    expect(byKey({ visaSponsorshipNeeded: false }, role()).visa_sponsorship).toBeUndefined();
  });

  it('lists hard terms first so the miss is read first', () => {
    const fit = evaluateConstraintFit(
      { preferredStates: ['TX'], minimumSalary: 1, hardConstraints: ['compensation'] },
      role({ state: 'TX' }),
    );
    expect(fit.results.map((r) => r.key)).toEqual(['compensation', 'location']);
  });

  it('a hard key the sanitizer does not know never reaches the evaluator', () => {
    const stored = sanitizeStoredPreferences({
      preferredStates: ['CA'],
      hardConstraints: ['location', 'shift', 'everything', 42, 'location'],
    });
    expect(stored.hardConstraints).toEqual(['location']);
    // Injected defect check: had the unknown key survived, it would have been silently
    // ignored by the evaluator and the clinician would believe a term was enforced.
    const fit = evaluateConstraintFit(stored, role({ state: 'TX' }));
    expect(fit.results.map((r) => [r.key, r.hard])).toEqual([['location', true]]);
  });

  it('an empty hardConstraints array is dropped, so the model stays advisory by default', () => {
    expect(sanitizeStoredPreferences({ hardConstraints: [] }).hardConstraints).toBeUndefined();
    expect(sanitizeStoredPreferences({ hardConstraints: 'location' }).hardConstraints).toBeUndefined();
  });
});
