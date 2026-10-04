/**
 * documentStore.test.ts — Wave 237: Unit tests for document extraction storage
 */

// Mock Prisma client before any imports
jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

// Mock audit ledger for audit tests
jest.mock('../../audit/auditLedger', () => ({
  appendAuditEvent: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import {
  DOCUMENT_PARSE_STATUS,
  storeExtraction,
  getExtraction,
  listExtractions,
  isAllowedMimeType,
} from '../documentStore';
import { auditParse, auditVerify } from '../documentAudit';
import { appendAuditEvent } from '../../audit/auditLedger';
import type { DocumentExtractionResult } from '../../ai/documentPipeline';

// ── Typed mocks ───────────────────────────────────────────────────────

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
};

const appendAuditEventMock = appendAuditEvent as jest.Mock;

// ── Test fixtures ────────────────────────────────────────────────────

function buildExtraction(overrides: Partial<DocumentExtractionResult> = {}): DocumentExtractionResult {
  return {
    documentId: 'doc-abc-123',
    documentType: 'MEDICAL_LICENSE',
    extractedFields: [
      { field: 'name', value: 'Dr. Jane Smith', confidence: 0.97 },
      { field: 'licenseNumber', value: 'MD123456', confidence: 0.95 },
    ],
    overallConfidence: 0.96,
    rawOcrText: 'Medical License\nDr. Jane Smith\nMD123456',
    processingTimeMs: 350,
    ...overrides,
  };
}

// ── storeExtraction ───────────────────────────────────────────────────
//
// A document the clinician uploaded is self-attested evidence. Before this
// pin, the store mapped OCR confidence to a status and wrote `VERIFIED` for
// anything at or above 0.9 — the same literal the trust engines treat as a
// source-verified artifact. OCR confidence is a statement about how legible
// the image was, not about whether any issuing body stands behind it. The
// status is now a constant, and no confidence value may change it.

describe('storeExtraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a VerificationArtifact and returns the artifact id', async () => {
    const extraction = buildExtraction();

    prismaMock.verificationArtifact.create.mockResolvedValue({
      id: extraction.documentId,
    });

    const id = await storeExtraction('user_clerk_001', extraction);

    expect(id).toBe('doc-abc-123');
    expect(prismaMock.verificationArtifact.create).toHaveBeenCalledTimes(1);

    const createCall = prismaMock.verificationArtifact.create.mock.calls[0][0];
    expect(createCall.data.id).toBe('doc-abc-123');
    expect(createCall.data.source).toBe('DOCUMENT_PARSE');
    expect(createCall.data.npi).toBe('user_clerk_001');
    expect(createCall.data.status).toBe(DOCUMENT_PARSE_STATUS);
    expect(typeof createCall.data.checksum).toBe('string');
    expect(createCall.data.checksum).toHaveLength(64); // SHA-256 hex
    expect(createCall.data.rawPayload).toMatchObject({ documentId: 'doc-abc-123' });
  });

  it('the constant is a self-attested label, never the source-verified literal', () => {
    expect(DOCUMENT_PARSE_STATUS).toBe('SELF_ATTESTED');
    expect(DOCUMENT_PARSE_STATUS).not.toBe('VERIFIED');
  });

  it('no confidence value can write VERIFIED (sweep 0.00 → 1.00)', async () => {
    prismaMock.verificationArtifact.create.mockResolvedValue({ id: 'doc-abc-123' });

    const confidences = Array.from({ length: 21 }, (_, i) => i / 20); // 0, 0.05, …, 1
    for (const overallConfidence of confidences) {
      prismaMock.verificationArtifact.create.mockClear();
      await storeExtraction('user_clerk_001', buildExtraction({ overallConfidence }));
      const createCall = prismaMock.verificationArtifact.create.mock.calls[0][0];
      expect(createCall.data.status).toBe(DOCUMENT_PARSE_STATUS);
      expect(createCall.data.status).not.toBe('VERIFIED');
      expect(createCall.data.status).not.toMatch(/^verified$/i);
    }
  });

  it('a 1.0-confidence, zero-confidence and NaN-confidence extraction all get the same status', async () => {
    prismaMock.verificationArtifact.create.mockResolvedValue({ id: 'doc-abc-123' });
    for (const overallConfidence of [1, 0, Number.NaN]) {
      prismaMock.verificationArtifact.create.mockClear();
      await storeExtraction('user_clerk_001', buildExtraction({ overallConfidence }));
      expect(prismaMock.verificationArtifact.create.mock.calls[0][0].data.status).toBe(DOCUMENT_PARSE_STATUS);
    }
  });
});

// ── getExtraction ─────────────────────────────────────────────────────
//
// Reads are scoped to the owner. The lookup was by id alone, so any account
// that learned a document id could read, verify or ingest another account's
// upload. The owner is now part of the query, and a mismatch is
// indistinguishable from "no such document".

