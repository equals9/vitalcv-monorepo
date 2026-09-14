# Opportunity Network — execution record, 14 September 2026

**Status:** program record for the founder's Opportunity Network direction (13 September
redesign proposal). Rank 5 in the [source-of-truth order](./README.md#source-of-truth-order):
it records decisions and evidence; it does not change positioning, vocabulary, or any truth,
privacy, or security contract. The canonical strategy documents stay canonical.

**Base:** `origin/main` @ `fa7e47b71` · **Branches:** `feat/whats-next-intent-fit` (WO-1a, #1478) →
`feat/whats-next-terms-on-list` (WO-1b, #1479) → `feat/whats-next-terms-on-deck` (WO-1c)

## 1. Verdict

**NARROW, then ADVANCE on one slice.** The redesign's organizing unit — the
person–opportunity transition carrying Representation + Permission + Progress — is
compatible with what the repository already owns. Nothing in it requires a new platform, a
new store, or a rename. What it requires first is small: a role must be able to say, in the
clinician's own terms, *met / not met / unknown*, and a hard term must never be quietly
relaxed. That did not exist. It does now, on the signed-in role detail, through the existing
preference owner.

What the evidence changed:

- The "intent" owner already exists and is durable and account-scoped
  (`MatchaPreference`, one JSON bag per Clerk user, served by `/api/matcha/preferences`).
  It was purely advisory: every field fed scoring; none could bind.
- A private save already exists (`OpportunityAction` with `interested` / `priority`,
  privacy pinned by test). A second "saved list" would be a duplicate. Not built.
- Explanations already exist in two halves (engine `MatchExplanation`; preference
  `preferenceMatchReasons`) and both **omit** a dimension when either side is silent. The
  redesign's requirement is the opposite: silence is a visible *unknown* with the question
  that would settle it.
- Live supply is feed rows: no pay in the row's compensation provenance for the measured
  board, no employer-stated requirements, no employer-confirmed roles. So the first useful
  first-session outcome is not "find the match" — it is "know exactly which of my terms this
  role settles, fails, or leaves open, and what to ask."

## 2. Ownership map (existing owners, not proposals)

| Responsibility | Canonical owner | Writer | Persistence | Notes |
|---|---|---|---|---|
| Private intent / terms | `MatchaPreferences` (`apps/web/lib/matcha/preferences.ts`) | `PUT /api/matcha/preferences` (web Prisma) | `MatchaPreference.data` (JSON) | This slice adds `hardConstraints` inside the existing bag. No migration. |
| Opportunity version | `Opportunity` + `opportunityTruth.ts` projection | ingestion runner / employer route | `Opportunity` | `availability`, `freshness`, `compensationProvenance` already distinguish stale/unconfirmed. |
| Fit explanation | engine `MatchExplanation` + `preferenceMatchReasons` + **`constraintFit.ts` (new, pure)** | none (pure) | none | New module answers met / not met / unknown per stated term. |
| Private save | `OpportunityAction` | `POST /api/matcha/deck/signal` | `OpportunityAction` | Exists; unchanged. |
| Application snapshot | `applicationService.ts` + `applicationPacketService.ts` | backend apply route | `Application`, `ApplicationPacket`, `ConsentGrant` | Out of scope; #1462 is the active owner of the write-path boundary. |
| Acceptance decision | `employerActions.ts` + `packetAcceptanceGuard.ts` | employer routes | `EmployerAcceptance` | Out of scope; #1469 owns the re-share diff. |
| Agent grant | `consentGrantService.ts` | `/api/agent/consent` | `ConsentGrant` | Out of scope; #1460 is dev-time tooling, not this runtime. |
| Transition / hire-to-start | `startMissionReadService.ts`, `employerWorkflowService.ts` | backend | `StartActivation`, `HandoffReceipt` | Out of scope; #1377/#1381/#1382 in flight. |

## 3. Conflict table

| Topic | Current direction | Older constraint | Resolution |
|---|---|---|---|
| Destinations "What's next / In progress / My record" | Redesign IA | UX-03 four-item nav is founder-ruled; visual gate applies to public chrome | Do not touch chrome. Stage the *content* first on existing routes. |
| Hard constraints vs advisory scoring | Terms can bind | `preferences.ts` contract: preferences are self-stated, never evidence | Kept. A hard term changes reporting only; it is never a credential claim and never removes a role. |
| Fit percentages | None, uncalibrated | Founder ruling: sell matching, not scores; no bare `Verified` | Kept. The new section carries no score; tests forbid it. |
| Opportunity truth | Stale/unconfirmed must not read as confirmed | `availability`/`freshness` already on the record | Reused verbatim. |
| Feed `hiringType` | Hardcoded on feed rows | `opportunityRowFacts` comment: not employer-stated | Evaluator reads `schedule` only and says so. |
| Compensation units | Annual floor vs hourly range | Existing `preferenceMatchReasons` compares without units (latent) | New evaluator refuses the comparison and asks for hours. Follow-up recorded for the old path. |

## 4. Research ledger (bounded pass, 14 Sep 2026)

Format: question → decision affected → finding → source/date → confidence → disposition.

- **R1 first behavior to replace** → the first slice → the cheapest avoidable cost on live
  supply is *reading a posting to discover it does not say the thing you care about*. Terms
  check replaces that read. Source: this repo's measured feed shape (memory, 2026-08-15/16:
  no pay, no requirements on feed rows). High confidence on what supply is; the user-time
  claim is a hypothesis. **NOW.** Fails if clinicians do not set terms at all — measure
  setting rate before building more.
- **R2 competitors** → what stays differentiated → LinkedIn advertises conversational search
  and match reasoning for all users (2026, vendor/press, marketed not tested). Vivian requires
  transparent pay on every listing and filters by position type (vivian.com, accessed
  2026-09-14, marketed). Neither advertises *per-person hard terms with an explicit unknown*
  or recipient-specific acceptance. Medium confidence. What remains differentiated at parity
  on AI search/drafting/tracking: hard terms that bind, unknown as a first-class answer,
  recipient commitments, follow-through. **NOW** (shapes copy: no superiority claims).
- **R2 refresh (second pass, 14 Sep)** → what the row must say → LinkedIn's *Job Match / How
  you match* reports which of the **employer's** required and preferred qualifications the
  person meets or lacks (help center, accessed 2026-09-14, marketed). That is candidate-to-role.
  Vivian filters listings by pay, shift and hours (vivian.com, accessed 2026-09-14, marketed);
  a filter removes the role rather than saying which of the person's terms it fails. Neither
  advertises the role checked against the person's own terms with *unknown* as an answer.
  Medium confidence; presentation only, not tested hands-on. **NOW** (WO-1b copy carries no
  superiority claim).
- **Later Astra discussion (13 Sep, after the redesign)** → sequencing → sharpens the target
  state to "an opportunity arrives with its conditions understood and as many as possible
  already satisfied" and "how much uncertainty can we remove before the person says yes."
  WO-1a/1b remove the uncertainty the person can settle from a role record; R6 (employer
  commitment before the person invests weeks) is the next uncertainty and needs a reachable
  institution. Entrepreneurship is one participation mode; nothing here assumes it.
- **R3 first five minutes** → entry design → not researched with users. Prepared, unexecuted:
  a five-minute usability task with a no-match scenario (§8). **NEXT.**
- **R4 portable state** → representation slice → existing `ClaimRecord`/`ApplicationPacket`
  already separate source observation from disclosure (redesign §III agrees). **LATER**;
  no new store.
- **R5 recipient acceptance** → WO-4 → no second-review path exists; acceptance snapshot is
  written, never read (memory 2026-09-10). Prior IP/FTO reading (`fto-axuall-12079891.md`)
  governs any presentation-protocol wiring; not touched. **LATER.**
- **R6 trustworthy opportunities** → what counts as confirmed → today: `listingSource ===
  'employer_posted'` + verified org. Zero such roles on the measured board. A manual
  confirmation workflow is the first real implementation; not built here. **NEXT**, needs a
  reachable employer (founder input).
- **R7 explainable matching** → evaluator design → deterministic met/not-met/unknown per
  stated term is sufficient for the first experience; no model. Protected characteristics are
  not inputs (visa *need* is the clinician's own stated requirement, evaluated only against
  the employer's stated position). **NOW.**
- **R8 boundaries** → WO-3 → #1462 owns the write-path boundary; #1381 the external
  acknowledgment contract. **DEFER** until they settle.
- **R9 privacy/agent controls** → this slice → terms never leave the account store; nothing
  is emitted to an employer; existing scope binding unchanged. **NOW** (held).
- **R10 repeat use / business** → not researched. **LATER.**
- **R11 adjacent horizons** (≤20%) → three credible: (a) *additional role while employed*
  — the beachhead already includes "adding a role"; the terms model covers it with no
  change; (b) *expressed working pattern before a vacancy exists* — the same terms, stored
  before any role, are the demand signal; measurable by counting terms set with zero
  matches; (c) *scoped attestations / permissioned introductions* — blocked on FCRA/CRA
  boundary already recorded (`fcra_verification_boundary`). Deferred: multi-buyer
  commissioning, undertakings, agent-mediated participation — no demand signal, no
  authority.
- **R12 falsification** → what would stop this → (1) terms-set rate ≈ 0 among signed-in
  clinicians → the wedge is wrong; (2) every evaluated term is `unknown` on live supply →
  supply, not product, is the bottleneck and the next work is R6; (3) clinicians set hard
  terms and still open roles that fail them → hard terms are not decisions, remove the
  emphasis. Each is measurable from the existing funnel plus the preference store; no new
  analytics platform.

## 5. Decision log

- 2026-09-14 · **Slice = terms check on the signed-in role detail.** Extend `MatchaPreferences`
  with `hardConstraints`; add pure `constraintFit.ts`; render "Your terms" on
  `/holder/opportunities/[id]`; one optional onboarding step to mark terms non-negotiable.
  No schema change, no route added, no chrome change, no apply-path change.
- 2026-09-14 · **Not built:** a saved-opportunity model (exists), a "What's next" route
  (chrome is founder-gated), any score, any employer-facing read of terms.
- 2026-09-14 · **Slice WO-1b = the same terms check on every row of the signed-in Roles
  list** (`/holder/opportunities`, and the home excerpt that reuses `OpportunityGrid`). The
  rows already carry the full `OpportunitySummary` shape, so the evaluator applies with no
  adapter and no backend change. One list-level line replaces per-row nagging when no terms
  are set. One minimized analytics event, `clinician.terms_checked` (counts only), is the
  "comparison available" measure.
- 2026-09-14 · **Not built in WO-1b:** the Discover deck — its server mapper
  (`liveRecommendation.ts`) drops `schedule`, `visaSponsorshipStatus`, `payUnit` and
  `compensationProvenance`, so a terms check there would report every dimension unknown
  until the mapper passes them through (recorded as the next work order, not hidden behind
  an adapter). `/explore` — public surface under the founder visual gate; the signed-in list
  is the right first home for a per-person check.
- 2026-09-14 · **Overlap recorded:** #1462 edits the same `OpportunityGrid` (apply-button
  block and deep-link guard). WO-1b touches the imports, the row's data attribute, and a
  strip above the footer; the hunks are distinct but adjacent. Whichever lands second
  rebases; #1462's render test mocks `RoleContext` without `useOptionalRoleContext` and will
  need the one-line mock addition made here in `mobile-launch-analytics.test.tsx`.
- 2026-09-14 · **Slice WO-1c = the same check on the Discover deck, fed by the canonical
  record.** The engine's match payload does not carry schedule, pay unit, pay provenance, or
  sponsorship, so the deck's server loader now reads each match's canonical record from
  `/api/opportunities/:id` — the same owner the list and the detail read — and the card
  carries only the facts a terms check reads. A record that cannot be read is absent and the
  card says so; it never reports invented unknowns. One shared component (`TermsCheck.tsx`)
  now renders the check on the list and the deck so the two cannot drift.
- 2026-09-14 · **Card face carries a two-line summary, not the strip.** The deck card is
  absolutely positioned in a fixed-height stack; the first rendered frame showed the full
  strip colliding with the match reasons. The face now states the verdict and each term's
  answer inline, placed beside the role facts and above the match block — the block is the
  card's flexible region and already overflows under the floating action bar at 390px
  (pre-existing, not changed here), so the terms never sit under it. The detail sheet carries
  reasons and questions.
- 2026-09-14 · **Not built in WO-1c:** backend enrichment of the match payload (a broader
  contract change than the read the loader now does); `/explore`.
- 2026-09-14 · **Merge is not authorized by this record.** Push to `main` deploys web and
  API; production promotion needs an explicit founder instruction.

## 6. Work order WO-1a (done in this branch)

- **User problem:** a signed-in clinician reading a role cannot tell which of their own terms
  it meets, fails, or leaves unstated.
- **Outcome:** on the role detail, each stated term shows met / not met / unknown with the
  role's stated value beside the clinician's; a hard miss is the section heading; an unknown
  carries the question to ask; the role and its action stay visible.
- **Owner / delta:** `apps/web/lib/matcha/preferences.ts` (+`hardConstraints`, sanitizer
  whitelist), `categories.ts`, `storage.ts`, `onboarding.ts` (+1 optional step),
  `apps/web/lib/matcha/constraintFit.ts` (new), `OpportunityDetailSurface.tsx`,
  `styles/opportunity-detail.css`.
- **Non-goals:** ranking, filtering roles out, employer visibility, apply changes, analytics
  events (follow-up: `terms_set`, `terms_checked` on the existing funnel allowlist).
- **Negative criteria (tested):** unknown never counts as met; an unknown constraint key is
  dropped at the write boundary; hourly pay is not compared to an annual floor; feed
  `hiringType` is never read; no score or eligibility wording renders.
- **Tests:** `__tests__/constraint-fit.test.ts`, `__tests__/opportunity-detail-terms.test.tsx`,
  plus the existing preference, sanitizer, onboarding-script and detail-continuity suites.

## 6b. Work order WO-1b (done in `feat/whats-next-terms-on-list`)

- **User problem:** on the Roles list a clinician had to open each role to learn which of
  their terms it settled, failed, or left open; the comparison happened only after the click.
- **Outcome:** every row shows each stated term as met / not met / unknown against the role
  record, with the first non-negotiable term the record does not settle carrying its reason
  and the settling question; a hard miss is stated on the row; the role and both of its
  actions stay; nothing is filtered, hidden, or reordered.
- **Owner / delta:** `components/mobile/ClinicianPanels.tsx` (`OpportunityGrid` reads
  `useMatchaPreferences` once; `TermsListNote`, `TermsStrip`), `lib/matcha/constraintFit.ts`
  (+`statedConstraintKeys`, pure), `lib/mobile/analytics.ts` (+`clinician.terms_checked`).
- **Non-goals:** ranking, filtering, the deck, `/explore`, employer visibility, any schema,
  route, API, packet, consent, acceptance, or apply-path change.
- **Negative criteria (tested):** a hard miss stays in place and first; unknown is never
  rendered as met; "no terms" is said once per list, never per row; no verdict renders before
  the account store answers; a degraded store is disclosed; no score, percentage, eligibility
  wording, or bare `Verified` renders; `statedConstraintKeys` agrees with the evaluator on
  six preference shapes. **Injection proof:** a one-line defect that dropped `hard_not_met`
  rows failed the "never filters or reorders" case and the hard-miss case; restored, green.
- **Tests:** `__tests__/opportunity-grid-terms.test.tsx` (14), plus the existing
  constraint-fit, detail-terms, launch-analytics, apply-disclosure, holder-route, and
  customer-language suites.
- **Rendered:** `docs/design/evidence/on-wo1b-terms-on-list-2026-09-14/` — real Clerk
  development gate, local production build, local backend, disposable database, one
  synthetic feed row; 1440×900 and 390×844, zero horizontal overflow, reduced-motion pass,
  keyboard focus on the terms link.

## 6c. Work order WO-1c (done in `feat/whats-next-terms-on-deck`)

- **User problem:** the Discover deck could not check a card against the clinician's terms
  because its payload never stated the facts a check reads; a naive check would have said
  "unknown" for facts the record states.
- **Outcome:** each live card carries its canonical record facts; the card face shows the
  verdict and each term's answer, the detail sheet the full strip with reasons and questions;
  a card with no readable record says the check was unavailable; one deck-level line covers
  loading, no terms, and a degraded store.
- **Owner / delta:** `lib/matcha-deck/liveFeed.ts` (+`loadMatchRecords`, capped at 24, one
  read per id, failures absent), `lib/matcha-deck/liveRecommendation.ts` (+record facts,
  sponsorship from the record, `matchOpportunityId`), `components/matcha-deck/types.ts`
  (+`record`), `components/matcha-deck/DeckTerms.tsx` (context + block), `MatchaDeckCard`,
  `DeckDetailSheet`, `DiscoverSurface` (provider + note), `components/matcha/TermsCheck.tsx`
  (shared strip, summary, note, unavailable; the list now uses it), fixtures (two sample
  records), `styles/matcha-deck.css`.
- **Non-goals:** ranking, filtering, backend payload changes, `/explore`, any schema, route,
  API, packet, consent, acceptance, or apply-path change.
- **Negative criteria (tested):** only the eight record facts are copied, never the projection;
  a failed record read leaves that card without a record and never drops another's; each id is
  read once; the deck sponsorship label becomes definite only from the record's two definite
  positions; no provider, not loaded, or no terms renders no block; a card with no record
  renders no per-term unknown; no score, percentage, eligibility wording, or bare `Verified`.
- **Tests:** `matcha-deck-terms.test.tsx` (6), `matcha-deck-live-feed-records.test.ts` (2),
  `matcha-deck-live-recommendation.test.ts` (+4), plus the existing deck, list, and surface
  suites.
- **Rendered:** `docs/design/evidence/on-wo1c-terms-on-deck-2026-09-14/` — fixture preview on a
  local production build (the live deck needs an NPPES-backed identity; see the README), card
  and sheet at 1440×900, card at 390×844 under reduced motion, zero horizontal overflow,
  record-unavailable and no-terms states.

## 7. Next work orders (ranked)

1. **WO-1d** — the Interested workspace (`WorkspaceCard`, `/holder/opportunities/interested`)
   and its compare columns: the same check on saved roles, and a "changed since you saved it"
   re-evaluation when the record moves. Reuses `TermsCheck` and the record already on the
   recommendation; needs the workspace loader to pass records the same way the deck does.
2. **WO-6-lite** — first employer-confirmed role via a manual confirmation record
   (`listingSource = 'employer_posted'` through the existing employer route) with a named
   confirmer and response commitment. Prerequisite: a reachable employer (founder).
3. **Follow-up** — `preferenceMatchReasons` compares pay without units; align it with
   `constraintFit` or route it through the same evaluator.
4. **Instrumentation** — `clinician.terms_set` from the onboarding step (counts only), so the
   R12 falsifier "terms-set rate ≈ 0" is measurable alongside `terms_checked`.

## 8. Prepared, unexecuted instruments

Interview and usability scripts are **not** written into this repository (it is public).
They are prepared as a separate founder-held artifact on request. No participant has been
contacted; no live data was collected.
