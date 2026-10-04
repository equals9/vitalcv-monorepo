import * as React from 'react';
import { buildReceiptCandidateFromIssuerResponse } from '@/lib/issuer-verification/receiptCandidate';
import {
  applyPolicyReviewDecision,
} from '@/lib/issuer-verification/policyReview';
import {
  promotePsvReceiptCandidate,
} from '@/lib/issuer-verification/psvReceipt';
import {
  PSV_RECEIPT_COPY,
  psvReceiptCopy,
} from '@/lib/issuer-verification/statusCopy';
import { recommendPartnerRoute } from '@/lib/issuer-verification/partnerRouter';
import type {
  IssuerResponse,
  IssuerVerificationRequest,
  PolicyReviewActor,
  PSVReceiptScope,
  VerificationClaimType,
} from '@/lib/issuer-verification/types';

/**
 * ISSUER-4 — PSV Receipt Promotion review surface (demo render).
 *
 * The page does not persist a receipt, does not write a real audit
 * event, and does not finalize credentialing. Promotion produces a
 * scoped PSVReceipt subject to limitations and freshness.
 */

const ACTOR: PolicyReviewActor = {
  actorId: 'demo-promoter',
  displayName: 'Demo Promoter',
  role: 'demo',
};

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function PsvReceiptPromotionPage({ params }: PageProps) {
  const { requestId } = await params;

  const claimType: VerificationClaimType = 'residency';
  const request: IssuerVerificationRequest = {
    requestId,
    claimType,
    claimSummary: 'Residency: Internal Medicine, 2018–2021',
    issuerCandidate: {
      candidateId: 'cand-demo',
      organizationName: 'Demo GME Office',
      contactRole: 'GME Coordinator',
      source: 'clinician_provided',
    },
    route: recommendPartnerRoute(claimType),
    consent: {
      consentId: 'consent-demo',
      scope: 'verify_residency',
      status: 'granted',
    },
    status: 'confirmed',
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T01:00:00.000Z',
    history: [],
  };

  const response: IssuerResponse = {
    responseId: 'resp-demo',
    status: 'confirmed',
    respondedAt: '2026-04-26T01:00:00.000Z',
    responderName: 'J. Doe',
    responderRole: 'Program Coordinator',
    reviewRequired: true,
    freeText: 'Confirmed completion of Internal Medicine residency 2018–2021.',
  };

  const receiptCandidate = buildReceiptCandidateFromIssuerResponse(
    request,
    response,
    {
      receiptCandidateId: `rc-${requestId}`,
      claimId: `claim-${requestId}`,
      auditChannel: 'issuer_response_form',
      recordedBy: 'demo',
    },
  );

  // Render only. This page writes no ReceiptCandidate row and no audit
  // event: the candidate above is a demo transform of a hard-coded request,
  // and a demo must never seed the persistence table (W0-06).

  const policyApplied = applyPolicyReviewDecision(
    receiptCandidate,
    'accept_candidate',
    {
      decisionId: `dec-${requestId}`,
      decidedAt: '2026-04-26T02:00:00.000Z',
      actor: ACTOR,
      recordedBy: 'demo',
      psvCandidateId: `psv-${requestId}`,
    },
  );

  const scope: PSVReceiptScope = {
    claimType,
    covers:
      'Confirms completion of the named residency program with the named source for the stated dates.',
    doesNotCover:
      'Does not confirm board certification, license status, malpractice history, or any other claim.',
    sourceOrganizationName:
      receiptCandidate.sourceBasis?.sourceOrganizationName ?? 'Demo GME Office',
  };

  const promotion = policyApplied.psvReceiptCandidate
    ? promotePsvReceiptCandidate({
        psvReceiptCandidate: policyApplied.psvReceiptCandidate,
        policyReviewDecision: policyApplied.decision,
        originResponseStatus: response.status,
        psvReceiptId: `psv-receipt-${requestId}`,
        promotedAt: '2026-04-26T03:00:00.000Z',
        promotedBy: ACTOR,
        ttlDays: 365,
        scope,
      })
    : undefined;

  const stateCopy = promotion?.promoted
    ? psvReceiptCopy('psv_receipt_promoted')
    : psvReceiptCopy('promotion_blocked');

  return (
    <main
      className="min-h-screen bg-background"
      data-testid="psv-receipt-page"
      data-request-id={requestId}
      data-promoted={String(promotion?.promoted ?? false)}
      data-proof-tier={promotion?.psvReceipt?.proofTier ?? 'none'}
      data-decision-grade={String(
        promotion?.psvReceipt?.decisionGrade ?? false,
      )}
      data-global-credential-truth={String(
        promotion?.psvReceipt?.globalCredentialTruth ?? false,
      )}
      data-audit-event-state={
        promotion?.psvReceipt?.auditMetadata.eventState ?? 'pending_not_written'
      }
      data-recorded-by={receiptCandidate.auditMetadata?.recordedBy}
    >
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <header className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            PSV receipt promotion
          </p>
          <h1 className="text-xl font-semibold text-foreground">
            Promotion review {promotion?.psvReceipt?.psvReceiptId ?? '(blocked)'}
          </h1>
          <p
            className="text-sm text-muted-foreground"
            data-testid="psv-receipt-warning"
          >
            A PSV receipt is scoped evidence. It does not by itself finalize
            credentialing review and remains subject to policy, freshness, and
            source limitations.
          </p>
        </header>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
          aria-label="Candidate summary"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Originating claim
            </p>
            <p className="text-sm text-foreground">{request.claimSummary}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Policy decision
            </p>
            <p className="text-sm text-foreground">
              {policyApplied.decision.action} → {policyApplied.decision.status}
            </p>
            <p className="text-xs text-muted-foreground">
              {policyApplied.decision.outcome.reason}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Source basis
            </p>
            <p className="text-sm text-foreground">
              {receiptCandidate.sourceBasis?.sourceOrganizationName}
            </p>
            {receiptCandidate.sourceBasis?.isContractedAgent && (
              <p className="text-xs text-muted-foreground">
                Responding agent:{' '}
                {receiptCandidate.sourceBasis.agentName}
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Responder attribution
            </p>
            <p className="text-sm text-foreground">
              {receiptCandidate.attributedResponder?.name ?? '(unattributed)'}
            </p>
            {receiptCandidate.attributedResponder?.role && (
              <p className="text-xs text-muted-foreground">
                {receiptCandidate.attributedResponder.role}
              </p>
            )}
          </div>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-3"
          aria-label="Promotion result"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Promotion state
          </p>
          <p className="text-sm text-foreground">{stateCopy.label}</p>
          <p
            className="text-xs text-muted-foreground"
            data-testid="psv-receipt-state-description"
          >
            {stateCopy.description}
          </p>
          {promotion?.message && (
            <p
              className="text-[11px] italic text-muted-foreground/80"
              data-testid="psv-receipt-promotion-message"
            >
              {promotion.message}
            </p>
          )}
          {promotion?.psvReceipt && (
            <>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Scope
                </p>
                <p className="text-xs text-muted-foreground">
                  Covers: {promotion.psvReceipt.scope.covers}
                </p>
                <p className="text-xs text-muted-foreground">
                  Does not cover: {promotion.psvReceipt.scope.doesNotCover}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Limitations
                </p>
                {promotion.psvReceipt.limitations.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    None recorded for this response.
                  </p>
                ) : (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {promotion.psvReceipt.limitations.map((l, i) => (
                      <li key={i}>
                        <strong>{l.kind}:</strong> {l.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Freshness
                </p>
                <p className="text-xs text-muted-foreground">
                  TTL {promotion.psvReceipt.freshness.ttlDays} days; stale after{' '}
                  {promotion.psvReceipt.freshness.staleAfter}.
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80">
                  Audit metadata
                </p>
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="psv-receipt-audit-state"
                >
                  Event state:{' '}
                  {promotion.psvReceipt.auditMetadata.eventState}.{' '}
                  {promotion.psvReceipt.auditMetadata.notes}
                </p>
              </div>
            </>
          )}
        </section>

        <section className="text-[11px] text-muted-foreground/70">
          <p data-testid="psv-receipt-copy">
            Promotion lifecycle copy:{' '}
            {Object.values(PSV_RECEIPT_COPY)
              .map((s) => s.label)
              .join(' · ')}
          </p>
          <p className="mt-2">
            This page does not write a real audit-event row. Audit metadata
            stays in pending_not_written until a real audit service exists in
            the codebase.
          </p>
        </section>
      </div>
    </main>
  );
}
