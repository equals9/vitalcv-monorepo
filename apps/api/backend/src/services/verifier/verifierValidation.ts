/**
 * Wave 201 — Verifier Validation Service
 *
 * Validates SD-JWT credentials: signature, nonce, aud, revocation, policy.
 * Exports deterministic AuditScrapbook bundles per validation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { importJWK, jwtVerify } from 'jose';
import {
  DigitalCredentialEnvelopeError,
  normalizeOID4VPPresentationEnvelope,
} from '@vitalcv/haip-config';
import { log } from '../../obs/logger';
import { getKeyByKid } from '../sd-jwt/keyManager';
import { evaluatePolicy } from '../trust-anchors/verification-policies/policyEngine';
import { listAnchors } from '../trust-anchors/anchors/anchorRegistry';

const SCRAPBOOK_DIR = path.resolve(__dirname, '../audit/scrapbook');
const METHODOLOGY_VERSION = '1.0.0';

export type RevocationStatus = 'VALID' | 'REVOKED' | 'UNKNOWN';

export interface ValidationResult {
  valid: boolean;
  credentialId?: string;
  holderDid?: string;
  claims: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  policyPassed: boolean;
  revocationStatus: RevocationStatus;
  validatedAt: string;
}

// Simple in-memory revocation set (populated by Wave 101 revocationRegistry in prod)
const revokedIds = new Set<string>();
export function markRevoked(credentialId: string): void { revokedIds.add(credentialId); }

function base64urlDecode(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf-8');
}

function sha256b64url(input: string): string {
  const { createHash } = require('node:crypto') as typeof import('node:crypto');
  return Buffer.from(createHash('sha256').update(input).digest()).toString('base64url');
}

function writeScrapbookBundle(validationId: string, credentialId: string | undefined, result: ValidationResult): void {
  try {
    if (!fs.existsSync(SCRAPBOOK_DIR)) fs.mkdirSync(SCRAPBOOK_DIR, { recursive: true });
    const ts = result.validatedAt.replace(/[:.]/g, '-');
    const fp = path.join(SCRAPBOOK_DIR, `validation-${credentialId ?? validationId}-${ts}.json`);
    fs.writeFileSync(fp, JSON.stringify({ validationId, credentialId, ...result, methodologyVersion: METHODOLOGY_VERSION }, null, 2));
  } catch { /* non-fatal */ }
}