describe('getExtraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the stored extraction result for its owner', async () => {
    const extraction = buildExtraction();

    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      id: extraction.documentId,
      rawPayload: extraction,
      source: 'DOCUMENT_PARSE',
      npi: 'user_clerk_001',
    });

    const result = await getExtraction('doc-abc-123', 'user_clerk_001');

    expect(result).not.toBeNull();
    expect(result?.documentId).toBe('doc-abc-123');
    expect(result?.documentType).toBe('MEDICAL_LICENSE');
    expect(prismaMock.verificationArtifact.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc-abc-123', source: 'DOCUMENT_PARSE', npi: 'user_clerk_001' },
    });
  });

  it('scopes the query by the caller, so another account’s id is not found', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue(null);

    const result = await getExtraction('doc-abc-123', 'user_clerk_other');

    expect(result).toBeNull();
    const where = prismaMock.verificationArtifact.findFirst.mock.calls[0][0].where;
    expect(where.npi).toBe('user_clerk_other');
    expect(where.id).toBe('doc-abc-123');
    expect(where.source).toBe('DOCUMENT_PARSE');
  });

  it('refuses an empty owner rather than widening the query', async () => {
    const result = await getExtraction('doc-abc-123', '');
    expect(result).toBeNull();
    expect(prismaMock.verificationArtifact.findFirst).not.toHaveBeenCalled();
  });

  it('returns null for a non-existent documentId', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue(null);

    const result = await getExtraction('does-not-exist', 'user_clerk_001');

    expect(result).toBeNull();
  });

  it('returns null when rawPayload is missing', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      id: 'doc-xyz',
      rawPayload: null,
      source: 'DOCUMENT_PARSE',
      npi: 'user_clerk_001',
    });

    const result = await getExtraction('doc-xyz', 'user_clerk_001');

    expect(result).toBeNull();
  });
});

// ── listExtractions ───────────────────────────────────────────────────

describe('listExtractions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns extractions for the given clerkUserId', async () => {
    const extraction1 = buildExtraction({ documentId: 'doc-1' });
    const extraction2 = buildExtraction({ documentId: 'doc-2' });

    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      { id: 'doc-1', rawPayload: extraction1, source: 'DOCUMENT_PARSE' },
      { id: 'doc-2', rawPayload: extraction2, source: 'DOCUMENT_PARSE' },
    ]);

    const results = await listExtractions('user_clerk_001');

    expect(results).toHaveLength(2);
    expect(results[0].documentId).toBe('doc-1');
    expect(results[1].documentId).toBe('doc-2');
  });

  it('filters out artifacts with null rawPayload', async () => {
    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      { id: 'doc-1', rawPayload: buildExtraction({ documentId: 'doc-1' }), source: 'DOCUMENT_PARSE' },
      { id: 'doc-2', rawPayload: null, source: 'DOCUMENT_PARSE' },
    ]);

    const results = await listExtractions('user_clerk_001');

    expect(results).toHaveLength(1);
    expect(results[0].documentId).toBe('doc-1');
  });
});

// ── isAllowedMimeType ─────────────────────────────────────────────────

describe('isAllowedMimeType', () => {
  it('allows application/pdf', () => {
    expect(isAllowedMimeType('application/pdf')).toBe(true);
  });

  it('allows image/png', () => {
    expect(isAllowedMimeType('image/png')).toBe(true);
  });

  it('allows image/jpeg', () => {
    expect(isAllowedMimeType('image/jpeg')).toBe(true);
  });

  it('allows image/tiff', () => {
    expect(isAllowedMimeType('image/tiff')).toBe(true);
  });

  it('rejects image/gif', () => {
    expect(isAllowedMimeType('image/gif')).toBe(false);
  });

  it('rejects text/plain', () => {
    expect(isAllowedMimeType('text/plain')).toBe(false);
  });

  it('rejects application/json', () => {
    expect(isAllowedMimeType('application/json')).toBe(false);
  });
});

// ── auditParse ────────────────────────────────────────────────────────

describe('auditParse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls appendAuditEvent with VERIFICATION category and INFO severity', () => {
    const extraction = buildExtraction();

    auditParse('user_clerk_001', extraction, 'license.pdf');

    expect(appendAuditEventMock).toHaveBeenCalledTimes(1);

    const call = appendAuditEventMock.mock.calls[0][0];
    expect(call.category).toEqual(['VERIFICATION']);
    expect(call.actor).toBe('user_clerk_001');
    expect(call.resource).toBe('doc-abc-123');
    expect(call.severity).toBe('INFO');
    expect(call.requestFields.filename).toBe('license.pdf');
    expect(call.resultFields.documentType).toBe('MEDICAL_LICENSE');
    expect(call.resultFields.overallConfidence).toBe(0.96);
    expect(call.resultFields.fieldCount).toBe(2);
  });
});

// ── auditVerify ───────────────────────────────────────────────────────

describe('auditVerify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emits INFO severity when verification passes with no discrepancies', () => {
    auditVerify('user_clerk_001', 'doc-abc-123', true, 0);

    const call = appendAuditEventMock.mock.calls[0][0];
    expect(call.severity).toBe('INFO');
    expect(call.resultFields.verified).toBe(true);
    expect(call.resultFields.discrepancies).toBe(0);
  });

  it('emits WARNING severity when verification fails', () => {
    auditVerify('user_clerk_001', 'doc-abc-123', false, 3);

    const call = appendAuditEventMock.mock.calls[0][0];
    expect(call.severity).toBe('WARNING');
    expect(call.resultFields.verified).toBe(false);
    expect(call.resultFields.discrepancies).toBe(3);
  });
});
