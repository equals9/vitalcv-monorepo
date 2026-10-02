/**
 * credentials.ts — Wave 94 + 98 + 103 + Substrate Phase 5: Trust Credential API Routes
 *
 * Legacy routes remain intact while Wave 124 adds SDK-compatible aliases and
 * flattened response envelopes.
 */

import type { Express, Request, Response } from 'express';
import { decodeJwt } from 'jose';
import { generateIssuanceReceipt, generatePresentationReceipt, generateVerificationReceipt } from '../services/audit/receiptGenerator';
import { appendAuditEvent, auditIssuance, auditPresentation, newTraceId } from '../services/audit/auditLedger';
import {
  enforceHAIPIssuance,
  enforceHAIPVerification,
  enforceSDJWTStructure,
} from '../services/compliance/haipEnforcer';
import { upsertVerificationArtifactFromCredential } from '../services/credentials/credentialArtifactBridge';
import { issueCredential } from '../services/credentials/credentialIssuer';
import type {
  IssueCredentialRequest,
  VerifiableCredential,
  VerificationResult,
} from '../services/credentials/credentialModel';
import {
  createPresentation,
  getPresentation,
  getPresentationsForHolder,
  type VerifiablePresentation,
} from '../services/credentials/credentialPresentation';
import { verifyCredential } from '../services/credentials/credentialVerifier';
import {
  getCredential,
  getCredentialsForSubject,
  getWalletSummary,
  listCredentials,
  removeCredential,
  storeCredential,
} from '../services/credentials/credentialWallet';
import {
  generateSelectiveDisclosure,
  listCredentialFields,
} from '../services/credentials/selectiveDisclosure';
import { getRequestOrganizationId } from '../middleware/organizationContext';
import { log } from '../obs/logger';
import { getIssuer } from '../services/registry/trustRegistry';
import { computeSubstrateTrustState } from '../services/trust/trustSubstrate';
import { acceptCredentialPresentation } from '../services/verifier/credentialAcceptance';
import {
  confirmCredential,
  ingestCredential,
  listCredentials as listCandidateCredentials,
} from '../services/documents/credentialIngestion';
import { getExtraction } from '../services/documents/documentStore';

type RecordValue = Record<string, unknown>;

function getSigningKey(): string {
  return process.env.CREDENTIAL_SIGNING_KEY_PEM ?? '';
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withCredentialTypeClaims(
  claims: RecordValue,
  credentialType: string,
  subject: string,
): RecordValue {
  const existingTypes = Array.isArray(claims.type)
    ? claims.type.filter((value): value is string => typeof value === 'string')
    : [];

  return {
    ...claims,
    npi: typeof claims.npi === 'string' ? claims.npi : subject,
    credentialType,
    type: existingTypes.length > 0
      ? Array.from(new Set(['VerifiableCredential', ...existingTypes, credentialType]))
      : ['VerifiableCredential', credentialType],
  };
}

function deriveCredentialType(claims: RecordValue): string {
  const explicitType = claims.credentialType;
  if (typeof explicitType === 'string' && explicitType.trim().length > 0) {
    return explicitType.trim();
  }

  const claimTypes = claims.type;
  if (Array.isArray(claimTypes)) {
    const resolved = claimTypes
      .filter((value): value is string => typeof value === 'string' && value !== 'VerifiableCredential')
      .at(0);
    if (resolved) {
      return resolved;
    }
  }

  return 'VerifiableCredential';
}

function normalizeWalletStatus(status: VerifiableCredential['status']): 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED' {
  return status === 'ACTIVE' ? 'VALID' : status;
}

function mapWalletCredential(
  credential: VerifiableCredential,
  opts?: {
    daysUntilExpiry?: number | null;
    expiryWarning?: 'none' | 'warning' | 'critical' | 'expired';
  },
): {
  credentialId: string;
  credentialType: string;
  issuer: string;
  issuerId: string;
  status: 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';
  issuedAt: string;
  expiresAt?: string;
  daysUntilExpiry?: number;
  expiryWarning?: boolean;
  haipCompliant: boolean;
  claims: RecordValue;
  vcJwt: string;
} {
  const issuer = getIssuer(credential.issuer);

  return {
    credentialId: credential.credentialId,
    credentialType: deriveCredentialType(credential.claims),
    issuer: credential.issuer,
    issuerId: credential.issuer,
    status: normalizeWalletStatus(credential.status),
    issuedAt: credential.issuedAt,
    expiresAt: credential.expiresAt,
    ...(typeof opts?.daysUntilExpiry === 'number' ? { daysUntilExpiry: opts.daysUntilExpiry } : {}),
    ...(opts?.expiryWarning && opts.expiryWarning !== 'none'
      ? { expiryWarning: true }
      : {}),
    haipCompliant: issuer?.haipCompliant ?? false,
    claims: credential.claims,
    vcJwt: credential.signature,
  };
}

