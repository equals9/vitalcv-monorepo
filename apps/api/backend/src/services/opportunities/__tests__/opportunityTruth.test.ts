jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {},
}));

import {
  buildOpportunityTruth,
  classifyOpportunityProfession,
  classifyOpportunitySchedule,
  matchesOpportunityTruthFilters,
  type ClinicianOpportunityProfile,
  type OpportunityTruthRecord,
} from '../opportunityTruth';

function makeOpportunityRecord(): OpportunityTruthRecord {
  return {
    id: 'opp-1',
    organizationId: 'org-1',
    title: 'Family Medicine Physician - Rural Washington Coverage',
    specialty: 'Family Medicine',
    hiringType: 'locums',
    state: 'WA',
    payRange: '$180-$220/hr',
    requirementLevel: 'L2',
    description: 'Rural access clinic assignment with housing stipend and a pre-cleared onboarding packet.',
    remote: false,
    status: 'ACTIVE',
    // A real employer-posted row always carries the column (it defaults); the
    // integrated-apply rule requires the positive value, so the fixture says so.
    listingSource: 'employer_posted',
    createdAt: new Date('2026-03-10T00:00:00.000Z'),
    updatedAt: new Date('2026-03-18T00:00:00.000Z'),
    organization: {
      name: 'Northwest Locums Alliance',
      slug: 'northwest-locums-alliance',
      organizationProfile: {
        facilityType: 'staffing_agency',
        hiringStatus: 'ACTIVELY_HIRING',
        timeToStart: '7-10 days',
        timeToOnboard: '4-6 business days',
        clearToStartThreshold: 'Active state license, recent references, and current malpractice coverage.',
        payTransparency: true,
        payRange: '$180-$220/hr',
        description: 'Pacific Northwest locums coverage with clean credential packets.',
        tagline: 'Connecting credentialed clinicians with Pacific Northwest opportunities.',
        requirements: [
          {
            label: 'WA or OR Medical License',
            level: 'L3',
            key: 'state_license',
            priority: 'required',
          },
          {
            label: 'Current Malpractice Coverage',
            level: 'L2',
            key: 'malpractice',
            priority: 'required',
          },
        ],
        verifiedSince: new Date('2026-03-01T00:00:00.000Z'),
        verified: true,
        updatedAt: new Date('2026-03-18T00:00:00.000Z'),
      },
    },
  };
}

function makeClinician(states: string[]): ClinicianOpportunityProfile {
  return {
    npi: '1234567890',
    specialty: 'Family Medicine',
    stateOfPractice: states[0] ?? null,
    states,
    workAuthStatus: 'authorized',
    credentials: [
      {
        key: 'npi',
        level: 'L3',
        status: 'active',
        state: null,
        specialty: null,
        source: 'CMS NPPES',
      },
      {
        key: 'state_license',
        level: 'L3',
        status: 'active',
        state: states[0] ?? null,
        specialty: 'Family Medicine',
        source: 'State board',
      },
    ],
  };
}

