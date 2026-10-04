/**
 * W0-06 — the three /issuer demo pages write nothing.
 *
 * Each page builds a ReceiptCandidate from a HARD-CODED demo request. Until
 * this closure they also called the feature-flagged persistence writer, so
 * setting ISSUER_PERSISTENCE_ENABLED=true would have seeded the real
 * ReceiptCandidate table with demo rows every time a page rendered.
 *
 * This suite does NOT mock the writer module. It sets the flag, replaces the
 * Prisma client the writer uses with a spy, renders every page, and asserts
 * the spy never fired. If a page re-introduces the call, the real writer
 * loads, sees the flag, reaches the spy, and this suite goes red. The control
 * case proves the spy is live by driving the writer directly.
 *
 * Only the writer calls were removed. The pure transforms
 * (`receiptCandidate.ts`, `policyReview.ts`) and the truth-contract literals
 * on the rendered pages are unchanged and asserted here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('server-only', () => ({}));

const createMock = vi.fn();
vi.mock('@/lib/db', () => ({
  prisma: {
    receiptCandidate: {
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

import IssuerReviewPage from '../app/issuer/review/[requestId]/page';
import PolicyReviewPage from '../app/issuer/policy-review/[requestId]/page';
import PsvReceiptPromotionPage from '../app/issuer/psv-receipt/[requestId]/page';
import {
  isIssuerPersistenceEnabled,
  writeReceiptCandidateRow,
} from '@/lib/issuer-verification/issuerPersistenceWriter';
import type { ReceiptCandidate } from '@/lib/issuer-verification/types';

type IssuerPage = (props: { params: Promise<{ requestId: string }> }) => Promise<unknown>;

const PAGES: ReadonlyArray<readonly [string, IssuerPage, string]> = [
  ['review', IssuerReviewPage as IssuerPage, 'req-w006-review'],
  ['policy-review', PolicyReviewPage as IssuerPage, 'req-w006-policy'],
  ['psv-receipt', PsvReceiptPromotionPage as IssuerPage, 'req-w006-psv'],
];

const ORIGINAL_FLAG = process.env.ISSUER_PERSISTENCE_ENABLED;

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue({ id: 'row-should-never-exist' });
  process.env.ISSUER_PERSISTENCE_ENABLED = 'true';
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.ISSUER_PERSISTENCE_ENABLED;
  else process.env.ISSUER_PERSISTENCE_ENABLED = ORIGINAL_FLAG;
});

async function render(Page: IssuerPage, requestId: string): Promise<string> {
  const element = await Page({ params: Promise.resolve({ requestId }) });
  return renderToStaticMarkup(element as React.ReactElement);
}

describe('issuer demo pages — no persistence writes', () => {
  it('control: with the flag set, the writer itself DOES reach the spied Prisma client', async () => {
    expect(isIssuerPersistenceEnabled()).toBe(true);
    const candidate: ReceiptCandidate = {
      candidateId: 'control-candidate',
      createdAt: new Date('2026-05-05T12:00:00Z').toISOString(),
      basis: 'issuer_direct',
      sourceOrganizationName: 'Control GME Office',
      attributionStatus: 'unattributed',
      decisionGrade: false,
      requestId: 'control-request',
      proofTier: 'receipt_candidate',
      reviewState: 'review_required',
    };
    const outcome = await writeReceiptCandidateRow({ candidate, surface: 'review_surface' });
    expect(outcome.status).toBe('persisted');
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it.each(PAGES)(
    '/issuer/%s renders with the persistence flag set and writes no ReceiptCandidate row',
    async (_slug, Page, requestId) => {
      const html = await render(Page, requestId);

      expect(createMock).not.toHaveBeenCalled();
      expect(html).toContain('data-recorded-by="demo"');
      expect(html).not.toContain('persistence-banner');
      expect(html).not.toContain('data-persistence-status');
      expect(html).not.toContain('recordedBy: system');
    },
  );

  it('keeps the receipt-candidate truth literals on the review and policy-review renders', async () => {
    for (const [slug, Page, requestId] of PAGES) {
      if (slug === 'psv-receipt') continue;
      const html = await render(Page, requestId);
      expect(html).toContain('data-decision-grade="false"');
      expect(html).toContain('data-proof-tier="receipt_candidate"');
    }
    expect(createMock).not.toHaveBeenCalled();
  });

  it('keeps the psv-receipt promotion contract unchanged (data-promoted="true")', async () => {
    const html = await render(PsvReceiptPromotionPage as IssuerPage, 'req-w006-psv');
    expect(html).toContain('data-promoted="true"');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('policy-review still renders its dry-run actions and outcome', async () => {
    const html = await render(PolicyReviewPage as IssuerPage, 'req-w006-policy');
    expect(html).toContain('data-testid="policy-review-actions"');
    expect(html).toContain('data-testid="dry-run-outcome"');
    expect(html).toContain('Available actions');
    expect(createMock).not.toHaveBeenCalled();
  });
});
