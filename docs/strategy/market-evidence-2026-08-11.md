# Market evidence — August 2026

**Established:** 2026-08-11 · **Status:** supporting evidence, rank 5 in the
[source-of-truth order](./README.md#source-of-truth-order).

> **Partly superseded 2026-08-18.** [`market-evidence-2026-08-18.md`](./market-evidence-2026-08-18.md)
> corrects [the distribution finding](#the-distribution-finding) — it was closed by #1358 on the day
> this document was established — and adds two facts this document does not carry: the CAQH →
> DataSpring conversion to payer ownership, and the argument that recipient acceptance, not the
> clinician record, is the scarce good. The five rings and the IP constraints below stand unchanged.

**This document does not change the positioning.** `vitalcv-category-strategy.md` and
`vitalcv-strategy-operating-brief.md` stay canonical: the portable professional identity and
employment network for clinicians, NPI as the wedge, `Apply with VitalCV` as the transaction,
employer acceptance intelligence as the moat. Everything below either *supports* those decisions
with 2026 evidence, or adds a constraint the canon does not yet carry.

Two sections **are** binding on engineering regardless of rank, because they are legal and
honesty constraints rather than positioning ones: [IP constraints](#ip-constraints-binding).

---

## The market, in five rings

Measured 2026-08-10/11 from public sources. Numbers are the vendors' own claims unless noted.

### Ring 1 — credentialing / PSV infrastructure. **Do not enter.**

Medallion ($130M raised; ~1M providers; enterprise ARR +106%), CertifyOS ($69M), Andros ($47.9M),
Verifiable ($47M), Axuall (6M clinicians, HealthStream partnership).

**Medallion's CredAlliance already occupies "verify once, reuse everywhere"** — a shared
credentialing clearinghouse for payers, citing $1.2B in annual duplicative cost and claiming
40x onboarding acceleration. Competing here means ~1/50th the capital, no readable licensure
route (`docs/licensure/README.md`: 70 authorities catalogued, zero readable), and a `decisionGrade`
that is literally `false` by design. Our own `docs/licensure/paid-source-procurement.md` says the
reuse economics are unconfirmed for FSMB PDC and AMA Profile and prohibited for NPDB entity
queries — so the amortisation story may not even hold for us.

**Interoperate; do not compete.** Their buyer is the institution and the clinician is a data
source. That asymmetry is structural and it is the opening.

### Ring 2 — clinician employment marketplaces. **Compete on the profile, not the inventory.**

$40.2B US healthcare staffing in 2026 (+2%). Travel nursing contracted to $15.8B (−12% in 2025).
**Locum tenens is the growth segment** — $9.8B, +4%, APP-driven, which is exactly where the
declared NP/PA beachhead points. Incredible Health is at a $1.65B valuation with a flipped model
(hospitals apply to nurses) filling roles in under 20 days against an 80–120 day norm; Vivian has
1.3M+ clinicians; Nomad raised $105M.

We cannot compete on inventory — there are 6 employer-created opportunities, and the ingested
listings are syndicated public-feed rows from employers who have never spoken to VitalCV. What
nobody owns is the portable record the clinician carries *into* all of them.

### Ring 3 — clinician attention. **Be the layer underneath.**

Doximity: FY2026 revenue $644.9M (+13%), 85%+ of US physicians, ~2M professionals. It owns
clinician attention and monetises pharma and recruiters. It does not own employment truth.

### Ring 4 — reusable verification outside healthcare. **The most transferable lesson.**

The Work Number (employer-contributed), Truework (waterfall), Argyle (consumer-permissioned).
Argyle's recorded weakness is aimed directly at us: it *"requires consumer permission, which
doesn't match the standard CRA workflow where the screener initiates the verification."*

**VitalCV is architecturally consumer-permissioned.** If the clinician must initiate before
anything is verifiable, we inherit Argyle's ceiling. The employer-initiated path has to work
equally well — an employer looking up an NPI must land on a VitalCV surface whether or not that
clinician has heard of us.

### Ring 5 — regulatory structure. **All four vectors favour the canon.**

- **CMS-4208-F2**: from 2026-10-01 CMS ingests Medicare Advantage provider data from plans' own
  FHIR APIs; a National Provider Directory is in development. National directory accuracy ~50%.
- **Licensure compacts**: IMLC 43–44 states, NLC 43 jurisdictions, APRN Compact live, PA Compact
  implementing. Portability is becoming *legally* real — the literal tailwind under "build once,
  move forward without starting over."
- **NCQA 2026**: CVO Certification folded into one Credentialing program; verification window
  tightened to 120 days (Accreditation) / 90 (Certification); >50% of PSV delegable to certified
  delegates. Six months of operations plus $1–2M E&O before applying — a clock the Tier-1
  procurement GO already started.
- **AI hiring law**: Colorado replaced SB 205 with the narrower SB 26-189 (May 2026); NYC LL144
  bias audits hit the 2027 filing cycle; the EU AI Act classes recruitment screening as high-risk.
  Direction of travel is **transparent, auditable, human-supervised decisions**.

That last point is a genuine asset. Competitors screening with AI (Mercor's low-human-review
sourcing, Incredible Health's asynchronous voice interviewer) accumulate regulatory exposure. A
deterministic engine plus provenance plus a consent ladder is natively compliant with where the
law is going. **We are not behind on AI screening; we are early on auditable screening.**

## Trends that bear on decisions

- **Digital provenance is a top Gartner 2026 digital-trust trend** — *"prove what is authentic
  instead of chasing the correction of what is false."* Provenance is our product at the moment
  provenance became the trend.
- **Share of model is displacing share of search.** The metric is citation rate inside generated
  answers. LLM-referred traffic converts 4.4x–23x above organic, and most B2B has not started.
- **Agentic UX converged on the pattern EC-8 already states** — planning visibility, tool-use
  disclosure, override at any point, autonomy that expands as trust is earned; AI output as a
  first-class surface, not a chat widget. Gartner: 40% of enterprise apps embed task-specific
  agents by end-2026. EC-8's "AI manifests as work, not chat" was written a year early.
- **Design split into two aesthetics** (techno-futurist vs editorial) and picking one is
  non-negotiable. EC-20 already sits in restrained techno-futurist.

## The distribution finding

The canon says what the product is. It did not say how a clinician who has never heard of VitalCV
first meets it. The answer was already built and wired to nothing:

`/directory/[npi]` renders for **any** NPI in the federal registry — canonical, `Physician`
JSON-LD, hourly revalidation, noindex fallback, and a banner stating what the filing is not. It
had zero inbound links, zero sitemap presence, no way to act on it, and no analytics.

> **Closed 2026-08-11 by #1358** (`7de868d9d`), the same day this was written. Analytics, the claim
> CTA, the sitemap route and seed, and an inbound link all shipped. **Do not propose this as
> untapped work** — read `apps/web/components/directory/RecordAnalytics.tsx` and
> `apps/web/app/directory/sitemap.ts` on `origin/main` first. The only lever still unpulled is the
> `DIRECTORY_SITEMAP` founder flip described below.

This is the acquisition surface, and it is the only strategy that works at zero demand density,
because it runs on public NPPES data for clinicians who have never heard of us. It needs no
licensure access, so it is not blocked behind "L1 FSMB — needs Chris." It is consistent with the
canon rather than a replacement for it: it is *how* the reusable profile gets its first clinician.

**Standing consequences for builders:**

- `/directory/[npi]` is the public acquisition surface. `/verify/[npi]` is a reviewer's tool and
  is `noindex, nofollow` on consent grounds (#1329) — a link from it carries no crawl signal.
- Advertising provider pages to crawlers is gated on `DIRECTORY_SITEMAP`, off until a founder
  ruling. Whether to show the public record for someone who never enrolled is a **consent
  decision**, not a copy fix. *(Founder ruled GO 2026-09-30 — see
  [`market-evidence-2026-08-18.md`](./market-evidence-2026-08-18.md) §1.)*
- Removal requests are honoured through `EXCLUDED_NPIS`, which drops the NPI from the sitemap
  **and** noindexes that record's page. Honouring half of it would tell someone they were removed
  while their page stayed indexed.

## IP constraints (binding)

These bind engineering regardless of this document's rank, because they are legal constraints
rather than positioning preferences.

### 1. Presentation-exchange design-around — Axuall US 12,079,891

Full note: [`fto-axuall-12079891.md`](./fto-axuall-12079891.md).

Axuall's independent claims describe: configure rules on required credential attributes → define a
requisite collection → send it to a **holder** as a presentation request → receive the holder's
proposal → verify a cryptographic proof of validity, non-revocation and ownership against a
registry. `apps/api/backend` already implements an OID4VP layer that reads onto most of it; what
keeps the question small is that **no product surface invokes it**, pinned by
`apps/web/__tests__/presentation-exchange-baseline.test.ts`.

**Until counsel says otherwise, build acceptance intelligence so the claim does not read on it:**

- Evaluate employer requirements **server-side against VitalCV-held source reads** (NPPES, OIG,
  PECOS) — not by requesting a presentation from the clinician.
- Do not source the requirement set from a schema stored on a verifiable data registry.
- Do not put the clinician in the loop as a credential-presenting holder.

This is not a compromise. Verification by reading the source of truth is what the truth contract
already describes and what the product already does.

### 2. The name is not a blocker, but it is not clean either

Full note: [`name-clearance-2026-08-10.md`](./name-clearance-2026-08-10.md). Keep the name; do not
rename. But `did:web:vitalcv.com` is the `issuerDid` on signed receipts, so a rename gets more
expensive per artifact — if it is ever going to happen it happens before receipt volume matters.
There is another VitalCV in recruiting (Azerbaijani HR startup) still listing vitalcv.com, which
is brand ambiguity in exactly the share-of-model channel this document recommends. Commission a
real clearance search before the first pilot contract.

## What this does not change

Nothing here licenses a claim the truth contract forbids. Every number above describes a
*competitor's* market or a regulatory fact; none of it may appear in customer-facing copy as a
VitalCV claim. No speed claims, no verification guarantees, no compliance certifications. Rank 4
still outranks this document, and a positioning decision never outranks an honesty one.