export async function validateSdJwt(
  compact: string,
  disclosures: string[],
  opts?: { expectedAud?: string; nonce?: string; policy?: string },
): Promise<ValidationResult> {
  const validationId = randomUUID();
  const validatedAt = new Date().toISOString();
  const errors: string[] = [];
  const warnings: string[] = [];
  const claims: Record<string, unknown> = {};
  let credentialId: string | undefined;
  let holderDid: string | undefined;

  try {
    const parts = compact.split('~').filter(Boolean);
    const jwt = parts[0];
    const embedded = parts.slice(1);
    const allDiscs = [...new Set([...embedded, ...disclosures])];

    // Parse header for kid
    const headerStr = jwt.split('.')[0];
    const header = JSON.parse(base64urlDecode(headerStr)) as { kid?: string };

    // Find public key
    const kidEntry = header.kid ? await getKeyByKid(header.kid) : null;
    if (!kidEntry) {
      errors.push(`No signing key found for kid: ${header.kid ?? 'unknown'}`);
      const result: ValidationResult = { valid: false, credentialId, holderDid, claims, errors, warnings, policyPassed: false, revocationStatus: 'UNKNOWN', validatedAt };
      writeScrapbookBundle(validationId, credentialId, result);
      return result;
    }

    const publicKey = await importJWK(kidEntry.publicKeyJwk as unknown as Parameters<typeof importJWK>[0], 'ES256');
    const { payload } = await jwtVerify(jwt, publicKey, {
      audience: opts?.expectedAud,
      clockTolerance: 60,
    });

    credentialId = payload.jti as string | undefined;
    holderDid = payload.sub as string | undefined;

    // Nonce check
    if (opts?.nonce && payload['nonce'] !== opts.nonce) {
      errors.push('Nonce mismatch');
    }

    // Revocation check
    let revocationStatus: RevocationStatus = 'VALID';
    if (credentialId && revokedIds.has(credentialId)) {
      revocationStatus = 'REVOKED';
      errors.push(`Credential ${credentialId} has been revoked`);
    }

    // Visible claims
    for (const [k, v] of Object.entries(payload)) {
      if (!['iss', 'sub', 'iat', 'exp', 'jti', '_sd', '_sd_alg'].includes(k)) {
        claims[k] = v;
      }
    }

    // SD disclosures
    const sdHashes = (payload['_sd'] as string[]) ?? [];
    for (const disc of allDiscs) {
      if (sdHashes.includes(sha256b64url(disc))) {
        try {
          const decoded = JSON.parse(base64urlDecode(disc)) as [string, string, unknown];
          claims[decoded[1]] = decoded[2];
        } catch { /* skip malformed */ }
      }
    }

    // Policy evaluation
    let policyPassed = true;
    if (opts?.policy) {
      const anchors = listAnchors({ status: 'ACTIVE' });
      if (anchors.length > 0) {
        const anchor = anchors[0];
        const policyResult = evaluatePolicy(opts.policy, anchor);
        policyPassed = policyResult.pass;
        warnings.push(...policyResult.warnings);
        if (!policyResult.pass) errors.push(...policyResult.errors);
      } else {
        warnings.push('No active trust anchors found for policy evaluation');
      }
    }

    const result: ValidationResult = { valid: errors.length === 0, credentialId, holderDid, claims, errors, warnings, policyPassed, revocationStatus, validatedAt };
    writeScrapbookBundle(validationId, credentialId, result);
    log('info', 'sd_jwt_validated', { credentialId, valid: result.valid, policyPassed });
    return result;
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Validation failed');
    const result: ValidationResult = { valid: false, credentialId, holderDid, claims, errors, warnings, policyPassed: false, revocationStatus: 'UNKNOWN', validatedAt };
    writeScrapbookBundle(validationId, credentialId, result);
    return result;
  }
}

export async function validatePresentation(presentation: unknown): Promise<ValidationResult> {
  const validatedAt = new Date().toISOString();
  if (typeof presentation !== 'object' || presentation === null || Array.isArray(presentation)) {
    return { valid: false, claims: {}, errors: ['Invalid presentation format'], warnings: [], policyPassed: false, revocationStatus: 'UNKNOWN', validatedAt };
  }

  const record = presentation as Record<string, unknown>;

  // Preserve the pre-existing direct SD-JWT convenience form. This is not an
  // OID4VP / Digital Credentials API envelope and therefore bypasses transport normalization.
  if (typeof record['compact'] === 'string' && record['compact'].length > 0) {
    const disclosures = Array.isArray(record['disclosures'])
      ? record['disclosures'].filter((value): value is string => typeof value === 'string')
      : [];
    return validateSdJwt(record['compact'], disclosures);
  }

  try {
    const normalized = normalizeOID4VPPresentationEnvelope(presentation);
    if (typeof normalized.presentationPayload !== 'string') {
      return {
        valid: false,
        claims: {},
        errors: ['Presentation payload must be a compact SD-JWT string'],
        warnings: [],
        policyPassed: false,
        revocationStatus: 'UNKNOWN',
        validatedAt,
      };
    }

    // `disclosures` is a VitalCV legacy convenience parameter rather than part
    // of the Digital Credentials API envelope. Embedded SD-JWT disclosures are
    // already extracted by validateSdJwt from the compact presentation payload.
    const disclosures = Array.isArray(record['disclosures'])
      ? record['disclosures'].filter((value): value is string => typeof value === 'string')
      : [];
    return validateSdJwt(normalized.presentationPayload, disclosures);
  } catch (error) {
    const message = error instanceof DigitalCredentialEnvelopeError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Invalid presentation format';
    return {
      valid: false,
      claims: {},
      errors: [message],
      warnings: [],
      policyPassed: false,
      revocationStatus: 'UNKNOWN',
      validatedAt,
    };
  }
}
