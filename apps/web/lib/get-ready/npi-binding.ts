/**
 * npi-binding — pure helpers for the /get-ready NPI binding flow.
 *
 * The flow binds the signed-in clinician's NPI to their workspace
 * PersonProfile via POST /api/profile/npi/bootstrap (backend upserts the
 * profile from the live NPPES registry record and emits an audit event).
 *
 * Truth contract: an NPPES match is an IDENTITY record match only. Nothing
 * here may claim license verification, credentialing, or a bare "Verified"
 * status — copy produced by these helpers says what was checked and no more.
 */

const NPI_RE = /^\d{10}$/;

export interface NpiValidation {
  ok: boolean;
  /** Normalized 10-digit NPI when ok. */
  npi: string | null;
  /** Human-readable reason when not ok. */
  reason: string | null;
}

export function validateNpi(raw: string): NpiValidation {
  const trimmed = raw.replace(/[\s-]/g, '');
  if (trimmed.length === 0) {
    return { ok: false, npi: null, reason: 'Enter your 10-digit NPI.' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, npi: null, reason: 'An NPI contains digits only.' };
  }
  if (!NPI_RE.test(trimmed)) {
    return {
      ok: false,
      npi: null,
      reason: `An NPI is exactly 10 digits — you entered ${trimmed.length}.`,
    };
  }
  return { ok: true, npi: trimmed, reason: null };
}

/** Shape returned by POST /api/profile/npi/bootstrap (backend intake). */
export interface NpiBootstrapResult {
  npi: string;
  npiType: 'TYPE_1' | 'TYPE_2';
  firstName?: string | null;
  lastName?: string | null;
  specialty?: string | null;
  stateOfPractice?: string | null;
  inferredPersona: 'CLINICIAN' | 'VERIFIER' | 'UNKNOWN';
  alreadyRegistered: boolean;
  completeness: number;
}

export function isNpiBootstrapResult(value: unknown): value is NpiBootstrapResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.npi === 'string' &&
    (v.npiType === 'TYPE_1' || v.npiType === 'TYPE_2') &&
    typeof v.completeness === 'number'
  );
}

export interface BoundIdentitySummary {
  /** Display name from the NPPES record, or null when the registry has none. */
  displayName: string | null;
  specialty: string | null;
  stateOfPractice: string | null;
  /** True when the NPI is an organization (Type 2) record. */
  isOrganizationNpi: boolean;
  /**
   * Honest one-line statement of what happened. States the registry match
   * only — never a verification claim beyond it.
   */
  statement: string;
}

export function summarizeBootstrapResult(result: NpiBootstrapResult): BoundIdentitySummary {
  const displayName =
    [result.firstName, result.lastName].filter(Boolean).join(' ').trim() || null;
  const isOrganizationNpi = result.npiType === 'TYPE_2';

  const statement = isOrganizationNpi
    ? `NPI ${result.npi} is an organization (Type 2) record in the NPPES registry. VitalCV career surfaces are built for individual (Type 1) NPIs.`
    : `NPPES registry identity record matched for NPI ${result.npi}. This confirms your registry identity only — license and exclusion checks run separately on your readiness surface.`;

  return {
    displayName,
    specialty: result.specialty ?? null,
    stateOfPractice: result.stateOfPractice ?? null,
    isOrganizationNpi,
    statement,
  };
}

/**
 * Maps a failed bootstrap response to honest, actionable copy.
 *
 * The backend answers a second account binding an already-bound NPI with a
 * 409 (the legacy wording "already registered to another account" is still
 * recognised for proxies that preserve older bodies). A number NPPES has not
 * enumerated is a 422 whose message is a finding about the number; a registry
 * outage is a 502 and is described as a system state, never as a finding
 * about the clinician.
 */
export function describeBootstrapError(status: number, body: unknown): string {
  // The web proxies preserve backend error bodies, which come in two shapes:
  // a plain string (`{ error: '…' }`) or the global handler's nested form
  // (`{ error: { code, message } }`). Read both.
  let message: string | null = null;
  if (body && typeof body === 'object') {
    const raw = (body as { error?: unknown }).error;
    if (typeof raw === 'string') {
      message = raw;
    } else if (raw && typeof raw === 'object' && typeof (raw as { message?: unknown }).message === 'string') {
      message = (raw as { message: string }).message;
    }
  }

  if (status === 409 || (message && /already registered to another account/i.test(message))) {
    return 'This NPI is already connected to a different VitalCV account. If that account is yours, sign in with it — or contact support to resolve ownership.';
  }
  if (status === 401) {
    return 'Your session expired. Sign in again to connect your NPI.';
  }
  if (status === 400 || status === 422) {
    return message ?? 'That NPI could not be processed. Check the number and try again.';
  }
  if (status === 404) {
    return 'No NPPES registry record was found for that NPI. Check the number — new NPIs can take time to appear in the public registry.';
  }
  return 'The registry check could not run right now. This is a system state — not a finding about your NPI. Try again shortly.';
}
