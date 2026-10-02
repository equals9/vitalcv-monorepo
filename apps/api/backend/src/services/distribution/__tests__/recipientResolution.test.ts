/**
 * Wave 1072C / C3 — the recipient of a share is resolved, never asserted.
 *
 * The defect these exist to prevent: the backend used to accept whatever
 * `organization_id` string the client sent. `validateOrganizationContext`
 * checks shape and length, not existence, and nothing checked that the chosen
 * opportunity belonged to that organization — so a clinician's packet could be
 * addressed to an organization that had nothing to do with the listing.
 *
 * Written to FAIL if anyone reintroduces client-asserted recipients or
 * synthesises an organization id so a share can proceed.
 */

import { HttpError } from '../../../utils/httpError';
import {
  resolveRecipientForOpportunity,
  DEFAULT_PURPOSE_OF_USE,
} from '../recipientResolution';

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: { opportunity: { findUnique: jest.fn() } },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prisma = require('../../../graphql/prisma_client').default as {
  opportunity: { findUnique: jest.Mock };
};

const OPP = '98c123da-b7c5-41e3-8865-619330c60a14';
const ORG = '9484bf5e-82f4-4b83-ade3-b14cda86e534';
const OTHER_ORG = '11111111-2222-3333-4444-555555555555';

const listing = (over: Record<string, unknown> = {}) => ({
  id: OPP,
  status: 'ACTIVE',
  organizationId: ORG,
  // An employer-posted row whose organization went through setup: the shape
  // the integrated-apply rule accepts. Each refusal case below removes one leg.
  listingSource: 'employer_posted',
  organization: {
    id: ORG,
    name: 'East Bay Access Clinics',
    organizationProfile: { id: '2b1a4e2e-4a7f-4f0e-9d7c-2e0d9b5a1c33' },
  },
  ...over,
});

beforeEach(() => {
  prisma.opportunity.findUnique.mockReset();
});

async function expectStatus(promise: Promise<unknown>, status: number, match: RegExp) {
  await expect(promise).rejects.toThrow(HttpError);
  await expect(promise).rejects.toMatchObject({ status });
  await expect(promise).rejects.toThrow(match);
}

describe('the recipient must be able to receive a share — the integrated-apply rule', () => {
  it('refuses a feed-carried listing: its organization is an ingestion placeholder', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(listing({ listingSource: 'public_feed' }));

    await expectStatus(
      resolveRecipientForOpportunity(OPP),
      409,
      /employer’s own job posting/,
    );
  });

  it('refuses a listing whose organization was never set up (no profile)', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(
      listing({ organization: { id: ORG, name: 'East Bay Access Clinics', organizationProfile: null } }),
    );

    await expectStatus(
      resolveRecipientForOpportunity(OPP),
      409,
      /has not set up applications through VitalCV/,
    );
  });

  it('refuses a listing source this system does not write', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(listing({ listingSource: 'partner_sync' }));

    await expectStatus(resolveRecipientForOpportunity(OPP), 409, /not recognised/);
  });
});

describe('C3 — the recipient comes from the listing, not the client', () => {
  it('resolves the organization that actually owns the opportunity', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(listing());

    const recipient = await resolveRecipientForOpportunity(OPP);

    expect(recipient).toEqual({
      organizationId: ORG,
      organizationName: 'East Bay Access Clinics',
      opportunityId: OPP,
      purposeOfUse: DEFAULT_PURPOSE_OF_USE,
    });
  });

  it('refuses a claimed organization that does not own the listing', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(listing());

    await expectStatus(
      resolveRecipientForOpportunity(OPP, OTHER_ORG),
      409,
      /does not belong to that organization/,
    );
  });

  it('accepts a claimed organization only when it matches the real one', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(listing());
    const recipient = await resolveRecipientForOpportunity(OPP, ORG);
    expect(recipient.organizationId).toBe(ORG);
  });

  it('refuses rather than inventing an id when the listing has no organization', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(
      listing({ organizationId: null, organization: null }),
    );

    await expectStatus(
      resolveRecipientForOpportunity(OPP),
      409,
      /no receiving organization/,
    );
  });

  it('refuses a listing that is no longer accepting applications', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(listing({ status: 'CLOSED' }));

    await expectStatus(
      resolveRecipientForOpportunity(OPP),
      409,
      /no longer accepting applications/,
    );
  });

  it('treats a missing opportunity as a finding, not a fallback', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(null);

    await expectStatus(resolveRecipientForOpportunity(OPP), 404, /no longer exists/);
  });

  /*
   * A non-uuid string reaches a @db.Uuid column as a driver-level throw, which
   * surfaces as a 500 rather than a refusal. The guard must reject the value
   * BEFORE the query, so the database is never asked.
   */
  it.each([
    ['empty', ''],
    ['not a uuid', 'demo-cascade'],
    ['an opportunity title', 'Staff Internist'],
    ['a numeric id', '12345'],
  ])('rejects %s before any query runs', async (_label, id) => {
    await expectStatus(resolveRecipientForOpportunity(id), 400, /valid opportunityId/);
    expect(prisma.opportunity.findUnique).not.toHaveBeenCalled();
  });

  it('defaults purpose of use rather than leaving a share unlabelled', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(listing());

    expect((await resolveRecipientForOpportunity(OPP, undefined, '   ')).purposeOfUse)
      .toBe(DEFAULT_PURPOSE_OF_USE);
    expect((await resolveRecipientForOpportunity(OPP, undefined, 'Locums coverage')).purposeOfUse)
      .toBe('Locums coverage');
  });

  it('refuses to synthesise a recipient name when the record has none', async () => {
    // A share is addressed to a named party. "Unnamed organization" was a
    // placeholder the resolver used to invent; a packet that names it would
    // record a disclosure to nobody in particular.
    prisma.opportunity.findUnique.mockResolvedValue(
      listing({
        organization: { id: ORG, name: null, organizationProfile: { id: '2b1a4e2e-4a7f-4f0e-9d7c-2e0d9b5a1c33' } },
      }),
    );

    await expectStatus(
      resolveRecipientForOpportunity(OPP),
      409,
      /not currently accepting applications through VitalCV/,
    );
  });
});
