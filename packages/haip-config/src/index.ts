/**
 * @vitalcv/haip-config
 *
 * Central HAIP 1.0 enforcement configuration.
 *
 * This module provides a single, immutable configuration object that all
 * VitalCV services (authz, verifier-api, issuer) use to enforce HAIP
 * constraints. Environment variables override defaults but cannot weaken
 * the HAIP-mandated minimums (e.g., you cannot remove ES256 from the
 * algorithm whitelist when enforce=true).
 */

export type {
  HaipConfig,
  HaipAlgorithm,
  HaipCurve,
  TokenBindingMethod,
  DpopConfig,
  PkceConfig,
  PkceMethod,
  ParConfig,
  NonceConfig,
  CredentialFormat,
  VpFormat,
} from './types';

export {
  DigitalCredentialEnvelopeError,
  normalizeOID4VPPresentationEnvelope,
  OID4VP_DIGITAL_CREDENTIAL_PROTOCOLS,
} from './oid4vp/digitalCredentialEnvelope';
export type {
  DigitalCredentialEnvelopeErrorCode,
  NormalizedOID4VPPresentationInput,
  OID4VPDigitalCredentialProtocol,
} from './oid4vp/digitalCredentialEnvelope';

import type {
  HaipConfig,
  HaipAlgorithm,
} from './types';

// ── HAIP 1.0 Mandated Minimums ─────────────────────────────
// These values cannot be weakened by environment variables.

const HAIP_MANDATED_ALGORITHMS: readonly HaipAlgorithm[] = Object.freeze(['ES256']);

// ── Environment Readers ─────────────────────────────────────

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envString(key: string, fallback: string): string {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return raw.trim();
}

// ── Configuration Builder ───────────────────────────────────

/**
 * Build the HAIP configuration from environment variables.
 *
 * When `HAIP_ENFORCE=true` (the default), all HAIP-mandated constraints
 * are locked to their strictest values:
 * - Algorithm whitelist: ES256 only (cannot be expanded)
 * - DPoP: required for wallets
 * - PKCE: required, S256 only
 * - PAR: required for all requests
 *
 * When `HAIP_ENFORCE=false` (development mode), constraints can be
 * relaxed via environment variables, but the algorithm whitelist
 * remains locked (you can never allow RS256, PS256, etc.).
 */
function buildConfig(): HaipConfig {
  const enforce = envBool('HAIP_ENFORCE', true);

  return Object.freeze({
    profileVersion: '1.0',
    enforce,

    // Algorithm whitelist — ALWAYS locked to HAIP mandates
    allowedAlgorithms: HAIP_MANDATED_ALGORITHMS,
    allowedCurves: Object.freeze(['P-256'] as const),

    dpop: Object.freeze({
      required: enforce ? true : envBool('DPOP_REQUIRED', true),
      maxClockSkewSeconds: envInt('DPOP_MAX_CLOCK_SKEW_SECONDS', 60),
      jtiReplayTtlMs: envInt('DPOP_JTI_REPLAY_TTL_MS', 300_000),
      requireKid: true,
      allowedAlgorithms: HAIP_MANDATED_ALGORITHMS,
      maxProofLifetimeSeconds: envInt('DPOP_MAX_PROOF_LIFETIME_SECONDS', 300),
    }),

    pkce: Object.freeze({
      required: enforce ? true : envBool('PKCE_REQUIRED', true),
      allowedMethods: Object.freeze(['S256'] as const),
    }),

    par: Object.freeze({
      required: enforce ? true : envBool('PAR_REQUIRED', true),
      requestUriLifetimeSeconds: envInt('PAR_REQUEST_URI_LIFETIME_SECONDS', 60),
      highRiskScopes: Object.freeze([
        'credential:issue',
        'credential:issue:*',
        'credential:batch',
        'credential:deferred',
      ]),
    }),

    nonce: Object.freeze({
      cNonceLifetimeSeconds: envInt('C_NONCE_LIFETIME_SECONDS', 300),
      nonceLengthBytes: envInt('C_NONCE_LENGTH_BYTES', 32),
    }),

    credentialFormats: Object.freeze(['jwt_vc_json', 'vc+sd-jwt'] as const),
    vpFormats: Object.freeze(['jwt_vp_json'] as const),

    tokenBindingMethods: Object.freeze(['dpop', 'mtls'] as const),

    issuerDid: envString('ISSUER_DID', 'did:web:vitalcv.ai'),
    tokenIssuer: envString('TOKEN_ISSUER', 'https://authz.vitalcv.ai'),
    tokenAudience: envString('TOKEN_AUDIENCE', 'https://api.vitalcv.ai'),
  });
}

// ── Singleton ───────────────────────────────────────────────

