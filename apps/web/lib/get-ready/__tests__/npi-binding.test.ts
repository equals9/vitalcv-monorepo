import { describe, expect, it } from 'vitest';
import {
  describeBootstrapError,
  isNpiBootstrapResult,
  summarizeBootstrapResult,
  validateNpi,
  type NpiBootstrapResult,
} from '@/lib/get-ready/npi-binding';

describe('validateNpi', () => {
  it('accepts a clean 10-digit NPI and normalizes spaces/dashes', () => {
    expect(validateNpi('1234567890')).toEqual({ ok: true, npi: '1234567890', reason: null });
    expect(validateNpi(' 123-456-7890 ')).toEqual({ ok: true, npi: '1234567890', reason: null });
  });

  it('rejects empty, non-numeric, and wrong-length input with actionable reasons', () => {
    expect(validateNpi('').ok).toBe(false);
    expect(validateNpi('12345abcde').reason).toContain('digits only');
    expect(validateNpi('12345').reason).toContain('exactly 10 digits');
    expect(validateNpi('123456789012').reason).toContain('you entered 12');
  });
});

function result(overrides: Partial<NpiBootstrapResult> = {}): NpiBootstrapResult {
  return {
    npi: '1234567890',
    npiType: 'TYPE_1',
    firstName: 'Test',
    lastName: 'Clinician',
    specialty: 'Internal Medicine',
    stateOfPractice: 'CA',
    inferredPersona: 'CLINICIAN',
    alreadyRegistered: false,
    completeness: 30,
    ...overrides,
  };
}

describe('isNpiBootstrapResult', () => {
  it('accepts the backend intake shape', () => {
    expect(isNpiBootstrapResult(result())).toBe(true);
  });

  it('rejects malformed payloads', () => {
    expect(isNpiBootstrapResult(null)).toBe(false);
    expect(isNpiBootstrapResult({})).toBe(false);
    expect(isNpiBootstrapResult({ npi: 123, npiType: 'TYPE_1', completeness: 30 })).toBe(false);
    expect(isNpiBootstrapResult({ npi: '1', npiType: 'TYPE_9', completeness: 30 })).toBe(false);
  });
});

describe('summarizeBootstrapResult', () => {
  it('summarizes a Type 1 match as a registry-identity statement only', () => {
    const summary = summarizeBootstrapResult(result());
    expect(summary.displayName).toBe('Test Clinician');
    expect(summary.isOrganizationNpi).toBe(false);
    expect(summary.statement).toContain('registry identity');
    expect(summary.statement).toContain('license and exclusion checks run separately');
    // Never a bare verification claim
    expect(summary.statement.toLowerCase()).not.toContain('automatically verified');
    expect(summary.statement).not.toMatch(/\bVerified\b/);
  });

  it('flags Type 2 organization NPIs honestly', () => {
    const summary = summarizeBootstrapResult(result({ npiType: 'TYPE_2', firstName: null, lastName: null }));
    expect(summary.isOrganizationNpi).toBe(true);
    expect(summary.statement).toContain('organization (Type 2)');
    expect(summary.displayName).toBeNull();
  });

  it('handles registry records with no listed name', () => {
    const summary = summarizeBootstrapResult(result({ firstName: null, lastName: null }));
    expect(summary.displayName).toBeNull();
  });
});

describe('describeBootstrapError', () => {
  it('explains an NPI owned by another account', () => {
    const text = describeBootstrapError(500, { error: 'NPI 1234567890 is already registered to another account.' });
    expect(text).toContain('different VitalCV account');
  });

  it('reads the nested { error: { code, message } } shape from the backend global handler', () => {
    const text = describeBootstrapError(500, {
      error: { code: 'INTERNAL', message: 'NPI 1234567890 is already registered to another account.' },
    });
    expect(text).toContain('different VitalCV account');
    const badInput = describeBootstrapError(422, { error: { code: 'BAD_REQUEST', message: 'npi must be exactly 10 digits.' } });
    expect(badInput).toContain('exactly 10 digits');
  });

  it('maps auth expiry, bad input, missing record, and system failure distinctly', () => {
    expect(describeBootstrapError(401, null)).toContain('Sign in again');
    expect(describeBootstrapError(422, { error: 'NPI must be exactly 10 digits.' })).toContain('exactly 10 digits');
    expect(describeBootstrapError(404, null)).toContain('No NPPES registry record');
    expect(describeBootstrapError(503, null)).toContain('system state');
  });

  it('never blames the clinician for system failures', () => {
    expect(describeBootstrapError(500, null)).toContain('not a finding about your NPI');
    expect(describeBootstrapError(502, {
      error: { code: 'SOURCE_UNAVAILABLE', message: 'The NPPES registry could not be consulted, so the NPI was not connected.' },
    })).toContain('not a finding about your NPI');
  });

  it('reads the 409 conflict by status, not by the legacy wording', () => {
    const text = describeBootstrapError(409, {
      error: {
        code: 'CONFLICT',
        message: 'This NPI is already connected to another VitalCV account. If this is your NPI, contact support — conflicting claims are routed to review.',
      },
    });
    expect(text).toContain('different VitalCV account');
    expect(text).not.toContain('system state');
  });

  it('surfaces the registry miss sentence for a 422 the backend reports as not enumerated', () => {
    const text = describeBootstrapError(422, {
      error: { code: 'UNPROCESSABLE_ENTITY', message: 'NPI not found in the registry.' },
    });
    expect(text).toBe('NPI not found in the registry.');
  });
});
