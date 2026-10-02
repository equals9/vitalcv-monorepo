import * as React from 'react';
import {
  PARTNER_CATEGORY_LABEL,
  recommendPartnerRoute,
} from '@/lib/issuer-verification/partnerRouter';
import {
  buildReceiptCandidateFromIssuerResponse,
} from '@/lib/issuer-verification/receiptCandidate';
import {
  REVIEW_STATE_COPY,
  reviewStateCopy,
} from '@/lib/issuer-verification/statusCopy';
import type {
  IssuerResponse,
  IssuerVerificationRequest,
  VerificationClaimType,
} from '@/lib/issuer-verification/types';
import { Reveal } from '@/components/motion/Reveal';

/**
 * ISSUER-2 — Receipt-candidate review surface.
 *
 * Demo render only. The page does not persist final decisions, does
 * not write audit events, and does not mark anything as verified.
 * Submitting on this page would record a policy review action — and
 * even then, only a policy-review decision can convert a candidate
 * into a PSV receipt.
 */

const NEXT_ACTIONS: ReadonlyArray<{ key: string; label: string; description: string }> = [
  {
    key: 'review_policy',
    label: 'Review against policy',
    description:
      'Open the policy checklist for this candidate. Approval here does not finalize verification on its own.',
  },
  {
    key: 'request_corrected_details',
    label: 'Request corrected details',
    description: 'Ask the issuer to clarify or correct the response.',
  },
  {
    key: 'request_release',
    label: 'Request release',
    description:
      'Send the additional release form the issuer requires before continuing.',
  },
  {
    key: 'reroute_request',
    label: 'Reroute the request',
    description:
      'Forward the request to another office named by the issuer.',
  },
  {
    key: 'reject_candidate',
    label: 'Reject candidate',
    description:
      'Discard the candidate. This does not affect any other proof on file.',
  },
];

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function IssuerReviewPage({ params }: PageProps) {
  const { requestId } = await params;

  // Demo data — no DB read. Realistic shape so the surface exercises
  // the builder end to end.
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
    createdAt: '2026-04-25T00:00:00.000Z',
    updatedAt: '2026-04-25T01:00:00.000Z',
    history: [],
  };

  const response: IssuerResponse = {
    responseId: 'resp-demo',
    status: 'confirmed',
    respondedAt: '2026-04-25T01:00:00.000Z',
    responderName: 'J. Doe',
    responderRole: 'Program Coordinator',
    reviewRequired: true,
    freeText: 'Confirmed completion of Internal Medicine residency 2018–2021.',
  };

  // Build the candidate first as a demo-recorded shape so the page
  // always renders even when the persistence writer is off or fails.
  const candidate = buildReceiptCandidateFromIssuerResponse(request, response, {
    receiptCandidateId: `rc-${requestId}`,
    claimId: `claim-${requestId}`,
    auditChannel: 'issuer_response_form',
    recordedBy: 'demo',
  });

  // Render only. This page writes no ReceiptCandidate row and no audit
  // event: the candidate above is a demo transform of a hard-coded request,
  // and a demo must never seed the persistence table (W0-06).

  const reviewCopy = reviewStateCopy(
    candidate.reviewState ?? 'ready_for_policy_review',
  );

  return (
    <main
      className="mz mz-paper mz-persona-issuer relative min-h-screen overflow-x-hidden"
      data-testid="issuer-review-page"
      data-receipt-candidate-id={candidate.receiptCandidateId}
      data-review-state={candidate.reviewState}
      data-proof-tier={candidate.proofTier}
      data-decision-grade={String(candidate.decisionGrade)}
      data-recorded-by={candidate.auditMetadata?.recordedBy}
    >
      {/* Hero — ambient wash + weighted glass panel (the attester's desk). */}
      <section className="mz-ambient relative isolate">
        <div className="mx-auto max-w-2xl px-4 pt-14 pb-2">
          <Reveal
            as="header"
            variant="fade"
            className="mz-glass-strong space-y-3 rounded-[14px] p-6 sm:p-8"
          >
            <p className="mz-eyebrow">Issuer review</p>
            <h1 className="mz-h1">
              Receipt <span className="mz-accent">candidate</span>{' '}
              <span className="mz-mono align-middle text-[0.5em] font-normal tracking-[0.06em] text-[var(--vt-text-secondary)]">
                {candidate.receiptCandidateId}
              </span>
            </h1>
            <p
              className="mz-body text-[var(--vt-text-secondary)]"
              data-testid="receipt-candidate-warning"
            >
              This is a receipt candidate, not final verification.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 space-y-5">
        <Reveal
          as="section"
          className="mz-glass space-y-5 rounded-[12px] p-6"
          aria-label="Request and claim summary"
        >
          <div>
            <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              Request
            </p>
            <p className="mz-body mt-1 text-[var(--vt-text-primary)]">{request.requestId}</p>
          </div>
          <div>
            <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              Claim
            </p>
            <p className="mz-body mt-1 text-[var(--vt-text-primary)]">{request.claimSummary}</p>
            <p className="mz-small mt-1 text-[var(--vt-text-secondary)]">
              Recommended route: {PARTNER_CATEGORY_LABEL[request.route.partnerCategory]}
            </p>
          </div>
          <div>
            <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              Issuer
            </p>
            <p className="mz-body mt-1 text-[var(--vt-text-primary)]">
              {request.issuerCandidate.organizationName}
            </p>
            {request.issuerCandidate.contactRole && (
              <p className="mz-small mt-1 text-[var(--vt-text-secondary)]">
                {request.issuerCandidate.contactRole}
              </p>
            )}
          </div>
        </Reveal>

        <Reveal
          as="section"
          delay={80}
          className="mz-glass space-y-5 rounded-[12px] p-6"
          aria-label="Issuer response"
        >
          <div>
            <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              Response status
            </p>
            <p className="mz-body mt-1 capitalize text-[var(--vt-text-primary)]">
              {candidate.responseStatus?.replace(/_/g, ' ')}
            </p>
            {candidate.responseSummary && (
              <p className="mz-small mt-1 text-[var(--vt-text-secondary)]">
                {candidate.responseSummary}
              </p>
            )}
          </div>
          <div>
            <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              Responder attribution
            </p>
            <p className="mz-body mt-1 text-[var(--vt-text-primary)]">
              {candidate.attributedResponder?.name ?? '(unattributed)'}
            </p>
            {candidate.attributedResponder?.role && (
              <p className="mz-small mt-1 text-[var(--vt-text-secondary)]">
                {candidate.attributedResponder.role}
              </p>
            )}
          </div>
          <div>
            <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              Source basis
            </p>
            <p className="mz-body mt-1 text-[var(--vt-text-primary)]">
              {candidate.sourceBasis?.sourceOrganizationName}
            </p>
            {candidate.sourceBasis?.isContractedAgent && (
              <p className="mz-small mt-1 text-[var(--vt-text-secondary)]">
                Responding agent: {candidate.sourceBasis.agentName}
              </p>
            )}
            {candidate.sourceBasis?.basisNote && (
              <p className="mz-small mt-1 italic text-[var(--vt-text-secondary)]">
                {candidate.sourceBasis.basisNote}
              </p>
            )}
          </div>
          {candidate.limitationNote && (
            <div className="space-y-2">
              <span className="mz-chip mz-chip-watch">
                <span className="mz-gl" aria-hidden="true" />
                Limitation
              </span>
              <p className="mz-small italic text-[var(--vt-text-secondary)]">
                {candidate.limitationNote}
              </p>
            </div>
          )}
          <div>
            <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              Review state
            </p>
            <p className="mz-body mt-1 text-[var(--vt-text-primary)]">{reviewCopy.label}</p>
            <p className="mz-small mt-1 text-[var(--vt-text-secondary)]">{reviewCopy.description}</p>
          </div>
        </Reveal>

        <Reveal
          as="section"
          delay={120}
          className="mz-glass rounded-[12px] p-6"
          aria-label="Next actions"
        >
          <h2 className="mz-h2">Next actions</h2>
          <ul className="mt-4 space-y-2.5" data-testid="receipt-candidate-actions">
            {NEXT_ACTIONS.map((action) => (
              <li
                key={action.key}
                className="mz-glass-inset rounded-[10px] p-4"
                data-action-key={action.key}
              >
                <p className="mz-body font-medium text-[var(--vt-text-primary)]">{action.label}</p>
                <p className="mz-small mt-0.5 text-[var(--vt-text-secondary)]">{action.description}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 mz-small italic text-[var(--vt-text-muted)]">
            Submitting on this page does not finalize verification. Only a
            policy-review decision can convert a candidate into a PSV receipt.
          </p>
        </Reveal>

        <Reveal
          as="section"
          delay={160}
          className="border-t border-[var(--vt-border-subtle)] pt-6"
        >
          <p
            data-testid="review-state-copy"
            className="mz-small text-[var(--vt-text-muted)]"
          >
            All review states keep the candidate distinct from finalized
            verification: {Object.values(REVIEW_STATE_COPY).map((s) => s.label).join(' · ')}
          </p>
        </Reveal>
      </div>
    </main>
  );
}
