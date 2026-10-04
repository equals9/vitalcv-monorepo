# VitalCV strategy — canonical index

Two documents are canonical for positioning, homepage messaging, customer-facing
vocabulary, public information architecture, roadmap sequencing, and product
prioritization.

| Document | Role |
| --- | --- |
| [`vitalcv-category-strategy.md`](./vitalcv-category-strategy.md) | The **full rationale** — the complete strategic argument, market evidence, and the reasoning behind each decision. Read this to understand *why*. |
| [`vitalcv-strategy-operating-brief.md`](./vitalcv-strategy-operating-brief.md) | The **day-to-day decision contract** — what to build, what to call it, what to remove. Read this to decide *what to do today*. |

Both are founder-approved and dated 2026-08-04.

## The decisions these documents lock

**The reusable clinician profile is the product.** Not a résumé builder, not a
credentialing vendor, not a wallet, not a document vault, not a generic job
board, not a blockchain product, not an evidence visualization system. Those
capabilities may exist underneath; they do not define the customer-facing
category.

> VitalCV is the portable professional identity and employment network for clinicians.

**NPI is the acquisition wedge.** It creates an immediate, healthcare-specific
action with almost no user effort, and it is why "no account needed to preview"
works.

**`Apply with VitalCV` is the canonical transaction.** Everything the clinician
does converges on sending a profile they have reviewed, instead of rebuilding
their professional history.

**Employer acceptance intelligence is the long-term network advantage** — what
each organization accepts, for which roles, under which conditions. It is the
deepest differentiator and the hardest thing for a competitor to copy.

**North-star metric:**

> Clinician starts enabled by a reused VitalCV profile

Not profiles created. Not checks run. Not packets generated. Those measure
activity; the north star measures whether the product worked.

## Customer-facing architecture

Customers should need to remember four things:

1. **VitalCV** — the company and network
2. **Your VitalCV profile** — the reusable professional identity
3. **VitalCV Jobs** — the opportunity marketplace
4. **Apply with VitalCV** — the canonical transaction

Everything else is infrastructure or task-specific language.

## Source-of-truth order

When instructions conflict, this is the precedence:

1. Founder instructions in the current task
2. `vitalcv-strategy-operating-brief.md`
3. `vitalcv-category-strategy.md`
4. Current security, privacy, and truth contracts
5. Existing implementation and older strategy documents

Note what rank 4 means: these documents govern **what the product says it is**.
They do not license a claim the truth contract forbids, and they do not relax a
security or privacy boundary. A positioning decision never outranks an honesty
one.

## Older documents in this directory

[`competitive-mandate.md`](./competitive-mandate.md) and
[`one-platform-synthesis-2026-07-25.md`](./one-platform-synthesis-2026-07-25.md)
predate these and both claim authority over homepage messaging. Where they
conflict, **the two canonical documents win**. Each now carries a superseded
notice at its head rather than being deleted — the competitive analysis and the
evidence register in them remain useful, and quietly reconciling them would
leave two contradictory mandates in the tree with nothing recording which one a
reviewer should follow.

## Audits and plans (Wave 1077 PR C)

| Document | What it answers |
| --- | --- |
| [`customer-language-inventory.md`](./customer-language-inventory.md) | Every retired term, classified against what the code actually renders |
| [`information-architecture-audit.md`](./information-architecture-audit.md) | What the navigation says vs what routes exist, plus a gap list |
| [`beachhead-decision.md`](./beachhead-decision.md) | Six candidates on verifiable evidence; two finalists; awaiting `FOUNDER BEACHHEAD DECISION` |
| [`90-day-category-execution-plan.md`](./90-day-category-execution-plan.md) | The mandate with each item's real status and baseline |

## Evidence and constraints (2026-08)

| Document | What it answers |
| --- | --- |
| [`market-evidence-2026-08-11.md`](./market-evidence-2026-08-11.md) | The competitive map in five rings, the 2026 trend read, and where a clinician who has never heard of VitalCV first meets it. Supporting evidence for the canon, not a replacement — but its **IP constraints section binds engineering**. |
| [`market-evidence-2026-08-18.md`](./market-evidence-2026-08-18.md) | Addendum to the above. Corrects the distribution finding (closed by #1358), records that the reusable-profile incumbent CAQH/DataSpring is now payer-owned, and argues that **recipient acceptance, not the clinician record, is the scarce good** — which makes the record-first build order in every current program backwards. |
| [`fto-axuall-12079891.md`](./fto-axuall-12079891.md) | Axuall's patent read against the OID4VP layer already in `apps/api/backend`, and the design-around acceptance intelligence must respect until counsel says otherwise |
| [`name-clearance-2026-08-10.md`](./name-clearance-2026-08-10.md) | Whether to rename (no), what a rename costs as receipt volume grows, and what counsel still needs to clear |
| [`credentialing-category-attack-surface-2026-08-17.md`](./credentialing-category-attack-surface-2026-08-17.md) | The credentialing-platform buyer's grid (Medallion, symplr, CertifyOS, Verifiable, Assured), which of its five columns are unwinnable, the one that changed hands in 2026, and nine attack surfaces ranked by fit to capability we already hold |
| [`review-reuse-research-2026-09-10.md`](./review-reuse-research-2026-09-10.md) | An external research package's NARROW verdict — reuse an employer's completed *review*, not just the evidence — claim-checked against `main` and its own sources: the product has no second-review entry point yet, this is the third model of the idea, 482.22 telemedicine reliance is the narrow federal precedent, and the three founder-owned gates before anything else is built |

Those IP sections bind regardless of this directory's rank: they are legal and
honesty constraints rather than positioning preferences, and rank 4 has always
outranked positioning.

## Decision filter

See [`product-decision-filter.md`](./product-decision-filter.md). A proposal
moves forward only when it materially strengthens at least one of the seven
listed outcomes.