function normalizeIssueRequest(body: unknown):
  | {
      issuer: string;
      subject: string;
      claims: RecordValue;
      expiresAt?: string;
      credentialType: string;
    }
  | { error: string } {
  if (!isRecord(body)) {
    return { error: 'request body is required' };
  }

  if (
    typeof body.issuer === 'string' &&
    typeof body.subject === 'string' &&
    isRecord(body.claims)
  ) {
    return {
      issuer: body.issuer,
      subject: body.subject,
      claims: body.claims,
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : undefined,
      credentialType: deriveCredentialType(body.claims),
    };
  }

  if (
    typeof body.issuerId === 'string' &&
    typeof body.npi === 'string' &&
    typeof body.credentialType === 'string' &&
    isRecord(body.claims)
  ) {
    return {
      issuer: body.issuerId,
      subject: body.npi,
      claims: withCredentialTypeClaims(body.claims, body.credentialType, body.npi),
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : undefined,
      credentialType: body.credentialType,
    };
  }

  return { error: 'Provide either { issuer, subject, claims } or { issuerId, npi, credentialType, claims }' };
}

async function safeGenerateIssuanceReceipt(credential: VerifiableCredential) {
  try {
    return await generateIssuanceReceipt(credential);
  } catch (error) {
    log('warn', 'credential_issue_receipt_failed', {
      credentialId: credential.credentialId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

async function safeGeneratePresentationReceipt(opts: Parameters<typeof generatePresentationReceipt>[0]) {
  try {
    return await generatePresentationReceipt(opts);
  } catch (error) {
    log('warn', 'credential_presentation_receipt_failed', {
      presentationId: opts.presentationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

async function safeGenerateVerificationReceipt(opts: Parameters<typeof generateVerificationReceipt>[0]) {
  try {
    return await generateVerificationReceipt(opts);
  } catch (error) {
    log('warn', 'credential_verification_receipt_failed', {
      credentialId: opts.credentialId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

function buildIssueResponse(
  credential: VerifiableCredential,
  opts: {
    haipCompliant: boolean;
    traceId: string;
    receiptId: string | null;
    receiptHash: string;
    haipAuditEventId?: string;
  },
) {
  return {
    credential,
    haipAuditEventId: opts.haipAuditEventId,
    receiptId: opts.receiptId,
    receiptHash: opts.receiptHash,
    traceId: opts.traceId,
    credentialId: credential.credentialId,
    npi: credential.subject,
    issuer: credential.issuer,
    issuerId: credential.issuer,
    credentialType: deriveCredentialType(credential.claims),
    vcJwt: credential.signature,
    claims: credential.claims,
    issuedAt: credential.issuedAt,
    expiresAt: credential.expiresAt,
    haipCompliant: opts.haipCompliant,
  };
}

function buildPresentationResponse(
  presentation: VerifiablePresentation,
  subject: string,
  opts: {
    traceId: string;
    receiptId: string | null;
    receiptHash: string;
  },
) {
  const fallbackExpiry = new Date(Date.parse(presentation.createdAt) + 60 * 60 * 1000).toISOString();

  return {
    presentation,
    receiptId: opts.receiptId,
    receiptHash: opts.receiptHash,
    traceId: opts.traceId,
    presentationId: presentation.presentationId,
    vpJwt: presentation.signature,
    credentials: presentation.credentials.map((credential) => ({
      credentialId: credential.credentialId,
      type: deriveCredentialType(credential.claims),
    })),
    subject,
    createdAt: presentation.createdAt,
    expiresAt: presentation.expiresAt ?? fallbackExpiry,
  };
}

function buildVerificationChecks(result: VerificationResult) {
  return {
    signature: result.checks.signature,
    issuerTrusted: result.checks.issuerTrusted,
    statusActive: result.checks.statusActive,
    notExpired: result.checks.notExpired,
  };
}

export function registerCredentialRoutes(app: Express): void {
  // ── POST /api/credentials/issue ─────────────────────────────────────
  app.post('/api/credentials/issue', async (req: Request, res: Response) => {
    try {
      const normalized = normalizeIssueRequest(req.body);
      if ('error' in normalized) {
        res.status(400).json({ error: normalized.error });
        return;
      }

      const signingKey = getSigningKey();
      if (!signingKey) {
        res.status(503).json({
          error: 'Credential signing key not configured',
          hint: 'Set CREDENTIAL_SIGNING_KEY_PEM environment variable',
        });
        return;
      }

      const haipResult = enforceHAIPIssuance({
        issuerId: normalized.issuer,
        subject: normalized.subject,
        format: req.body?.format ?? 'jwt_vc_json',
        algorithm: req.body?.algorithm ?? 'ES256',
      });
      if (!haipResult.allowed) {
        res.status(422).json({
          error: 'HAIP issuance policy violation',
          violations: haipResult.violations,
          auditEventId: haipResult.auditEventId,
          traceId: haipResult.traceId,
        });
        return;
      }

      const request: IssueCredentialRequest = {
        issuer: normalized.issuer,
        subject: normalized.subject,
        claims: normalized.claims,
        expiresAt: normalized.expiresAt,
      };
      const credential = await issueCredential(request, signingKey);
      storeCredential(credential);

      await upsertVerificationArtifactFromCredential(credential, {
        organizationId: getRequestOrganizationId(req),
        source: credential.issuer,
      });

      const traceId = newTraceId();
      const auditEntry = auditIssuance({
        traceId,
        actor: credential.issuer,
        credentialId: credential.credentialId,
        subject: credential.subject,
        issuer: credential.issuer,
        success: true,
      });
      const receipt = await safeGenerateIssuanceReceipt(credential);

      res.status(201).json(buildIssueResponse(credential, {
        haipCompliant: haipResult.allowed,
        traceId,
        receiptId: receipt?.receiptId ?? null,
        receiptHash: receipt?.hash ?? auditEntry.receiptHash,
        haipAuditEventId: haipResult.auditEventId,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'credential_issue_failed', { error: msg });
      res.status(500).json({ error: 'Failed to issue credential', detail: msg });
    }
  });

  // ── POST /api/credentials/verify ───────────────────────────────────
  app.post('/api/credentials/verify', async (req: Request, res: Response) => {
    try {
      const { credential } = req.body ?? {};

      if (!credential || typeof credential !== 'object') {
        res.status(400).json({ error: 'credential object is required in request body' });
        return;
      }

      const [result, haipCheck] = await Promise.all([
        verifyCredential(credential as VerifiableCredential),
        Promise.resolve(enforceHAIPVerification(credential)),
      ]);

      res.status(200).json({
        result,
        haipCompliance: {
          compliant: haipCheck.allowed,
          violations: haipCheck.violations,
          auditEventId: haipCheck.auditEventId,
          traceId: haipCheck.traceId,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'credential_verify_failed', { error: msg });
      res.status(500).json({ error: 'Verification failed', detail: msg });
    }
  });

  // ── POST /api/credentials/verify/presentation ──────────────────────
  app.post('/api/credentials/verify/presentation', async (req: Request, res: Response) => {
    try {
      const { vpJwt, expectedNpi } = req.body ?? {};

      if (!vpJwt || typeof vpJwt !== 'string') {
        res.status(400).json({ error: 'vpJwt is required' });
        return;
      }

      const payload = decodeJwt(vpJwt);
      const presentationId = typeof payload.jti === 'string'
        ? payload.jti
        : typeof payload.presentationId === 'string'
          ? payload.presentationId
          : '';

      if (!presentationId) {
        res.status(422).json({ error: 'Presentation JWT missing jti/presentationId' });
        return;
      }

      const presentation = getPresentation(presentationId);
      if (!presentation) {
        res.status(404).json({ error: `Presentation ${presentationId} not found` });
        return;
      }

      const credentialResults = await Promise.all(
        presentation.credentials.map(async (credential) => {
          const result = await verifyCredential(credential);
          return {
            credentialId: credential.credentialId,
            issuer: credential.issuer,
            valid: result.valid,
            revoked: !result.checks.statusActive && result.errors.some((error) => error.includes('revoked')),
            errors: result.errors,
            raw: result,
            subject: credential.subject,
          };
        }),
      );

      const errors = credentialResults.flatMap((result) => result.errors);
      if (typeof expectedNpi === 'string' && expectedNpi.trim().length > 0) {
        const subjectMismatch = credentialResults.some((result) => result.subject !== expectedNpi);
        if (subjectMismatch) {
          errors.push(`Presentation subject does not match expected NPI ${expectedNpi}`);
        }
      }

      const valid = errors.length === 0 && credentialResults.every((result) => result.valid);
      const verifiedAt = new Date().toISOString();
      const traceId = newTraceId();
      const subject = presentation.credentials[0]?.subject ?? presentation.holder;
      const receipts = (
        await Promise.all(
          presentation.credentials.map((credential, index) =>
            safeGenerateVerificationReceipt({
              credentialId: credential.credentialId,
              verifier: typeof req.body?.verifierDid === 'string'
                ? req.body.verifierDid
                : 'did:vitalcv:verifier:sdk',
              subject: credential.subject,
              valid: credentialResults[index]?.valid ?? false,
              checks: buildVerificationChecks(credentialResults[index]?.raw ?? {
                checks: {
                  signature: false,
                  issuerTrusted: false,
                  statusActive: false,
                  notExpired: false,
                },
              } as VerificationResult),
              haipCompliant: credentialResults[index]?.raw.haip?.compliant ?? false,
              errors: credentialResults[index]?.errors ?? ['Credential verification failed'],
            }),
          ),
        )
      ).filter((receipt): receipt is NonNullable<typeof receipt> => receipt !== null);

      const auditEntry = appendAuditEvent({
        traceId,
        category: 'VERIFICATION',
        actor: typeof req.body?.verifierDid === 'string'
          ? req.body.verifierDid
          : 'did:vitalcv:verifier:sdk',
        resource: presentationId,
        severity: valid ? 'INFO' : 'WARNING',
        requestFields: { expectedNpi: typeof expectedNpi === 'string' ? expectedNpi : undefined },
        resultFields: {
          valid,
          subject,
          credentialIds: presentation.credentials.map((credential) => credential.credentialId),
          errorCount: errors.length,
        },
      });

      res.status(200).json({
        valid,
        presentationId,
        subject,
        credentials: credentialResults.map((result) => ({
          credentialId: result.credentialId,
          issuer: result.issuer,
          valid: result.valid,
          revoked: result.revoked,
          errors: result.errors,
        })),
        haipCompliant: credentialResults.every((result) => result.raw.haip?.compliant !== false),
        verifiedAt,
        errors,
        receiptId: receipts[0]?.receiptId ?? null,
        receiptIds: receipts.map((receipt) => receipt.receiptId),
        receiptHash: receipts[0]?.hash ?? auditEntry.receiptHash,
        traceId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'presentation_verify_failed', { error: msg });
      res.status(500).json({ error: 'Failed to verify presentation', detail: msg });
    }
  });

  // ── POST /api/credentials/accept ───────────────────────────────────
  app.post('/api/credentials/accept', async (req: Request, res: Response) => {
    try {
      const { presentationId, acceptedCredentials, deniedCredentials, reason } = req.body ?? {};

      if (!presentationId || typeof presentationId !== 'string') {
        res.status(400).json({ error: 'presentationId is required' });
        return;
      }

      const presentation = getPresentation(presentationId);
      if (!presentation) {
        res.status(404).json({ error: `Presentation ${presentationId} not found` });
        return;
      }

      const report = await acceptCredentialPresentation(presentation);
      const accepted = report.decision === 'ACCEPTED';
      const reportAccepted = report.credentialResults
        .filter((result) => result.valid)
        .map((result) => result.credentialId);
      const reportDenied = report.credentialResults
        .filter((result) => !result.valid)
        .map((result) => result.credentialId);

      const acceptedIds = Array.isArray(acceptedCredentials) && acceptedCredentials.every((value) => typeof value === 'string')
        ? acceptedCredentials
        : (accepted ? reportAccepted : []);
      const deniedIds = Array.isArray(deniedCredentials) && deniedCredentials.every((value) => typeof value === 'string')
        ? deniedCredentials
        : (reportDenied.length > 0 ? reportDenied : accepted ? [] : presentation.credentials.map((credential) => credential.credentialId));

      const traceId = newTraceId();
      const receipts = (
        await Promise.all(
          report.credentialResults.map((result) =>
            safeGenerateVerificationReceipt({
              credentialId: result.credentialId,
              verifier: typeof req.body?.verifierDid === 'string'
                ? req.body.verifierDid
                : 'did:vitalcv:verifier:sdk',
              subject: presentation.credentials.find((credential) => credential.credentialId === result.credentialId)?.subject
                ?? presentation.holder,
              valid: result.valid,
              checks: result.checks,
              haipCompliant: result.errors.every((error) => !error.startsWith('[HAIP:')),
              errors: result.errors,
            }),
          ),
        )
      ).filter((receipt): receipt is NonNullable<typeof receipt> => receipt !== null);

      const auditEntry = appendAuditEvent({
        traceId,
        category: ['VERIFICATION', 'DECISION'],
        actor: typeof req.body?.verifierDid === 'string'
          ? req.body.verifierDid
          : 'did:vitalcv:verifier:sdk',
        resource: presentationId,
        severity: accepted ? 'INFO' : 'WARNING',
        requestFields: {
          acceptedCredentials: acceptedIds,
          deniedCredentials: deniedIds,
        },
        resultFields: {
          decision: report.decision,
          reason: typeof reason === 'string' ? reason : report.summary,
        },
      });

      res.status(200).json({
        report: {
          ...report,
          receiptId: receipts[0]?.receiptId ?? null,
          traceId,
        },
        accepted,
        presentationId,
        subject: presentation.credentials[0]?.subject ?? presentation.holder,
        credentialsAccepted: acceptedIds,
        credentialsDenied: deniedIds,
        reason: typeof reason === 'string' ? reason : (accepted ? undefined : report.summary),
        acceptedAt: report.evaluatedAt,
        receiptId: receipts[0]?.receiptId ?? null,
        receiptIds: receipts.map((receipt) => receipt.receiptId),
        receiptHash: receipts[0]?.hash ?? auditEntry.receiptHash,
        traceId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'presentation_accept_failed', { error: msg });
      res.status(500).json({ error: 'Failed to accept presentation', detail: msg });
    }
  });

  // ── GET /api/credentials/wallet ────────────────────────────────────
  app.get('/api/credentials/wallet', (req: Request, res: Response) => {
    try {
      const subject = typeof req.query.npi === 'string' ? req.query.npi : undefined;
      if (!subject) {
        res.status(400).json({ error: 'npi query parameter is required' });
        return;
      }

      const requestedStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
      const requestedType = typeof req.query.type === 'string' ? req.query.type : undefined;
      const rows = listCredentials(subject)
        .map((row) => mapWalletCredential(row.credential, {
          daysUntilExpiry: row.daysUntilExpiry,
          expiryWarning: row.expiryWarning,
        }))
        .filter((credential) => !requestedStatus || credential.status === requestedStatus)
        .filter((credential) => !requestedType || credential.credentialType === requestedType);

      res.status(200).json(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'wallet_query_failed', { error: msg });
      res.status(500).json({ error: 'Failed to list wallet credentials', detail: msg });
    }
  });

  // ── GET /api/credentials/wallet/:subject/summary ───────────────────
  app.get('/api/credentials/wallet/:subject/summary', async (req: Request, res: Response) => {
    try {
      const subject = decodeURIComponent(req.params.subject ?? '');
      if (!subject) {
        res.status(400).json({ error: 'subject is required' });
        return;
      }

      const rows = listCredentials(subject);
      const summary = getWalletSummary(subject);
      const trustState = await computeSubstrateTrustState(subject);
      const haipCompliantCount = rows.filter((row) => getIssuer(row.credential.issuer)?.haipCompliant ?? false).length;

      res.status(200).json({
        npi: subject,
        totalCredentials: summary.total,
        validCredentials: summary.active,
        expiringCredentials: summary.expiring,
        expiredCredentials: summary.expired,
        revokedCredentials: summary.revoked,
        haipCompliantCount,
        trustBand: trustState.band,
        lastUpdated: trustState.computedAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'wallet_summary_failed', { error: msg });
      res.status(500).json({ error: 'Failed to retrieve wallet summary', detail: msg });
    }
  });

  // ── POST /api/credentials/present ──────────────────────────────────
  app.post('/api/credentials/present', async (req: Request, res: Response) => {
    try {
      const holder = typeof req.body?.holder === 'string'
        ? req.body.holder
        : typeof req.body?.holderDid === 'string'
          ? req.body.holderDid
          : typeof req.body?.npi === 'string'
            ? req.body.npi
            : '';
      const subject = typeof req.body?.npi === 'string' ? req.body.npi : holder;
      const credentialIds = Array.isArray(req.body?.credentialIds)
        ? req.body.credentialIds.filter((id: unknown): id is string => typeof id === 'string')
        : [];
      const disclosedClaims = Array.isArray(req.body?.disclosedClaims)
        ? req.body.disclosedClaims.filter((claim: unknown): claim is string => typeof claim === 'string')
        : undefined;
      const expiresAt = typeof req.body?.expiresAt === 'string' ? req.body.expiresAt : undefined;

      if (!holder) {
        res.status(400).json({ error: 'holder or holderDid is required' });
        return;
      }
      if (credentialIds.length === 0) {
        res.status(400).json({ error: 'credentialIds must be a non-empty array' });
        return;
      }

      const signingKey = getSigningKey();
      if (!signingKey) {
        res.status(503).json({
          error: 'Signing key not configured',
          hint: 'Set CREDENTIAL_SIGNING_KEY_PEM environment variable',
        });
        return;
      }

      const resolvedCredentials: Array<VerifiableCredential | null> = credentialIds
        .map((id: string) => getCredential(id));
      const credentials = resolvedCredentials
        .filter((credential): credential is VerifiableCredential => credential != null);

      if (credentials.length === 0) {
        res.status(404).json({ error: 'None of the specified credentials were found in the wallet' });
        return;
      }

      const presentation = await createPresentation(credentials, holder, signingKey, {
        disclosedClaims,
        expiresAt,
      });
      const traceId = newTraceId();
      const verifier = typeof req.body?.verifierDid === 'string'
        ? req.body.verifierDid
        : 'did:vitalcv:verifier:unspecified';
      const auditEntry = auditPresentation({
        traceId,
        actor: holder,
        presentationId: presentation.presentationId,
        subject,
        verifier,
        disclosedClaims: presentation.disclosedClaims ?? [],
        success: true,
      });
      const receipt = await safeGeneratePresentationReceipt({
        presentationId: presentation.presentationId,
        holder,
        verifier,
        disclosedClaims: presentation.disclosedClaims ?? [],
        withheldClaimsCount: Math.max(0, Object.keys(credentials[0]?.claims ?? {}).length - (presentation.disclosedClaims?.length ?? 0)),
        credentialCount: presentation.credentials.length,
      });

      res.status(201).json(buildPresentationResponse(presentation, subject, {
        traceId,
        receiptId: receipt?.receiptId ?? null,
        receiptHash: receipt?.hash ?? auditEntry.receiptHash,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'credential_present_failed', { error: msg });
      res.status(500).json({ error: 'Failed to create presentation', detail: msg });
    }
  });

  // ── GET /api/credentials/present/:id ───────────────────────────────
  app.get('/api/credentials/present/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const presentation = getPresentation(id);

      if (!presentation) {
        res.status(404).json({ error: `Presentation ${id} not found` });
        return;
      }

      res.status(200).json({ presentation });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'presentation_get_failed', { error: msg });
      res.status(500).json({ error: 'Failed to retrieve presentation', detail: msg });
    }
  });

  // ── GET /api/credentials/holder/:subject ───────────────────────────
  app.get('/api/credentials/holder/:subject', (req: Request, res: Response) => {
    try {
      const subject = decodeURIComponent(req.params.subject ?? '');
      const credentials = getCredentialsForSubject(subject);
      const presentations = getPresentationsForHolder(subject);

      res.status(200).json({
        subject,
        credentials,
        presentations,
        total: { credentials: credentials.length, presentations: presentations.length },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'holder_wallet_get_failed', { error: msg });
      res.status(500).json({ error: 'Failed to retrieve holder wallet', detail: msg });
    }
  });

  // ── GET /api/credentials/wallet/:subject ───────────────────────────
  app.get('/api/credentials/wallet/:subject', (req: Request, res: Response) => {
    try {
      const subject = decodeURIComponent(req.params.subject ?? '');
      const rows = listCredentials(subject);
      const summary = getWalletSummary(subject);
      res.status(200).json({ subject, credentials: rows, summary });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'wallet_list_failed', { error: msg });
      res.status(500).json({ error: 'Failed to list wallet credentials', detail: msg });
    }
  });

  // ── DELETE /api/credentials/wallet/:credentialId ───────────────────
  app.delete('/api/credentials/wallet/:credentialId', (req: Request, res: Response) => {
    try {
      const { credentialId } = req.params;
      const removed = removeCredential(credentialId);
      if (!removed) {
        res.status(404).json({ error: `Credential ${credentialId} not found` });
        return;
      }

      res.status(200).json({ removed: true, credentialId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'wallet_remove_failed', { error: msg });
      res.status(500).json({ error: 'Failed to remove credential', detail: msg });
    }
  });

  // ── GET /api/credentials/:id ───────────────────────────────────────
  app.get('/api/credentials/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const credential = getCredential(id);

      if (!credential) {
        res.status(404).json({ error: `Credential ${id} not found` });
        return;
      }

      res.status(200).json({
        credential,
        ...mapWalletCredential(credential),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'credential_get_failed', { error: msg });
      res.status(500).json({ error: 'Failed to retrieve credential', detail: msg });
    }
  });

  // ── DELETE /api/credentials/:id ────────────────────────────────────
  app.delete('/api/credentials/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const removed = removeCredential(id);
      if (!removed) {
        res.status(404).json({ error: `Credential ${id} not found` });
        return;
      }
      res.status(200).json({ removed: true, credentialId: id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'credential_remove_failed', { error: msg });
      res.status(500).json({ error: 'Failed to remove credential', detail: msg });
    }
  });

  // ── POST /api/credentials/present/selective ────────────────────────
  app.post('/api/credentials/present/selective', async (req: Request, res: Response) => {
    try {
      const { holder, credentialId, revealFields, expiresAt } = req.body ?? {};

      if (!holder || typeof holder !== 'string') {
        res.status(400).json({ error: 'holder is required' });
        return;
      }
      if (!credentialId || typeof credentialId !== 'string') {
        res.status(400).json({ error: 'credentialId is required' });
        return;
      }
      if (!Array.isArray(revealFields) || revealFields.length === 0) {
        res.status(400).json({ error: 'revealFields must be a non-empty array of claim keys' });
        return;
      }

      const credential = getCredential(credentialId);
      if (!credential) {
        res.status(404).json({ error: `Credential ${credentialId} not found` });
        return;
      }

      const signingKey = getSigningKey();
      if (!signingKey) {
        res.status(503).json({
          error: 'Signing key not configured',
          hint: 'Set CREDENTIAL_SIGNING_KEY_PEM environment variable',
        });
        return;
      }

      const { disclosure, salts } = generateSelectiveDisclosure(credential, revealFields);

      const sdJwtCheck = enforceSDJWTStructure(
        { ...disclosure, salts, credentialId, disclosedAt: new Date().toISOString(), holderDid: holder },
        { actor: holder },
      );
      if (!sdJwtCheck.valid) {
        res.status(422).json({
          error: 'SD-JWT structure violation',
          errors: sdJwtCheck.errors,
          auditEventId: sdJwtCheck.auditEventId,
          traceId: sdJwtCheck.traceId,
        });
        return;
      }

      const presentation = await createPresentation(
        [credential],
        holder,
        signingKey,
        { disclosedClaims: revealFields, expiresAt: expiresAt ?? '1h' },
      );

      res.status(201).json({
        presentation,
        disclosure,
        salts,
        revealedFields: revealFields,
        hiddenFields: Object.keys(disclosure.hiddenCommitments),
        sdJwtAuditEventId: sdJwtCheck.auditEventId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'selective_disclosure_failed', { error: msg });
      res.status(500).json({ error: 'Failed to generate selective disclosure', detail: msg });
    }
  });

  // ── GET /api/credentials/:id/fields ────────────────────────────────
  app.get('/api/credentials/:id/fields', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const credential = getCredential(id);

      if (!credential) {
        res.status(404).json({ error: `Credential ${id} not found` });
        return;
      }

      const fields = listCredentialFields(credential);
      res.status(200).json({ credentialId: id, fields, total: fields.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'credential_fields_list_failed', { error: msg });
      res.status(500).json({ error: 'Failed to list credential fields', detail: msg });
    }
  });

  // ── Wave 238: Holder Credential Onboarding ────────────────────────

  /**
   * POST /api/credentials/ingest
   * Body: { documentId: string }
   * Fetches the stored extraction by documentId and creates a CandidateCredential.
   */
  app.post('/api/credentials/ingest', async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.headers['x-clerk-user-id'] as string | undefined;
      if (!clerkUserId) {
        res.status(401).json({ error: 'unauthorized', error_description: 'x-clerk-user-id header required' });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : '';
      if (!documentId) {
        res.status(400).json({ error: 'documentId is required' });
        return;
      }

      // Owner-scoped: an id that is not this caller's resolves to 404 and
      // nothing is ingested under this profile.
      const extraction = await getExtraction(documentId, clerkUserId);
      if (!extraction) {
        res.status(404).json({ error: `No extraction found for documentId: ${documentId}` });
        return;
      }

      const result = await ingestCredential(clerkUserId, extraction);
      res.status(201).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'credential_ingest_failed', { error: msg });
      res.status(500).json({ error: 'Failed to ingest credential', detail: msg });
    }
  });

  /**
   * PATCH /api/credentials/:id/confirm
   * Body: { corrections: Record<string, string> }
   * Merges corrections and sets status to PENDING_VERIFICATION.
   */
  app.patch('/api/credentials/:id/confirm', async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.headers['x-clerk-user-id'] as string | undefined;
      if (!clerkUserId) {
        res.status(401).json({ error: 'unauthorized', error_description: 'x-clerk-user-id header required' });
        return;
      }

      const { id } = req.params;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const corrections = (typeof body.corrections === 'object' && body.corrections !== null && !Array.isArray(body.corrections))
        ? (body.corrections as Record<string, string>)
        : {};

      const result = await confirmCredential(id, corrections);
      res.status(200).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'credential_confirm_failed', { error: msg });
      res.status(500).json({ error: 'Failed to confirm credential', detail: msg });
    }
  });

  /**
   * GET /api/credentials/mine
   * Lists CandidateCredential records for the authenticated user.
   */
  app.get('/api/credentials/mine', async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.headers['x-clerk-user-id'] as string | undefined;
      if (!clerkUserId) {
        res.status(401).json({ error: 'unauthorized', error_description: 'x-clerk-user-id header required' });
        return;
      }

      const credentials = await listCandidateCredentials(clerkUserId);
      res.status(200).json({ credentials, total: credentials.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'credential_list_failed', { error: msg });
      res.status(500).json({ error: 'Failed to list credentials', detail: msg });
    }
  });

  /**
   * POST /api/credentials/ingest-npi
   * Body: { npi: string }
   *
   * Wave 286: Onboarding activation — triggers NPPES auto-import for a clinician.
   * Called from the onboarding fetching page to bootstrap real trust-state.
   * Returns 409 if NPI already ingested (idempotent).
   */
  app.post('/api/credentials/ingest-npi', async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.headers['x-clerk-user-id'] as string | undefined;
      if (!clerkUserId) {
        res.status(401).json({ error: 'unauthorized', error_description: 'x-clerk-user-id header required' });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const npi = typeof body.npi === 'string' ? body.npi.trim() : '';
      if (!npi || !/^\d{10}$/.test(npi)) {
        res.status(400).json({ error: 'npi must be a 10-digit string' });
        return;
      }

      const { ingestNpiProfile } = await import('../services/credentials/credentialIngestionService');
      const result = await ingestNpiProfile(npi);

      log('info', 'npi_profile_ingested', { npi: npi.slice(0, 4) + '******', clerkUserId });
      res.status(201).json({ ok: true, npi, sourceName: result.sourceName });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // Treat "already ingested" as idempotent success
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('unique')) {
        res.status(409).json({ ok: true, message: 'NPI already ingested' });
        return;
      }
      log('error', 'npi_profile_ingest_failed', { error: msg });
      res.status(500).json({ error: 'NPI ingestion failed', detail: msg });
    }
  });
}