describe('opportunityTruth', () => {
  it('builds a canonical truth record with compensation, support, and transparency signals', () => {
    const truth = buildOpportunityTruth({
      opportunity: makeOpportunityRecord(),
      clinicianProfile: makeClinician(['WA']),
      now: new Date('2026-03-20T00:00:00.000Z'),
    });

    expect(truth.organizationName).toBe('Northwest Locums Alliance');
    expect(truth.payModel).toBe('locums');
    expect(truth.payRangeMin).toBe(180);
    expect(truth.payRangeMax).toBe(220);
    expect(truth.benefitsAvailability).toBe('limited');
    expect(truth.benefitsItems).toContain('Housing stipend');
    expect(truth.freshness.listingStatus).toBe('fresh');
    expect(truth.transparency.speedToStartEstimate).toContain('7-10 days');
    expect(truth.credentialRequirements).toHaveLength(2);
    expect(truth.profession).toBe('physician');
    expect(truth.schedule).toBe('not_stated');
    expect(truth.applicationMode).toBe('vitalcv');
    expect(truth.source.url).toBe('/opportunities/opp-1');
    expect(truth.availability).toMatchObject({
      state: 'open',
      confidence: 'recent_observation',
      observedAt: '2026-03-18T00:00:00.000Z',
    });
    expect(truth.compensationProvenance).toMatchObject({
      state: 'supplied',
      method: 'source_text',
      sourceLabel: 'Employer profile + public opportunity record',
    });
  });

  it('derives browse facets only from explicit title or labelled schedule text', () => {
    expect(classifyOpportunityProfession('Nurse Practitioner - California')).toBe('advanced_practice');
    expect(classifyOpportunityProfession('Registered Nurse')).toBe('nursing');
    expect(classifyOpportunityProfession('Mental Health Therapist')).toBe('behavioral_health');
    expect(classifyOpportunityProfession('Territory Manager (MD, Baltimore)')).toBe('not_stated');
    expect(classifyOpportunityProfession('Locums Interventional Cardiologist')).toBe('physician');
    expect(classifyOpportunityProfession('Night Hospitalist')).toBe('physician');

    expect(classifyOpportunitySchedule('Part-Time NY Center Physician', null)).toBe('part_time');
    expect(classifyOpportunitySchedule('Nurse Practitioner', 'Employment Type: Full-Time FLSA exempt')).toBe('full_time');
    expect(classifyOpportunitySchedule('Registered Nurse', 'Join our full-time clinical team.')).toBe('not_stated');
  });

  it('does not let a recent organization edit refresh an old role observation', () => {
    const record = makeOpportunityRecord();
    const truth = buildOpportunityTruth({
      opportunity: {
        ...record,
        updatedAt: new Date('2025-12-01T00:00:00.000Z'),
        organization: {
          ...record.organization,
          organizationProfile: {
            ...record.organization.organizationProfile!,
            updatedAt: new Date('2026-03-19T00:00:00.000Z'),
          },
        },
      },
      now: new Date('2026-03-20T00:00:00.000Z'),
    });

    expect(truth.freshness.lastUpdatedAt).toBe('2025-12-01T00:00:00.000Z');
    expect(truth.availability).toMatchObject({
      state: 'stale',
      confidence: 'stale_observation',
      observedAt: '2025-12-01T00:00:00.000Z',
    });
  });

  it('preserves a closed role as an explicit non-actionable availability state', () => {
    const truth = buildOpportunityTruth({
      opportunity: {
        ...makeOpportunityRecord(),
        status: 'CLOSED',
      },
      now: new Date('2026-03-20T00:00:00.000Z'),
    });

    expect(truth.status).toBe('CLOSED');
    expect(truth.availability).toMatchObject({
      state: 'closed',
      limitation: 'This role is recorded as closed.',
    });
  });

  it('filters on profession and schedule without creating an eligibility verdict', () => {
    const record = makeOpportunityRecord();
    const truth = buildOpportunityTruth({
      opportunity: {
        ...record,
        title: 'Part-Time Family Medicine Physician',
      },
      now: new Date('2026-03-20T00:00:00.000Z'),
    });

    expect(matchesOpportunityTruthFilters(truth, { profession: 'physician' })).toBe(true);
    expect(matchesOpportunityTruthFilters(truth, { profession: 'nursing' })).toBe(false);
    expect(matchesOpportunityTruthFilters(truth, { schedule: 'part_time' })).toBe(true);
    expect(truth.comparison).toBeNull();
  });

  it('filters only on explicit application, compensation, benefits, and source observation truth', () => {
    const truth = buildOpportunityTruth({
      opportunity: makeOpportunityRecord(),
      now: new Date(),
    });
    truth.availability.observedAt = new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)).toISOString();

    expect(matchesOpportunityTruthFilters(truth, { applicationMode: 'vitalcv' })).toBe(true);
    expect(matchesOpportunityTruthFilters(truth, { applicationMode: 'external' })).toBe(false);
    expect(matchesOpportunityTruthFilters(truth, { compensation: 'supplied' })).toBe(true);
    expect(matchesOpportunityTruthFilters(truth, { compensation: 'not_supplied' })).toBe(false);
    expect(matchesOpportunityTruthFilters(truth, { benefits: 'limited' })).toBe(true);
    expect(matchesOpportunityTruthFilters(truth, { observedWithinDays: 3 })).toBe(true);
    expect(matchesOpportunityTruthFilters(truth, { observedWithinDays: 1 })).toBe(false);

    truth.availability.observedAt = null;
    expect(matchesOpportunityTruthFilters(truth, { observedWithinDays: 30 })).toBe(false);
  });

  it('marks state mismatch as a confirmed blocker and filters by readiness fit', () => {
    const truth = buildOpportunityTruth({
      opportunity: makeOpportunityRecord(),
      clinicianProfile: makeClinician(['CA']),
      now: new Date('2026-03-20T00:00:00.000Z'),
    });

    expect(truth.comparison?.status).toBe('requirements_missing');
    expect(truth.comparison?.missing[0]?.label).toContain('WA or OR Medical License');

    expect(matchesOpportunityTruthFilters(truth, { readinessStatus: 'requirements_missing' })).toBe(true);
    expect(matchesOpportunityTruthFilters(truth, { readinessStatus: 'ready_now' })).toBe(false);
    expect(matchesOpportunityTruthFilters(truth, { payModel: 'locums', payMin: 200 })).toBe(true);
    expect(matchesOpportunityTruthFilters(truth, { missingRequirement: 'state_license' })).toBe(true);
  });
});

