/**
 * presentationServer.ts — Wave 110: OpenID4VP Presentation Server
 *
 * Implements OpenID for Verifiable Presentations (OID4VP) draft spec.
 * Allows verifiers to request presentations from holders and validate responses.
 *
 * Spec: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html
 */

import { randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';
import { verifyCredential } from '../credentials/credentialVerifier';
import type { VerifiableCredential } from '../credentials/credentialModel';

// ── Types ─────────────────────────────────────────────────────────────

export type PresentationRequestStatus =
  | 'PENDING'
  | 'FULFILLED'
  | 'REJECTED'
  | 'EXPIRED';

export interface InputDescriptor {
  id: string;
  name: string;
  purpose?: string;
  constraints: {
    fields: Array<{
      path: string[];       // JSONPath selectors
      filter?: {
        type: string;
        pattern?: string;
        const?: unknown;
        enum?: unknown[];
      };
    }>;
  };
}

export interface PresentationDefinition {
  id: string;
  name?: string;
  purpose?: string;
  input_descriptors: InputDescriptor[];
}

export interface PresentationRequest {
  requestId: string;
  /** Verifier's client ID / DID */
  client_id: string;
  /** Nonce for replay protection */
  nonce: string;
  /** ISO-8601 expiry */
  expiresAt: string;
  status: PresentationRequestStatus;
  presentation_definition: PresentationDefinition;
  response_uri: string;
  createdAt: string;
  fulfilledAt?: string;
}

export interface VerifiablePresentation {
  '@context': string[];
  type: string[];
  id: string;
  holder: string;
  verifiableCredential: VerifiableCredential[];
  proof?: {
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    jws?: string;
  };
}

/**
 * Protocol-neutral presentation input.
 *
 * OID4VP / Digital Credentials API wire names are normalized at the HTTP
 * boundary before this service is called. The payload remains `unknown` until
 * this verifier validates the presentation format it actually supports.
 */
export interface PresentationResponseInput {
  presentationSubmission: {
    id: string;
    definition_id: string;
    descriptor_map: Array<{
      id: string;
      format: string;
      path: string;
    }>;
  };
  presentationPayload: unknown;
  state?: string;
}

export interface PresentationVerificationResult {
  requestId: string;
  valid: boolean;
  holder: string;
  credentialResults: Array<{
    credentialId: string;
    valid: boolean;
    errors: string[];
  }>;
  errors: string[];
  verifiedAt: string;
}

// ── In-memory store ───────────────────────────────────────────────────

const requests = new Map<string, PresentationRequest>();
const results = new Map<string, PresentationVerificationResult>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate the legacy JSON Verifiable Presentation payload supported by this
 * presentation server.
 *
 * The Digital Credentials API normalizer is intentionally format-agnostic: an
 * OpenID4VP 1.0 response may carry another representation (for example a DCQL
 * result object containing SD-JWT presentations). This server must therefore
 * fail closed instead of treating every object-valued payload as the legacy VP
 * model it understands.
 */
export function parseVerifiablePresentationPayload(payload: unknown): VerifiablePresentation {
  let parsed: unknown = payload;

  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload) as unknown;
    } catch {
      throw new Error('presentation payload is not valid JSON');
    }
  }

  if (!isRecord(parsed)) {
    throw new Error('presentation payload must be a VerifiablePresentation object');
  }

  if (!Array.isArray(parsed.type) || !parsed.type.includes('VerifiablePresentation')) {
    throw new Error('presentation payload type must include VerifiablePresentation');
  }

  if (typeof parsed.holder !== 'string' || parsed.holder.trim().length === 0) {
    throw new Error('presentation payload holder is required');
  }

  if (!Array.isArray(parsed.verifiableCredential) || parsed.verifiableCredential.length === 0) {
    throw new Error('presentation payload must contain at least one verifiableCredential');
  }

  if (parsed.verifiableCredential.some((credential) => !isRecord(credential))) {
    throw new Error('presentation payload contains an invalid verifiableCredential');
  }

  return parsed as unknown as VerifiablePresentation;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Create a new presentation request.
 */
