/**
 * oid4vp.ts — Wave 110: OpenID4VP Presentation API Routes
 *
 * POST /api/oid4vp/request              — Create a presentation request
 * GET  /api/oid4vp/request/:id          — Get a presentation request
 * POST /api/oid4vp/response/:id         — Submit and verify a presentation response
 * GET  /api/oid4vp/result/:id           — Get verification result
 * GET  /api/oid4vp/requests             — List all requests
 */

import type { Express, Request, Response } from 'express';
import {
  DigitalCredentialEnvelopeError,
  normalizeOID4VPPresentationEnvelope,
} from '@vitalcv/haip-config';
import {
  createPresentationRequest,
  getPresentationRequest,
  verifyPresentationResponse,
  getPresentationResult,
  listPresentationRequests,
  buildMedicalCredentialDefinition,
} from '../services/oid4vp/presentationServer';
import type { PresentationResponseInput } from '../services/oid4vp/presentationServer';
import { log } from '../obs/logger';

export function registerOID4VPRoutes(app: Express): void {

  // ── POST /api/oid4vp/request ──────────────────────────────────────
  app.post('/api/oid4vp/request', (req: Request, res: Response) => {
    try {
      const { verifierDid, definition, ttlSeconds, useMedicalTemplate } = req.body ?? {};

      if (!verifierDid || typeof verifierDid !== 'string') {
        res.status(400).json({ error: 'verifierDid is required' });
        return;
      }

      const def = useMedicalTemplate
        ? buildMedicalCredentialDefinition()
        : definition;

      if (!def || !def.input_descriptors) {
        res.status(400).json({
          error: 'definition with input_descriptors is required (or set useMedicalTemplate: true)',
        });
        return;
      }

      const request = createPresentationRequest(
        verifierDid,
        def,
        typeof ttlSeconds === 'number' ? ttlSeconds : 600,
      );

      res.status(201).json(request);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'oid4vp_request_create_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/oid4vp/request/:id ───────────────────────────────────
  app.get('/api/oid4vp/request/:id', (req: Request, res: Response) => {
    try {
      const request = getPresentationRequest(req.params.id);
      if (!request) {
        res.status(404).json({ error: 'Presentation request not found' });
        return;
      }
      res.json(request);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // ── POST /api/oid4vp/response/:id ─────────────────────────────────
  app.post('/api/oid4vp/response/:id', async (req: Request, res: Response) => {
    try {
      let normalized;
      try {
        normalized = normalizeOID4VPPresentationEnvelope(req.body ?? {});
      } catch (err) {
        if (err instanceof DigitalCredentialEnvelopeError) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: err.message,
            code: err.code,
          });
          return;
        }
        throw err;
      }

      if (!normalized.presentationSubmission || typeof normalized.presentationSubmission !== 'object') {
        res.status(400).json({ error: 'presentation_submission is required' });
        return;
      }

      const result = await verifyPresentationResponse(req.params.id, {
        presentationSubmission:
          normalized.presentationSubmission as PresentationResponseInput['presentationSubmission'],
        // Keep untrusted transport payload unknown. The presentation server
        // validates the representation it supports before credential verification.
        presentationPayload: normalized.presentationPayload,
        state: typeof normalized.state === 'string' ? normalized.state : undefined,
      });

      const status = result.valid ? 200 : 422;
      res.status(status).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'oid4vp_response_error', { requestId: req.params.id, error: msg });
      const status =
        msg.includes('not found') ? 404 :
        msg.startsWith('presentation payload') || msg.includes('expired') || msg.includes('already') ? 400 :
        500;
      res.status(status).json({ error: msg });
    }
  });

  // ── GET /api/oid4vp/result/:id ────────────────────────────────────
  app.get('/api/oid4vp/result/:id', (req: Request, res: Response) => {
    try {
      const result = getPresentationResult(req.params.id);
      if (!result) {
        res.status(404).json({ error: 'Presentation result not found' });
        return;
      }
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/oid4vp/requests ──────────────────────────────────────
  app.get('/api/oid4vp/requests', (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const requests = listPresentationRequests(status as string | undefined as any);
      res.json({ requests, count: requests.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });
}
