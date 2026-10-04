# Review reuse — research intake, 10 September 2026

**Established:** 2026-09-10 · **Status:** supporting evidence, rank 5 in the
[source-of-truth order](./README.md#source-of-truth-order).

**This document does not change the positioning.** The two canonical documents stay canonical.
It records what an external first-principles research package concluded, what survived a
claim-check against `main` and against its own sources, and the one code change it justified.

The package's verdict is **NARROW**: make an employer's *completed review* reusable under explicit
conditions the employer sets, starting with one hospital employer, one NP/PA cohort, and one second
review in which that employer agrees to ask for less. That is the operational form of §3 of
[`market-evidence-2026-08-18.md`](./market-evidence-2026-08-18.md) — *what makes one employer ask
for less?* — not a new thesis. What it adds is a precise mechanism, and a precise account of why
nothing we have built yet produces it.

---

## 0. What arrived, and what was re-run

| Item | Check | Result |
| --- | --- | --- |
| Package manifest (18 files) | SHA-256 of every file against `SHA256SUMS.json` | 18/18 match |
| Research kernel v0.1 (Node, no dependencies) | `node --test`, re-run here on Node 24.10 | **52/52 pass**, including a seeded 200-mutation oracle |
| Synthetic demo | re-run | 20 review duties → 18 reused, 2 open, as reported |
| Local benchmark | re-run, 1,000 warmed evaluations, no I/O | p95 **0.81 ms** here; the package reports 1.60 ms on its host. Neither is a production latency or a workload measurement |
| Repository claims | against `main` after [#1459](https://github.com/ctol3r/vitalcv/pull/1459), the tree the package audited | §2 |
| External citations | all 12 fetched live on 2026-09-10 | §3 |

**Not re-run:** the package's count of public opportunities (390 listings, 8 organizations, 10
September). Standing rule: no probes against production without a per-session founder OK. The last
in-repo measurement is 498 listings across 8 employers, zero with credential requirements
([08-18 addendum §4](./market-evidence-2026-08-18.md)). Treat 390 as the package's claim.

---

## 1. The mechanism, and why it is the right one

The package separates two things every current program treats as one:

- **Evidence reuse** — the facts are still true and fresh enough.
- **Review reuse** — the *procedure* an institution requires has already been performed, by
  someone it recognizes, under rules that have not changed.

Evidence equality is neither necessary nor sufficient for review reuse. A same-meaning source
refresh can leave a completed review usable. Identical evidence can require a new review because
the role, the policy, the jurisdiction or the reviewer's authority changed. A record diff cannot
answer the second question, which is why §5's fix matters and why it is not enough.

The design constraints it proposes are ones this repo already holds, restated:

1. Unknown and degraded states never become support. Missing evidence is not a negative finding.
2. Source-effective time is distinct from fetch time.
3. A reused duty needs the **receiving** institution's explicit permission. Consent to share with
   A never implies consent to share with B. A→B plus B→C never implies A→C.
4. Supported evidence, employer acceptance and an actual start stay separate facts. The existing
   acceptance and start writers remain the only decision writers. Any evaluator returns
   `decisionGrade: false`.

**Vocabulary.** The package's internal category name, *Institutional Reliance Infrastructure*, is a
positioning hypothesis and stays internal. It fails the [decision filter](./product-decision-filter.md)
as a customer-facing term (a new top-level brand for an internal mechanism). The four things a
customer remembers do not change. Its plain employer-side states — *already reviewed, needs review,
needs a source update, decision pending* — are candidates for employer copy only after an EC-9
vocabulary check.

**Decision filter.** Passes *greater employer acceptance* and *more profile reuse*: the user is an
employer's reviewer, and the changed outcome is fewer duties re-performed on a second review. It
passes only if a recipient actually omits work. No software change can produce that.

---

## 2. Claim-check — the repository

| Package claim | What `main` shows | Verdict |
| --- | --- | --- |
| Canonical `EvidenceObject` / `EvidenceCollection` exist; do not build a second core | `packages/domain-evidence/src/types.ts`, ~40 importers in `apps/web`. **No `method` field and no source-effective time** — only `observedAt` / `checkedAt`. The production mapper never emits the `superseded` lifecycle | Confirmed, with a gap the package names as a precondition: under its own rule, every projection of today's evidence would be *incomplete* |
| TrustSpec is a strict validator with no consumers | `trust-computing/trustSpec.ts` says so itself; validates, evaluates nothing | Confirmed |
| Employer and start services are the real writers | `EmployerAcceptance` has exactly two writers, pinned by `acceptanceWriterInventory.test.ts`. The Door B review accept freezes a source snapshot into `metadata`; the Door A workflow accept (`employerWorkflowService.ts`) stores none. `applicationStartCommandService.ts` is the only start-attestation writer | Confirmed |
| The acceptance diff mis-reports degraded transitions and current revocation | Reproduced exactly (§5) | **Confirmed — fixed in this PR** |
| Historical bench pass counts are not current results | Not in `main` | Confirmed |

Three facts the package did not state, and which matter more than any of the above:

1. **There is no second review in the product.** The accept-time snapshot is written and never
   read. The diff renders only on the preview-gated `/design/acceptance-diff` reference, which 404s
   in production. A second acceptance for the same employer and NPI is refused as already accepted.
   The package's defining moment has no entry point.
2. **This is the third model of the same idea.** `docs/trust-computing/PTC_ARCHITECTURE_MAP.md`
   already describes a second employer reusing evidence and review facts and showing *evaluated
   versus reused*. `packages/domain-evidence/src/minimum-friction/` already carries a rule that a
   valid prior answer can be reused, and plans a fixture for a second employer reusing state. Both
   are unreachable: the package exports only `"."` and its index re-exports neither. The research
   kernel would be the third unwired model. It is not being added (§7).
3. **Door A has no snapshot at all.** Any reuse from the workflow accept path starts from nothing.

---

## 3. Claim-check — external sources

All twelve sources exist. Nine support the claim as written. Three are used more broadly than the
source supports.

| Source | Finding |
| --- | --- |
| 42 CFR 482.22(a)(3)–(4) | **Supports, and is narrow.** A hospital's governing body *may choose*, instead of its own (a)(1)–(a)(2) process, to rely on the credentialing and privileging decisions of a distant-site hospital or telemedicine entity, under a written agreement. Conditions: Medicare participation (distant-site hospitals only); privileges held at the distant site, with a current list supplied; a licence valid where the patients are; and the receiving hospital sends back its internal review of the practitioner's performance, including at minimum all adverse events and complaints. (a)(1) itself says nothing about reliance |
| Medallion CredAlliance | Vendor claims only ("credential once, share across the network"). Its logos do not show who is in the network |
| Axuall US 12,079,891 B2 | Dates confirmed (priority 2019-01-04, published 2024-09-03). The kernel's design — server-held observations, institution-owned rules, no holder-assembled response, no schema registry — sits outside elements 1, 5 and 6 as read in [`fto-axuall-12079891.md`](./fto-axuall-12079891.md). Not a legal opinion |
| W3C BBS cryptosuites | Candidate Recommendation Draft, 2026-09-02 — confirmed |
| IETF SD-JWT VC draft -19 | Latest revision, **still an Internet-Draft in Last Call** (ends 2026-09-15), not an RFC |
| AutoCedar (arXiv 2607.03656) | Real preprint on verifier-guided Cedar policy synthesis; author-reported results only |
| WebAuthn Level 3 | W3C Recommendation, **2026**-08-25 |
| MCP authorization (2025-11-25) | Confirmed |
| OIG LEIE supplements | Monthly files labelled by month of action, distinct from the page's update date — confirms the source-time vs fetch-time distinction |
| FIPS 204 (ML-DSA) | Final, 2024-08-13 |
| FTC, *Using Consumer Reports* | **Overstated.** The page says employment background checks are consumer reports. It says nothing about a platform that assembles and furnishes verifications. That question needs 15 U.S.C. §1681a(f) and the FTC's *40 Years of Experience with the FCRA* staff report, which an earlier internal read found addresses employment verifications directly. The staff report was not re-fetched for this record |
| Joint Commission PSV | A public FAQ exists (IDs 000001357, 000001472), but it could not be read directly. The "through the applicant or his or her agent" wording is confirmed only secondhand, attributed to a JCI white paper |

**What §3 changes.** 482.22 is the strongest single piece of evidence *for* the mechanism: the one
place federal rules already let a receiving hospital substitute another institution's completed
credentialing and privileging for its own. It also shows the shape — written agreement,
recipient's governing body chooses, and performance information flows back. That return flow is
the package's *correction propagation* primitive, and here it is mandatory. It covers telemedicine
only, institution to institution. It gives no basis for relying on a clinician-held record or a
platform's. Do not cite it as broader than that.

---

## 4. Review of the kernel — findings the package did not report

Re-run against its own fixtures on 2026-09-10:

| Probe | Result | Why it matters |
| --- | --- | --- |
| Reviewing organization advances its authorization epoch (a withdrawal) | The whole evaluation **throws** `SIGNER_EPOCH` | Fail-closed, but it discards the residual-work answer at the moment a reviewer most needs "these 18 duties reopened because the prior review was withdrawn." A port must separate *untrusted input* (reject) from *withdrawn authority* (reopen, with a reason) |
| Reviewing organization's key deactivated | Throws `UNTRUSTED_KEY` | Same conflation |
| A `notFound` observation | Duty stays OPEN as `UNKNOWN`, reason `NO_FRESH_SUPPORTED_OBSERVATION` | Safe, but it files a finding as missing evidence — the exact conflation `CANONICAL_SOURCE_COVERAGE_STATES` was split to prevent. Whether not-found is adverse depends on the source, so the mapping belongs in the adapter |

The kernel is sound as a restricted research model: exact conjunctions, non-transitive agreements,
consent scoping, meaning fingerprints that survive a same-meaning refresh and reopen on a
procedure change. It is not a drop-in, and it needs two fields our evidence does not carry.

---

## 5. What this PR executes

The package's only code-level recommendation that needs no customer input: the acceptance diff.

**Defect, reproduced on `main`:** `diffAcceptanceSnapshot` reported *transitions* and the
component read them as the *current-state* reassurance.

| Accepted → current | Before | After |
| --- | --- | --- |
| `checked` → `unavailable`, `accessRequired`, `notFound`, `gated`, `pending`, `reviewRequired`, `notDecisionGrade`, `previewOnly` | "unchanged", green "Nothing revoked" | `degraded`; banner fails closed ("no longer confirmed at the source … re-check before relying on this") |
| `revoked` → `revoked` (already revoked when accepted) | "No changes since your acceptance", green "Nothing revoked", "the packet you accepted still holds" | `currentlyRevoked: 1`; red banner; the "still holds" line is withheld |
| `pending` → `unavailable` | "unchanged" | `changed` — `unchanged` now means identical state and check time |

`nothingRevoked` now reflects current state. `revoked` keeps red; lost support uses
`--vt-severity-high`.

**Proof.** 14 new cases fail against the previous code and pass against the fix; the 11 existing
cases pass on both. Web typecheck, design-lint, copy, and public-claims gates pass.

**Reach.** Latent, not live — see §2, fact 1. It is fixed now so the first second-review surface
does not inherit it.

---

## 6. What stays gated, and on whom

Nothing past §5 gets built until the first three gates pass. Each needs something software cannot
supply.

| # | Gate | Owner |
| --- | --- | --- |
| 1 | A named hospital employer and the person with authority to dispense with a review step, for one repeated NP/PA process | Founder |
| 2 | That employer's written answer to: **"Which three to five tasks will you stop repeating when VitalCV supplies this specific evidence and justification?"** | Founder |
| 3 | 30–50 authorized historical repeat-review pairs, each labelled independently by two qualified reviewers | Founder, with the employer |

Only then, in order:

1. **Integration prerequisites.** Add source-effective time and method to evidence. Add a
   Door A snapshot. Add a second-review path, where today a second accept is refused.
2. **Evaluator behind a private flag,** ported into `domain-evidence` as the adapter PTC and
   minimum friction were designed to be. Not a new package, and not the kernel verbatim (§4).
3. **Shadow output** in the reviewer's existing flow, then an observed second review.

**The metric** is the one already named: *employer requests avoided* — permitted repeat duties a
reviewer actually omitted, counted separately from duties the software marked reusable. Proposed
pilot gate: at least a 50% median reduction in repeated reviewer touch time, zero unsupported
omissions, and no unauthorized disclosure. Zero errors in 50 cases still leaves a rough 95% upper
bound near 6%.

---

## 7. Kill criteria

Stop, rather than build harder, if any of these hold:

- The employer will not specify, or will not honour, a reuse rule.
- Zero requests avoided across the first ten packets. This is the 08-11 falsification test,
  unchanged.
- Repeat events are rare in the chosen cohort, or the start bottleneck sits elsewhere (committee
  schedule, enrollment, scheduling).
- The sources the duties need cost more than the reviewer time saved.

---

## 8. Where the package lives

Not committed here: the kernel code, the 20-primitive and 8-architecture catalog, and the pricing
and acquisition hypotheses. The kernel would be the third unwired model (§2). The rest is
commercial and does not belong in a public repository. Pinned for later verification:

| Artifact | SHA-256 |
| --- | --- |
| `VitalCV_Research_Package.zip` | `da97bc5a0bc88227853c48f5fe6a591877165e2f4411ffeca0faa03a90f37a73` |
| `SHA256SUMS.json` (manifest) | `685f767493a47c549bfcba7ca99695a7fc240f24ff21a6c26ab1a4687788b2bc` |
| `VitalCV_Research_Kernel_v0_1/kernel.mjs` | `7c8282cd343202388b9255053b2a1725784c60442c148064fd49306fd55f83a4` |
| `VitalCV_Redesign_Report.md` | `671cd0c227ed93890fdb30786234aa3501299710784e2d1cc9cd9d838dcf09a7` |
