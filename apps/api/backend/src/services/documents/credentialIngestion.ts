/**
 * credentialIngestion.ts — Wave 238: Holder Credential Onboarding
 *
 * Converts parsed document extractions into CandidateCredential Prisma records.
 * Provides ingest, confirm, and list operations.
 */

import type { CandidateCredential } from '@prisma/client';
import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { appendAuditEvent, newTraceId } from '../audit/auditLedger';
import type { DocumentExtractionResult } from '../ai/documentPipeline';
import { log } from '../../obs/logger';
import { invalidateTrustStateCache } from '../trust/trustStateCache';

// ── ingestCredential ──────────────────────────────────────────────────────────

/**
 * Creates a CandidateCredential record from a parsed document extraction.
 * Sets status = "UNVERIFIED" and emits an ISSUANCE audit event.
 */
export async function ingestCredential(
  clerkUserId: string,
  extraction: DocumentExtractionResult,
): Promise<{ credentialId: string; status: string }> {
  const traceId = newTraceId();

  const data: Prisma.InputJsonValue = {
    documentType: extraction.documentType,
    extractedFields: extraction.extractedFields as unknown as Prisma.InputJsonValue,
    overallConfidence: extraction.overallConfidence,
    processingTimeMs: extraction.processingTimeMs,
  };

  const credential = await prisma.candidateCredential.create({
    data: {
      candidateCredentialId: extraction.documentId,
      clinicianId: clerkUserId,
      data,
      status: 'UNVERIFIED',
    },
  });
  invalidateTrustStateCache(credential.clinicianId);

  appendAuditEvent({
    traceId,
    category: ['ISSUANCE'],
    actor: clerkUserId,
    resource: credential.id,
    requestFields: {
      documentId: extraction.documentId,
      documentType: extraction.documentType,
    },
    resultFields: {
      credentialId: credential.id,
      status: credential.status,
    },
    severity: 'INFO',
  });

  log('info', 'credential_ingested', {
    credentialId: credential.id,
    clerkUserId,
    documentType: extraction.documentType,
    traceId,
  });

  return { credentialId: credential.id, status: credential.status };
}

// ── confirmCredential ─────────────────────────────────────────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Merges user corrections into the credential data and sets status to
 * "PENDING_VERIFICATION". Emits an audit event.
 *
 * Scoped to its owner: acts only on a credential whose `clinicianId` is
 * `ownerClerkUserId` (the key `ingestCredential` writes), and returns null for
 * anything else — another account's id, an unknown id, a malformed id. Null
 * is indistinguishable across those cases, so a caller learns nothing about
 * credentials that are not theirs. Routes map null to 404.
 */
export async function confirmCredential(
  credentialId: string,
  corrections: Record<string, string>,
  ownerClerkUserId: string,
): Promise<{ status: string } | null> {
  if (!ownerClerkUserId || ownerClerkUserId.trim() === '') return null;
  // The id column is a UUID; Prisma throws on anything else. A malformed id
  // is "not found", not a server error.
  if (!UUID_PATTERN.test(credentialId)) return null;

  const traceId = newTraceId();

  const existing = await prisma.candidateCredential.findFirst({
    where: { id: credentialId, clinicianId: ownerClerkUserId },
  });

  if (!existing) {
    return null;
  }

  const existingData = (existing.data ?? {}) as Record<string, unknown>;

  // Merge corrections into extractedFields values
  let extractedFields = (existingData.extractedFields as Array<{ field: string; value: string; confidence: number }>) ?? [];
  if (Object.keys(corrections).length > 0) {
    extractedFields = extractedFields.map((f) =>
      corrections[f.field] !== undefined
        ? { ...f, value: corrections[f.field], corrected: true }
        : f,
    );
  }

  const updatedData = {
    ...existingData,
    extractedFields,
    corrections,
  };

  const updated = await prisma.candidateCredential.update({
    where: { id: credentialId },
    data: {
      data: updatedData,
      status: 'PENDING_VERIFICATION',
    },
  });
  invalidateTrustStateCache(updated.clinicianId);

  appendAuditEvent({
    traceId,
    category: ['ISSUANCE'],
    actor: existing.clinicianId,
    resource: credentialId,
    requestFields: { credentialId, correctionCount: Object.keys(corrections).length },
    resultFields: { status: updated.status },
    severity: 'INFO',
  });

  log('info', 'credential_confirmed', {
    credentialId,
    status: updated.status,
    traceId,
  });

  return { status: updated.status };
}

// ── listCredentials ───────────────────────────────────────────────────────────

/**
 * Lists all CandidateCredential records for the given Clerk user ID,
 * ordered by most recently created first.
 */
export async function listCredentials(clerkUserId: string): Promise<CandidateCredential[]> {
  return prisma.candidateCredential.findMany({
    where: { clinicianId: clerkUserId },
    orderBy: { createdAt: 'desc' },
  });
}
