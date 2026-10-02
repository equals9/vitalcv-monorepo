/**
 * documentStore.ts — Wave 237: Durable Document Extraction Storage
 *
 * Replaces the in-memory Map with Prisma-backed VerificationArtifact records.
 * source = "DOCUMENT_PARSE" distinguishes these from PSV/verification artifacts.
 */

import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import type { DocumentExtractionResult } from '../ai/documentPipeline';
import { log } from '../../obs/logger';

// ── Allowed MIME types ────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
]);

export function isAllowedMimeType(mimetype: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimetype);
}

// ── Status ────────────────────────────────────────────────────────────
//
// A document the clinician uploaded is self-attested evidence. This used to
// map OCR confidence to a status and wrote `VERIFIED` at >= 0.9 — the same
// literal the trust engines read as a source-verified artifact. OCR
// confidence describes how legible the image was; it says nothing about
// whether an issuing body stands behind the document. The status is a
// constant, and no confidence value may change it. Verification, if it ever
// happens, is a separate artifact from a separate source.

export const DOCUMENT_PARSE_STATUS = 'SELF_ATTESTED' as const;

// ── SHA-256 checksum ──────────────────────────────────────────────────

function checksumPayload(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Persist a DocumentExtractionResult as a VerificationArtifact.
 * Returns the artifact id (= documentId reference).
 */
export async function storeExtraction(
  clerkUserId: string,
  extraction: DocumentExtractionResult,
): Promise<string> {
  const rawPayload = extraction as unknown as Prisma.InputJsonValue;
  const checksum = checksumPayload(rawPayload);
  const status = DOCUMENT_PARSE_STATUS;

  const artifact = await prisma.verificationArtifact.create({
    data: {
      id: extraction.documentId,
      npi: clerkUserId,          // use clerkUserId as npi placeholder for doc artifacts
      source: 'DOCUMENT_PARSE',
      status,
      rawPayload,
      checksum,
      verifiedAt: new Date(),
    },
  });

  log('info', 'document_store_saved', {
    artifactId: artifact.id,
    status,
    checksum,
  });

  return artifact.id;
}

/**
 * Retrieve a DocumentExtractionResult by documentId, scoped to its owner.
 *
 * Returns null if not found, not owned by `clerkUserId`, or not a
 * DOCUMENT_PARSE record. A mismatch is indistinguishable from absence, so a
 * caller cannot learn whether someone else's document id exists. The lookup
 * used to be by id alone, which let any signed-in account read, verify or
 * ingest another account's upload. The owner column is `npi` (the store
 * writes the Clerk user id there for DOCUMENT_PARSE rows, see above).
 */
export async function getExtraction(
  documentId: string,
  clerkUserId: string,
): Promise<DocumentExtractionResult | null> {
  if (!clerkUserId || clerkUserId.trim() === '') return null;

  const artifact = await prisma.verificationArtifact.findFirst({
    where: {
      id: documentId,
      source: 'DOCUMENT_PARSE',
      npi: clerkUserId,
    },
  });

  if (!artifact || !artifact.rawPayload) return null;

  return artifact.rawPayload as unknown as DocumentExtractionResult;
}

/**
 * List all document extractions for a given Clerk user.
 */
export async function listExtractions(
  clerkUserId: string,
): Promise<DocumentExtractionResult[]> {
  const artifacts = await prisma.verificationArtifact.findMany({
    where: {
      npi: clerkUserId,
      source: 'DOCUMENT_PARSE',
    },
    orderBy: { createdAt: 'desc' },
  });

  return artifacts
    .filter((a) => a.rawPayload != null)
    .map((a) => a.rawPayload as unknown as DocumentExtractionResult);
}