export function createPresentationRequest(
  verifierDid: string,
  definition: Omit<PresentationDefinition, 'id'>,
  ttlSeconds = 600,
): PresentationRequest {
  const requestId = randomUUID();
  const nonce = randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const baseUrl = process.env.ISSUER_BASE_URL ?? 'https://api.vitalcv.com';

  const request: PresentationRequest = {
    requestId,
    client_id: verifierDid,
    nonce,
    expiresAt,
    status: 'PENDING',
    presentation_definition: {
      ...definition,
      id: randomUUID(),
    },
    response_uri: `${baseUrl}/api/oid4vp/response/${requestId}`,
    createdAt: new Date().toISOString(),
  };

  requests.set(requestId, request);

  log('info', 'oid4vp_request_created', {
    requestId,
    verifierDid,
    descriptors: definition.input_descriptors.length,
    expiresAt,
  });

  return request;
}

/**
 * Retrieve a presentation request by ID.
 */
export function getPresentationRequest(requestId: string): PresentationRequest | null {
  return requests.get(requestId) ?? null;
}

/**
 * Verify a presentation response against its originating request.
 */
export async function verifyPresentationResponse(
  requestId: string,
  response: PresentationResponseInput,
): Promise<PresentationVerificationResult> {
  const req = requests.get(requestId);
  if (!req) throw new Error(`Presentation request ${requestId} not found`);
  if (req.status !== 'PENDING') throw new Error(`Request ${requestId} is already ${req.status}`);
  if (new Date(req.expiresAt) < new Date()) {
    req.status = 'EXPIRED';
    throw new Error(`Presentation request ${requestId} has expired`);
  }

  const vp = parseVerifiablePresentationPayload(response.presentationPayload);

  const credentialResults: PresentationVerificationResult['credentialResults'] = [];
  const errors: string[] = [];

  // Verify each credential in the presentation
  for (const cred of vp.verifiableCredential) {
    try {
      const result = await verifyCredential(cred);
      credentialResults.push({
        credentialId: cred.credentialId,
        valid: result.valid,
        errors: result.errors,
      });
      if (!result.valid) {
        errors.push(...result.errors.map((e) => `[${cred.credentialId}] ${e}`));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      credentialResults.push({
        credentialId: cred.credentialId ?? 'unknown',
        valid: false,
        errors: [msg],
      });
      errors.push(`[${cred.credentialId ?? 'unknown'}] ${msg}`);
    }
  }

  // Check the normalized presentation submission maps to the right definition.
  const sub = response.presentationSubmission;
  if (sub.definition_id !== req.presentation_definition.id) {
    errors.push(
      `presentation submission definition_id mismatch: got ${sub.definition_id}, expected ${req.presentation_definition.id}`,
    );
  }

  const valid = errors.length === 0;
  req.status = valid ? 'FULFILLED' : 'REJECTED';
  req.fulfilledAt = new Date().toISOString();

  const verificationResult: PresentationVerificationResult = {
    requestId,
    valid,
    holder: vp.holder,
    credentialResults,
    errors,
    verifiedAt: new Date().toISOString(),
  };

  results.set(requestId, verificationResult);

  log('info', 'oid4vp_response_verified', {
    requestId,
    valid,
    credentialCount: credentialResults.length,
  });

  return verificationResult;
}

/**
 * Get a prior verification result by request ID.
 */
export function getPresentationResult(requestId: string): PresentationVerificationResult | null {
  return results.get(requestId) ?? null;
}

/**
 * List all requests — optionally filtered by status.
 */
export function listPresentationRequests(
  status?: PresentationRequestStatus,
): PresentationRequest[] {
  const all = Array.from(requests.values());
  return status ? all.filter((r) => r.status === status) : all;
}

/**
 * Build a sample presentation definition for medical license + board cert.
 */
export function buildMedicalCredentialDefinition(): Omit<PresentationDefinition, 'id'> {
  return {
    name: 'Medical Credential Verification',
    purpose: 'Verify clinician credentials for privileging',
    input_descriptors: [
      {
        id: 'medical_license',
        name: 'Medical License',
        purpose: 'Valid state medical license required',
        constraints: {
          fields: [
            {
              path: ['$.claims.licenseType', '$.type'],
              filter: { type: 'string', pattern: 'medical_license|MedicalLicense' },
            },
          ],
        },
      },
      {
        id: 'npi',
        name: 'NPI Registration',
        purpose: 'Active NPI number required',
        constraints: {
          fields: [
            {
              path: ['$.claims.npi'],
              filter: { type: 'string', pattern: '^\\d{10}$' },
            },
          ],
        },
      },
    ],
  };
}
