/**
 * documents.ts — Wave 237: Document Intelligence API
 *
 * Routes:
 *   POST /api/documents/parse   — upload a file, run OCR + extraction, return result
 *                                 (503 when document reading is unavailable; nothing stored)
 *   POST /api/documents/verify  — verify an extracted document against primary sources
 *   GET  /api/documents/:id     — retrieve a stored extraction result by documentId
 *
 * Auth: all routes require `x-clerk-user-id` header. Stored-extraction reads
 * are scoped to that caller: another account's document id is a 404.
 *
 * Rate limiting (G3): parse + verify run OCR and primary-source calls, making them
 * the most expensive lanes in the API — both sit behind the 10/min
 * `documentIntelligence` tier. The stored-result read is a cheap lookup. Buckets key
 * by verified user id once CLERK_JWT_VERIFICATION=enforce, by IP before that.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { DocumentReadingUnavailableError, documentPipeline } from '../services/ai/documentPipeline';
import { sourceVerifier } from '../services/ai/sourceVerifier';
import { log } from '../obs/logger';
import { storeExtraction, getExtraction, isAllowedMimeType } from '../services/documents/documentStore';
import { auditParse, auditVerify } from '../services/documents/documentAudit';
import {
  credentialStatusRateLimit,
  documentIntelligenceRateLimit,
} from '../middleware/rateLimitFactory';

// ── Allowed file types ─────────────────────────────────────────────
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];

// ── Multer config: memory storage, 10 MB limit ────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(_req, file, cb) {
    if (isAllowedMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
        ),
      );
    }
  },
});

// ── Auth middleware: require x-clerk-user-id ───────────────────────
function requireClerkUser(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-clerk-user-id'];
  if (!userId || (typeof userId === 'string' && userId.trim() === '')) {
    res.status(401).json({
      error: 'unauthorized',
      error_description: 'x-clerk-user-id header is required',
    });
    return;
  }
  next();
}

// ── Route registration ─────────────────────────────────────────────

export function registerDocumentRoutes(app: Express): void {

  /**
   * POST /api/documents/parse
   * Accepts a multipart/form-data file upload (field name: "file").
   * Allowed types: application/pdf, image/png, image/jpeg, image/tiff (max 10 MB).
   * Runs OCR + field extraction via documentPipeline.
   * Stores result durably in VerificationArtifact and returns it.
   */
  app.post(
    '/api/documents/parse',
    documentIntelligenceRateLimit,
    requireClerkUser,
    upload.single('file'),
    async (req: Request, res: Response): Promise<void> => {
      try {
        if (!req.file) {
          res.status(400).json({
            error: 'No file uploaded. Send a multipart/form-data request with field "file".',
          });
          return;
        }

        const { buffer, mimetype, originalname, size } = req.file;

        // Validate file size (multer enforces limit, but include explicit message)
        if (size > 10 * 1024 * 1024) {
          res.status(400).json({
            error: `File too large: ${size} bytes. Maximum allowed size is 10 MB (10485760 bytes).`,
          });
          return;
        }

        // Validate MIME type (double-check beyond multer fileFilter)
        if (!isAllowedMimeType(mimetype)) {
          res.status(400).json({
            error: `Unsupported file type: ${mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
          });
          return;
        }

        const clerkUserId = req.headers['x-clerk-user-id'] as string;

        log('info', 'document_parse_start', {
          originalname,
          mimetype,
          sizeBytes: size,
          userId: clerkUserId,
        });

        const result = await documentPipeline.extractFromDocument(buffer, mimetype);

        // Persist durably in VerificationArtifact (replaces in-memory Map)
        await storeExtraction(clerkUserId, result);

        // Emit audit event for compliance ledger
        auditParse(clerkUserId, result, originalname);

        log('info', 'document_parse_complete', {
          documentId: result.documentId,
          documentType: result.documentType,
          overallConfidence: result.overallConfidence,
          processingTimeMs: result.processingTimeMs,
        });

        res.status(200).json(result);
      } catch (err) {
        if (err instanceof DocumentReadingUnavailableError) {
          // Fail closed: no provider, provider fault or timeout. Nothing was
          // stored and no audit row was written. The copy is a plain sentence
          // and deliberately not a verification outcome.
          log('warn', 'document_parse_unavailable', {
            userId: req.headers['x-clerk-user-id'],
          });
          res.status(503).json({
            error: 'document_reading_unavailable',
            message: 'Document reading is unavailable right now. Nothing was stored; please try again later.',
          });
          return;
        }

        const message = err instanceof Error ? err.message : 'Document parse failed';
        log('error', 'document_parse_error', {
          error: message,
          userId: req.headers['x-clerk-user-id'],
        });
        res.status(500).json({ error: message });
      }
    },
  );

  /**
   * POST /api/documents/verify
   * Body: { documentId: string, npi?: string }
   * Retrieves the stored extraction from the database, optionally injects the
   * provided NPI, then runs primary-source verification via sourceVerifier.verifyDocument().
   */
  app.post(
    '/api/documents/verify',
    documentIntelligenceRateLimit,
    requireClerkUser,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : '';
        const npi = typeof body.npi === 'string' ? body.npi.trim() : '';

        if (!documentId) {
          res.status(400).json({ error: 'documentId is required' });
          return;
        }

        const clerkUserId = req.headers['x-clerk-user-id'] as string;

        const extraction = await getExtraction(documentId, clerkUserId);
        if (!extraction) {
          res.status(404).json({ error: `No extraction found for documentId: ${documentId}` });
          return;
        }

        // If caller provides an NPI, inject/override it in the extraction fields
        let effectiveExtraction = extraction;
        if (npi) {
          const existingFields = extraction.extractedFields.filter((f) => f.field !== 'npi');
          effectiveExtraction = {
            ...extraction,
            extractedFields: [
              ...existingFields,
              { field: 'npi', value: npi, confidence: 1.0 },
            ],
          };
        }

        log('info', 'document_verify_start', {
          documentId,
          npi: npi || '(not provided)',
          userId: clerkUserId,
        });

        const result = await sourceVerifier.verifyDocument(effectiveExtraction);

        // Emit audit event for compliance ledger
        auditVerify(clerkUserId, documentId, result.verified, result.discrepancies.length);

        log('info', 'document_verify_complete', {
          documentId,
          verified: result.verified,
          overallMatch: result.overallMatch,
          discrepancies: result.discrepancies.length,
        });

        res.status(200).json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Document verification failed';
        log('error', 'document_verify_error', {
          error: message,
          userId: req.headers['x-clerk-user-id'],
        });
        res.status(500).json({ error: message });
      }
    },
  );

  /**
   * GET /api/documents/:id
   * Returns the stored extraction result for the given documentId.
   */
  app.get(
    '/api/documents/:id',
    credentialStatusRateLimit,
    requireClerkUser,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { id } = req.params;
        const clerkUserId = req.headers['x-clerk-user-id'] as string;

        const extraction = await getExtraction(id, clerkUserId);
        if (!extraction) {
          res.status(404).json({ error: `No document found with id: ${id}` });
          return;
        }

        log('info', 'document_get', {
          documentId: id,
          userId: req.headers['x-clerk-user-id'],
        });

        res.status(200).json(extraction);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Document retrieval failed';
        log('error', 'document_get_error', {
          error: message,
          userId: req.headers['x-clerk-user-id'],
        });
        res.status(500).json({ error: message });
      }
    },
  );
}