/**
 * The global HAIP configuration singleton.
 *
 * Frozen and immutable after construction. All services import this
 * directly:
 *
 * ```ts
 * import { haipConfig } from '@vitalcv/haip-config';
 *
 * if (haipConfig.pkce.required) {
 *   // enforce PKCE S256
 * }
 * ```
 */
export const haipConfig: HaipConfig = buildConfig();

// ── Assertion Helpers ───────────────────────────────────────

/**
 * Assert that a JOSE algorithm is allowed under the current HAIP config.
 * Throws if the algorithm is not in the whitelist.
 *
 * @example
 * ```ts
 * assertAlgorithmAllowed('ES256');   // ok
 * assertAlgorithmAllowed('RS256');   // throws HaipViolationError
 * ```
 */
export function assertAlgorithmAllowed(alg: string): asserts alg is HaipAlgorithm {
  if (!(haipConfig.allowedAlgorithms as readonly string[]).includes(alg)) {
    throw new HaipViolationError(
      `Algorithm '${alg}' is not allowed. Permitted: ${haipConfig.allowedAlgorithms.join(', ')}`,
      'INVALID_ALGORITHM',
    );
  }
}

/**
 * Assert that PKCE is present when required.
 * Validates that code_challenge_method is S256.
 */
export function assertPkceValid(params: {
  codeChallenge?: string | null;
  codeChallengeMethod?: string | null;
}): void {
  if (!haipConfig.pkce.required) return;

  if (!params.codeChallenge || !params.codeChallengeMethod) {
    throw new HaipViolationError(
      'PKCE is required. Provide code_challenge and code_challenge_method=S256.',
      'PKCE_REQUIRED',
    );
  }

  const allowedMethods: readonly string[] = haipConfig.pkce.allowedMethods;
  if (!allowedMethods.includes(params.codeChallengeMethod)) {
    throw new HaipViolationError(
      `code_challenge_method '${params.codeChallengeMethod}' is not allowed. Use: ${haipConfig.pkce.allowedMethods.join(', ')}`,
      'PKCE_INVALID_METHOD',
    );
  }
}

/**
 * Assert that PAR was used when required.
 */
export function assertParRequired(params: {
  requestUri?: string | null;
  scope?: string;
}): void {
  // Always require PAR for high-risk scopes
  const scopes = params.scope?.split(' ') ?? [];
  const hasHighRiskScope = scopes.some((s) =>
    haipConfig.par.highRiskScopes.some(
      (hrs) => hrs === s || (hrs.endsWith('*') && s.startsWith(hrs.slice(0, -1))),
    ),
  );

  if (hasHighRiskScope && !params.requestUri) {
    throw new HaipViolationError(
      'PAR (request_uri) is required for high-risk scopes.',
      'PAR_REQUIRED_HIGH_RISK',
    );
  }

  // Global PAR enforcement
  if (haipConfig.par.required && !params.requestUri) {
    throw new HaipViolationError(
      'PAR is required for all authorization requests under HAIP.',
      'PAR_REQUIRED',
    );
  }
}

/**
 * Assert that DPoP is present for wallet clients.
 */
export function assertDpopRequired(params: {
  dpopHeader?: string | null;
  clientType?: string;
}): void {
  if (!haipConfig.dpop.required) return;

  const isWallet = !params.clientType || params.clientType === 'wallet';

  if (isWallet && !params.dpopHeader) {
    throw new HaipViolationError(
      'DPoP proof is required for wallet clients under HAIP.',
      'DPOP_REQUIRED',
    );
  }
}

/**
 * Assert that a DPoP proof's exp claim does not exceed the maximum lifetime.
 * SPECIFICATION §2: exp ≤ 5 minutes from iat.
 */
export function assertDpopExpValid(params: {
  exp?: number | null;
  iat?: number | null;
}): void {
  const maxLifetime = haipConfig.dpop.maxProofLifetimeSeconds;
  if (params.exp != null && params.iat != null) {
    if (params.exp - params.iat > maxLifetime) {
      throw new HaipViolationError(
        `DPoP exp exceeds max proof lifetime (${maxLifetime}s).`,
        'DPOP_EXP_TOO_LONG',
      );
    }
  }
}

// ── Error Type ──────────────────────────────────────────────

export type HaipViolationCode =
  | 'INVALID_ALGORITHM'
  | 'PKCE_REQUIRED'
  | 'PKCE_INVALID_METHOD'
  | 'PAR_REQUIRED'
  | 'PAR_REQUIRED_HIGH_RISK'
  | 'DPOP_REQUIRED'
  | 'DPOP_EXP_TOO_LONG';

export class HaipViolationError extends Error {
  readonly code: HaipViolationCode;

  constructor(message: string, code: HaipViolationCode) {
    super(message);
    this.name = 'HaipViolationError';
    this.code = code;
    Object.setPrototypeOf(this, HaipViolationError.prototype);
  }
}
