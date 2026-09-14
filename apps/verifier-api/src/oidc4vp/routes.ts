import { Request, Response, Router } from 'express';
import { decodeProtectedHeader, importJWK, jwtVerify } from 'jose';
import {
  DigitalCredentialEnvelopeError,
  haipConfig,
  normalizeOID4VPPresentationEnvelope,
} from '@vitalcv/haip-config';
import {
  assertCanonicalPathValid,
  CanonicalPathViolation,
  type EmploymentVerificationPath,
} from '@vitalcv/domain-common';
import { policyEnforcer } from '../policyEnforcer';
import { consumeNonce, issueNonce } from '../security/nonceTable';

const router: Router = Router();

router.get('/.well-known/openid-configuration', (_req: Request, res: Response) => {
  res.json({
    issuer: process.env.VERIFIER_ISSUER || 'https://verifier.vitalcv.ai/oidc4vp',
    authorization_response_iss_parameter_supported: true,
    request_object_signing_alg_values_supported: [...haipConfig.allowedAlgorithms],
    dpop_signing_alg_values_supported: [...haipConfig.allowedAlgorithms],
    vp_formats_supported: {
      jwt_vp_json: {
        alg: [...haipConfig.allowedAlgorithms],
      },
    },
    require_pushed_authorization_requests: haipConfig.par.required,
    code_challenge_methods_supported: [...haipConfig.pkce.allowedMethods],
    clock_skew_seconds: haipConfig.dpop.maxClockSkewSeconds,
  });
});

/**
 * Nonce issuance endpoint.
 * GET /oidc4vp/nonce
 */
router.get('/nonce', async (_req: Request, res: Response) => {
  const { nonce, expiresInSeconds } = await issueNonce();
  res.json({ nonce, expires_in_seconds: expiresInSeconds });
});

/**
 * Canonical path enforcement endpoint.
 * POST /oidc4vp/presentation
 */
router.post('/presentation', policyEnforcer, async (req: Request, res: Response) => {
  let normalized;
  try {
    normalized = normalizeOID4VPPresentationEnvelope(req.body ?? {});
  } catch (error) {
    if (error instanceof DigitalCredentialEnvelopeError) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: error.message,
        code: error.code,
      });
    }
    return res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Envelope normalization failed.',
    });
  }

  const canonicalPath = normalized.canonicalPath;
  const bodyNonce = normalized.nonce;

  // Nonce validation (single-use, ≤5min TTL)
  const nonceHeader = typeof req.headers['x-nonce'] === 'string' ? req.headers['x-nonce'].trim() : '';
  const nonce = (typeof bodyNonce === 'string' ? bodyNonce.trim() : '') || nonceHeader;

  if (!nonce) {
    return res.status(400).json({
      error: 'invalid_nonce',
      error_description: 'nonce is required for VP submissions.',
    });
  }

  const nonceResult = await consumeNonce(nonce);
  if (nonceResult !== 'accepted') {
    const desc = nonceResult === 'replay' ? 'nonce replay detected.' :
                 nonceResult === 'expired' ? 'nonce expired.' : 'nonce is invalid.';
    return res.status(401).json({
      error: 'invalid_nonce',
      error_description: desc,
    });
  }

  if (!canonicalPath || typeof canonicalPath !== 'object') {
    return res.status(400).json({
      error: 'canonical_path_required',
      error_description: 'canonicalPath is required (Recognition → Acceptance → Start).',
    });
  }

  try {
    // The canonical guard is the runtime authority. The transport normalizer
    // deliberately returns `unknown` so it cannot smuggle a domain type across
    // the protocol boundary without this validation step.
    assertCanonicalPathValid(canonicalPath as EmploymentVerificationPath);
  } catch (error) {
    const message =
      error instanceof CanonicalPathViolation ? error.message : 'Canonical path validation failed.';
    return res.status(400).json({
      error: 'canonical_path_violation',
      error_description: message,
    });
  }

  const vpToken = normalized.presentationPayload;
  if (typeof vpToken !== 'string') {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'VP presentation payload must be a compact JWT string.',
    });
  }

  // VP token cryptographic validation
  try {
    const header = decodeProtectedHeader(vpToken);
    if (!(haipConfig.allowedAlgorithms as readonly string[]).includes(header.alg ?? '')) {
      return res.status(400).json({
        error: 'invalid_vp_token',
        error_description: `VP token algorithm '${header.alg}' not allowed. Use: ${haipConfig.allowedAlgorithms.join(', ')}`,
      });
    }

    if (!header.jwk) {
      return res.status(400).json({
        error: 'invalid_vp_token',
        error_description: 'VP token must include JWK in header for verification.',
      });
    }

    const publicKey = await importJWK(header.jwk as Parameters<typeof importJWK>[0], header.alg);
    const { payload } = await jwtVerify(vpToken, publicKey, {
      algorithms: [...haipConfig.allowedAlgorithms],
    });

    const expectedAud = process.env.VERIFIER_AUDIENCE || 'https://verifier.vitalcv.ai';
    if (payload.aud !== expectedAud) {
      return res.status(400).json({
        error: 'invalid_vp_token',
        error_description: 'VP token audience mismatch.',
      });
    }

    return res.json({
      verified: true,
      timestamp: new Date().toISOString(),
      issuer: payload.iss,
    });
  } catch (error) {
    return res.status(400).json({
      error: 'invalid_vp_token',
      error_description: error instanceof Error ? error.message : 'VP token verification failed.',
    });
  }
});

export default router;
