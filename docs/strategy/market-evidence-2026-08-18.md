# Market evidence addendum — 18 August 2026

**Established:** 2026-08-18 · **Status:** supporting evidence, rank 5 in the
[source-of-truth order](./README.md#source-of-truth-order). Addendum to
[`market-evidence-2026-08-11.md`](./market-evidence-2026-08-11.md), which stays valid except
where §1 corrects it.

**This document does not change the positioning.** `vitalcv-category-strategy.md` and
`vitalcv-strategy-operating-brief.md` stay canonical. What follows either corrects a finding that
has since been built, or adds a fact the canon does not yet carry.

One section — §3 — argues that the **build order** in every current program is backwards. That is
a sequencing claim, not a positioning one. It does not touch what the product is called or what it
says it is.

---

## 1. Correction — the distribution finding is closed

The 08-11 document says `/directory/[npi]` "**had** zero inbound links, zero sitemap presence, no
way to act on it, and no analytics." The past tense is accurate and load-bearing, and it has
already been misread as a present-day opportunity.

**[#1358](https://github.com/ctol3r/vitalcv/pull/1358) (`7de868d9d`) landed 2026-08-11 — the same
day that document was established — and closed all four:**

| Gap as written | Closed by |
| --- | --- |
| no analytics | `apps/web/components/directory/RecordAnalytics.tsx` — `RECORD_VIEWED` and `CLAIM_CLICKED` funnel events |
| no way to act on it | `ClaimRecordLink` → `/onboarding?npi=` |
| zero sitemap presence | `apps/web/app/directory/sitemap.ts`, a 4,955-NPI seed, and `apps/web/app/robots.ts` |
| zero inbound links | `apps/web/app/verify/[npi]/page.tsx` — though that page is `noindex, nofollow`, so the link carries no crawl signal |

**What remains open is one decision, not one build.** `directorySitemapEnabled()` in
`apps/web/lib/directory/sitemapSeed.ts` reads `DIRECTORY_SITEMAP === 'enabled'`, unset in
production. The code ships complete and inert, staged the way `CLERK_JWT_VERIFICATION` and
`VERIFIER_RBAC_MODE` are staged, because flipping it advertises clinicians who never enrolled to
search engines. #1329 named that as a consent decision and declined to answer it in a code review.
It is still unanswered.

> **Answered 2026-09-30 — founder GO** on the question below: publish the seed. The lever is
> unchanged — `DIRECTORY_SITEMAP=enabled` on the Railway web service — and setting it is a
> separate act from the ruling. Check production `robots.txt` for `/directory/sitemap/0.xml`
> before treating the section as advertised.

**What the flip would actually publish**, from `apps/web/lib/directory/sitemap-seed.json`:

| | |
| --- | --- |
| Count | **4,955 NPIs** |
| Source | CMS Doctors & Clinicians National Downloadable File (`mj5m-pzi6`), retrieved 2026-08-10 |
| Specialties | Nurse practitioner, physician assistant — **only** |
| States | TX, CA, FL, NY, PA, OH, IL, NC, GA, MI |
| Sampling | 250 per specialty-state bucket, matching the declared beachhead |

So the decision is not "publish every clinician." It is: **should ~4,955 NP/PAs across ten states,
none of whom have heard of VitalCV, have a VitalCV page advertised to search engines?** Removal is
already honoured through `EXCLUDED_NPIS`, which drops the NPI from the sitemap **and** noindexes
that record's page.

**For builders:** check `RecordAnalytics.tsx` and `app/directory/sitemap.ts` on `origin/main`
before proposing directory work. The only lever left is the Railway variable.

---

## 2. The reusable-profile incumbent is no longer neutral

Researched 2026-08-17 from public sources. `vitalcv-category-strategy.md` already names
"DataSpring, formerly CAQH." It does not carry the fact that makes the rename matter.

| Fact | Detail |
| --- | --- |
| Corporate form | Nonprofit → **for-profit, January 2026** |
| Ownership | **12 shareholder companies affiliated with health plans** — UnitedHealth Group, Centene, Aetna, Elevance, Cigna, Humana, several Blues |
| Governance | Board chaired by a UnitedHealth executive; a Centene executive as vice chair |
| Rebrand | **DataSpring, powered by CAQH**, 8 June 2026 |
| Scale | ~4.8M records sourced directly from clinicians |
| Clinician terms | Portal name kept; still free to clinicians; **120-day re-attestation unchanged** |

The ADA publicly raised the payer-owner data-access concern, reported reassurance on services,
pricing and privacy, and committed to holding the company to its free-service agreement — an
association monitoring a counterparty it no longer controls.

**Why this is the most useful competitive fact in this directory:** roughly 4.8 million clinicians
perform unpaid, recurring, deadline-driven data work into a for-profit company owned by the
organizations that consume the output. Every vendor in the credentialing grid integrates *with*
that record. None is an alternative to it.

> ⚠️ **Attribution precision.** Medallion's "CAQH Management" product name and launch are confirmed
> from Medallion's own release, which gives **no functional detail**. Any reading of what it does
> beyond the name is an inference from the name plus their organization-side buyer. Do not state it
> as fact.

**This does not license a customer-facing claim.** Nothing here may appear in copy as a VitalCV
claim about a competitor, and the rule in the 08-11 document's closing section applies unchanged.

---

## 3. The inversion — acceptance is the scarce good, not the record

Established 2026-08-11, answering the strongest objection to the whole thesis: *CAQH already is the
reusable clinician profile, it is free and universal, and it became a chore.*

**CAQH did not fail on the supply side.** Clinicians demonstrably do maintain a reusable
professional record — universally, every 120 days, for two decades. The willingness the VitalCV
thesis assumes is already proven at national scale. That is the good news and it is also the
problem.

**It failed on the demand side.** The universal complaint is not data entry. It is that the portal
is meant to reduce repeated applications across payers, and payers still request the same
information separately. The clinician does the work and still gets asked. That is what turns an
asset into a chore.

**Therefore the scarce good is not a reusable clinician record.** That exists, is free, is
universal, and is twenty years old. **The scarce good is recipient acceptance** — a binding reason
the receiving organization asks for less *because* the record exists.

This is the same structure Ring 4 of the 08-11 document identifies from the other direction:
Argyle's recorded weakness is that consumer-permissioned verification does not match the workflow
where the screener initiates. VitalCV is architecturally consumer-permissioned. Both findings land
on the same place — **the clinician's willingness is not the constraint; the recipient's behaviour
is.**

**The sequencing consequence.** Every current program builds in the same order: clinician record →
make it useful → *then* pursue employer acceptance. That order puts the replicable half first and
defers the defensible half. The record has already been replicated once at national scale, and the
verification half is being replicated now with $130M behind it.

**How to apply.** The wedge test is not *"what makes a clinician build a record?"* It is
**"what makes one employer ask for less?"** Sequence backwards from that answer. This is a
recommendation about ordering, not authority to skip a gate: it does not change the truth contract,
the consent ladder, or the IP constraints in the 08-11 document, all of which still bind.

---

## 4. The measurement that makes §3 concrete

Measured 2026-08-15 against production `/api/opportunities?limit=500`:

```
total: 498   truncated: false
applicationMode: external      498 / 498
isFeedListing:   true          498 / 498
credentialRequirements non-empty:  0 / 498
payRange present:                  0 / 498
```

Supply is 8 employers, and 65% of it is one employer.

**`Apply with VitalCV` — the canonical transaction in the canon — has zero live instances.** Every
role sends the clinician to the employer's own site, so the downstream loop (packet → employer
review → acceptance → hire-to-start → reuse) has no entry point from public discovery, however much
of it is built.

**The code is not the reason.** `apps/web/app/api/employer/opportunities/route.ts`,
`apps/web/app/api/opportunities/[id]/apply/route.ts`, and the requirement-building branch in
`apps/api/backend/src/services/opportunities/opportunityTruth.ts` are all present on `main`; requirements are built for any non-feed listing.
The machinery for a role with structured requirements and integrated apply is waiting. Zero
employers have ever created one.

This is the §3 argument stated as a number: the record side is built and the acceptance side is
empty, and no additional record-side work changes that.

---

## What this does not change

Nothing here licenses a claim the truth contract forbids. Every figure above describes a
competitor's market, a regulatory fact, or our own measured state; none of it may appear in
customer-facing copy as a VitalCV claim. No speed claims, no verification guarantees, no compliance
certifications. Rank 4 still outranks this document, and a positioning decision never outranks an
honesty one.