/**
 * The Opportunity table carries STRUCTURED columns — pay_min, pay_max,
 * employer_type, start_urgency — written by createOpportunity and scored by the
 * MATCHA engine. The public read path derived all four from free text instead
 * and never read the columns, so a role posted with a structured pay range and
 * no prose one surfaced payRangeMin/Max = null. The pay filter then DROPPED
 * that role, because it rejects any row whose payRangeMax is null.
 *
 * These cases pin the columns as authoritative, with the text derivation kept
 * as the fallback for rows that predate them.
 */
describe('structured opportunity columns are authoritative', () => {
  function makeStructuredRecord(): OpportunityTruthRecord {
    const record = makeOpportunityRecord();
    return {
      ...record,
      // No prose pay anywhere — the structured columns are the only source.
      payRange: null,
      payMin: 320000,
      payMax: 355000,
      employerType: 'hospital',
      startUrgency: 'immediate',
      organization: {
        ...record.organization,
        organizationProfile: {
          ...record.organization.organizationProfile!,
          payRange: null,
          facilityType: 'staffing_agency',
          timeToStart: '7-10 days',
        },
      },
    };
  }

  it('surfaces a structured pay range when no prose pay range exists', () => {
    const truth = buildOpportunityTruth({
      opportunity: makeStructuredRecord(),
      now: new Date('2026-03-20T00:00:00.000Z'),
    });

    expect(truth.payRangeMin).toBe(320000);
    expect(truth.payRangeMax).toBe(355000);
  });

  it('keeps a structured role inside its own pay filter', () => {
    const truth = buildOpportunityTruth({
      opportunity: makeStructuredRecord(),
      now: new Date('2026-03-20T00:00:00.000Z'),
    });

    // The regression: with payRangeMax null, both of these returned false and
    // the role vanished from a filtered board.
    expect(matchesOpportunityTruthFilters(truth, { payMin: 300000 })).toBe(true);
    expect(matchesOpportunityTruthFilters(truth, { payMax: 400000 })).toBe(true);
    expect(matchesOpportunityTruthFilters(truth, { payMin: 400000 })).toBe(false);
  });

  it('prefers the opportunity column over the organization-level derivation', () => {
    const truth = buildOpportunityTruth({
      opportunity: makeStructuredRecord(),
      now: new Date('2026-03-20T00:00:00.000Z'),
    });

    // facilityType is 'staffing_agency' and timeToStart is '7-10 days'; the
    // per-role columns say otherwise and must win.
    expect(truth.employerType).toBe('hospital');
    expect(truth.startUrgency).toBe('immediate');
  });

  it('still derives from text for rows that predate the columns', () => {
    const truth = buildOpportunityTruth({
      opportunity: makeOpportunityRecord(),
      now: new Date('2026-03-20T00:00:00.000Z'),
    });

    expect(truth.payRangeMin).toBe(180);
    expect(truth.payRangeMax).toBe(220);
    expect(truth.employerType).toBe('staffing agency');
  });
});

describe('profession comes from the title, and a feed metadata field may not override it', () => {
  /**
   * This looks like a missing feature. It is a measured decision — see the
   * 20260816220000 migration.
   *
   * Greenhouse employers fill a `Clinician Type` metadata field, and reading it
   * shipped in #1435 and was reverted the same day. Measured against the live
   * roster, of the jobs carrying a single-valued Clinician Type:
   *
   *   249  agreed with what the title already produced   (redundant)
   *     0  resolved a title the classifier could not read (no new coverage)
   *     6  CONTRADICTED the title                         (actively wrong)
   *
   * In all 6 the metadata was the wrong half: "Per Diem Family Medicine
   * Physician" tagged `NP or PA`, and "Nurse Practitioner or Physician
   * Assistant" tagged `MD or DO`. Preferring it hid roles from exactly the
   * clinicians they were written for.
   *
   * A source that adds nothing and is wrong 6 times is not a better source.
   * Before wiring this field again, re-measure those three numbers.
   */
  it('classifies an "or" title as advanced practice, which is who it is written for', () => {
    const truth = buildOpportunityTruth({
      opportunity: {
        ...makeOpportunityRecord(),
        title: 'Casual Nurse Practitioner or Physician Assistant',
      },
      now: new Date('2026-03-20T00:00:00.000Z'),
    });
    expect(truth.profession).toBe('advanced_practice');
  });

  it('ignores any stray stated-profession value left on the record', () => {
    // Proves the read path has no back door: an extra property cannot steer
    // the facet even if some future writer sets one.
    const truth = buildOpportunityTruth({
      opportunity: {
        ...makeOpportunityRecord(),
        title: 'Casual Nurse Practitioner or Physician Assistant',
        statedProfession: 'physician',
      },
      now: new Date('2026-03-20T00:00:00.000Z'),
    } as never);
    expect(truth.profession).toBe('advanced_practice');
  });
});
