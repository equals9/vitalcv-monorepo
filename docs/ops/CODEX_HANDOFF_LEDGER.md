# Codex handoff ledger

Append-only. **Newest entry at the top.** One entry per work order is recorded
in the same pull request as its implementation or takeover evidence.

## ON-WO-1b · Your terms on every row of the signed-in Roles list — OPEN

- **Date:** 2026-09-14
- **Lane:** Claude Code (branch `feat/whats-next-terms-on-list`, worktree `/tmp/vitalcv-on-wo1b`,
  stacked on `feat/whats-next-intent-fit` @ `f80d161cf` = #1478; base `origin/main` @ `fa7e47b71`).
- **Claim-check:** #1478 (WO-1a) re-read and its focused suites re-run here; it owns the
  evaluator and the detail section and is reused, not duplicated. #1462 edits the same
  `OpportunityGrid` (apply-button block, deep-link guard) — distinct hunks, overlap recorded in
  the program record. #1438, #1469, #1460, #1377/#1381/#1382 untouched. Neither the deck nor
  `/explore` was changed (see program record for why).
- **Change:** `OpportunityGrid` reads the account-scoped terms once and renders, on each row, every
  stated term as met / not met / unknown against the role record, the first unsettled
  non-negotiable term's reason and settling question, and the hard-miss heading; one list-level
  line for loading / no terms / degraded store. Pure `statedConstraintKeys` added to
  `constraintFit.ts`. One minimized event `clinician.terms_checked` (counts only). Program record
  §6b: `docs/strategy/opportunity-network-execution-2026-09-14.md`.
- **Truth, authority, and transaction boundary:** No schema, route, API, packet, consent,
  acceptance, decision, or apply-path change. Terms remain self-stated preferences, never
  evidence; a hard miss is reported, never used to hide, drop, or reorder a role; unknown is
  neither a pass nor a fail; nothing is emitted to an employer; the event carries no preference
  values, role identifiers, or free text.
- **Evidence:** focused vitest 273/273 across the affected suites; `tsc` clean; web lint clean;
  `check:design`, `check:copy`, `check:claims`, `check:routes` PASS; `next build` PASS; full web
  vitest recorded in the PR. Injection proof: dropping `hard_not_met` rows fails the suite.
  Rendered through the real Clerk development-instance gate on a local production build against a
  local backend and a disposable database with one synthetic feed row: authed `PUT`/`GET` on
  `/api/matcha/preferences` round-tripped `hardConstraints`; the list rendered `hard_not_met`
  (location not met; pay and arrangement unknown) at 1440×900 and 390×844 with zero horizontal
  overflow; clearing terms rendered the single no-terms line. Frames:
  `docs/design/evidence/on-wo1b-terms-on-list-2026-09-14/`.
- **Next gate:** review, after #1478. Merge is not authorized by this entry (push to `main`
  deploys). Next work order: WO-1c, the deck mapper pass-through, then the same strip on the deck.

## ON-WO-1a · Your terms on the signed-in role detail — OPEN

- **Date:** 2026-09-14
- **Lane:** Claude Code (branch `feat/whats-next-intent-fit`, worktree `/tmp/vitalcv-whats-next`,
  base `origin/main` @ `fa7e47b71`).
- **Claim-check:** Open PRs #1462, #1469, #1438, #1471, #1472, #1377, #1381, #1382, #1460 and
  merged #1427, #1436, #1437, #1429, #1446, #1459 were read. None adds a hard-term model, a
  met/not-met/unknown evaluator, or a terms section on the role detail. `OpportunityAction`
  already owns private saves, so no saved-list model was added. #1462 owns the apply write
  path and is not touched.
- **Change:** `MatchaPreferences.hardConstraints` (closed vocabulary, sanitizer-enforced), one
  optional onboarding step to set it, pure `lib/matcha/constraintFit.ts`, and a "Your terms"
  section on `/holder/opportunities/[id]` showing met / not met / unknown per stated term with
  the settling question for each unknown. Program record:
  `docs/strategy/opportunity-network-execution-2026-09-14.md`.
- **Truth, authority, and transaction boundary:** No schema migration, route, API, packet,
  consent, acceptance, decision, or apply-path change. Terms are self-stated preferences,
  never evidence; a hard miss is reported, never used to hide a role or rank a person; unknown
  is neither a pass nor a fail; hourly pay is never compared to an annual floor; feed
  `hiringType` is never read as evidence. Nothing is emitted to an employer.
- **Evidence:** focused vitest 55/55; full web vitest 4595 passed / 0 failed; `tsc` clean;
  design-lint, copy, claims, and route-guard gates PASS; `next build` PASS. Rendered through the
  real Clerk development-instance gate on a local production build against a disposable
  database with one synthetic feed row: the authed `PUT`/`GET` on `/api/matcha/preferences`
  round-tripped `hardConstraints`, and the detail page rendered `hard_not_met` with location
  not met and compensation/arrangement unknown, at 1440×900 and 390×844 with no horizontal
  overflow; clearing terms returned the section to `no_terms`.
- **Next gate:** review. Merge is not authorized by this entry (push to `main` deploys).
  Next work order: the same evaluator on the discover deck and `/explore` rows.

## PTC-WAVE-00 · Professional Trust Computing architecture — OPEN #1386

- **Date:** 2026-08-14
- **Claim-check:** No open or merged PR implements TrustSpec, TrustIR, or the
  Trust Compiler. Draft #1382 is a direct coordination dependency because it
  adds reviewed, versioned credential-operations templates and frozen case
  tasks. Drafts #1378, #1380, #1381, and #1384 are the active acceptance/start
  stack and must settle before a demo acceptance adapter is selected.
- **Change:** Adds the repository-specific architecture map, Demo 1 execution
  plan, legacy-equivalence contract, research register, exact T001-T013 golden
  fixtures, file-level proposal, migration boundary, and explicit Q1-Q10
  answers required by PTC-WAVE-00.
- **Truth, authority, and transaction boundary:** This is documentation-only
  archaeology. It adds no compiler, policy, proof, route, schema, migration,
  decision, source call, graph record, or UI. Computational satisfaction stays
  separate from employer acceptance. All proposed Demo 1 people, employers,
  evidence, sources, actions, costs, and outcomes are explicitly synthetic.
- **Architecture decision:** Add pure compiler primitives to
  `@vitalcv/domain-evidence`; extend the existing `@vitalcv/career-graph` only
  from immutable provenance; adapt `OpportunityRequirement`; reuse packet and
  Decision Capsule integrity patterns without relabeling either artifact; and
  use a bounded exact breadth-first optimizer for minimum action count.
- **Next gate:** Review and approve the architecture before PTC-WAVE-01. The
  review must resolve #1382 ownership, the canonical acceptance service, the
  cross-runtime canonical JSON/SHA-256 boundary, and private evidence
  hydration. Do not start implementation automatically.

## WO-18 · Explore documentary media pause — OPEN

- **Date:** 2026-08-14
- **Claim-check and creative ownership:** Open and recently merged pull requests
  plus remote branch names were checked before implementation. PRs #1374 and
  #1379 established prior Opportunity Field work; no current open pull request
  duplicates this media-removal intent. Codex is the creative owner implementing
  the founder-directed correction inside the existing register. Shared public
  chrome is unchanged.
- **Change:** Removes the rejected `journey_film` scene from the rendered
  `/explore` hero and lets the existing text composition use the vacated space.
  This wave adds no replacement imagery. The experience constitution now records
  the founder boundary that any future media must be dynamic, close,
  human-centered, optimistic, bright, and vibrant while remaining privacy- and
  truth-safe.
- **Truth and authority boundary:** Real source-labelled opportunities,
  availability, application modes, and current product behavior are preserved.
  No API, schema, migration, authorization, packet, decision, Recognition, or
  durable-state behavior changes. Browser evidence demonstrates composition,
  not authenticated data or production capability.
- **Evidence:**
  `docs/design/evidence/wo13c-explore-media-pause-2026-08-14/` contains production
  before and optimized-build after frames for desktop and mobile, plus tablet,
  wide desktop, reduced-motion, no-JavaScript, and 200% zoom evidence. No motion
  recording is required because the change removes a static image and introduces
  no motion behavior.
- **Verification:** Optimized-build Chromium passes **6/6** focused tests. The
  hero contains neither `.opf-hero-media` nor an image; measured document width
  equals viewport width; inspected console warnings and errors are zero. Full
  repository typecheck, lint, and build pass. Claims, copy, design, design-doc,
  route, and workflow-contract checks pass. The configured non-backend Turbo
  sweep passes **468 files / 4,532 tests**; its 45 environment-gated skips are
  the existing repository baseline, not new or required coverage hidden by this
  change. The configured real-PostgreSQL backend sweep passes **343 suites /
  2,761 tests**.
- **Next gate:** Publish the focused pull request, require refreshed-head CI and
  review-environment evidence, then merge only if every required gate is green.
  Verify the exact Railway `/api/version` SHA and live absence of `journey_film`
  before marking WO-18 landed.

## WO-17 · Homepage warm-glass motion synthesis — OPEN

- **Date:** 2026-08-14
- **Claim-check and creative ownership:** Merged #1371 and #1373 are the landed
  Direction D and D.1 foundations. No open PR changes `/`; the remote home and
  visual branches are historical, superseded, or unsubmitted rather than a
  competing current implementation. Codex is the creative owner. This work
  composes the canonical `HeroStage`, `WorkSurface`, and
  `CareerMobilitySequence`; it adds no component family, motion engine, scene
  registry, or in-page rail. Shared chrome geometry, navigation, and controls
  stay fixed; the homepage SSR/no-JavaScript fallback uses the existing light
  register so it is legible before client-side section observation.
- **Change:** Synthesizes the founder-supplied visual tokens, Dimension material
  reference, and professional-trust theses into the existing VitalCV register.
  Per the founder's 2026-08-14 correction, the homepage documentary poster is
  unmounted and the evidence folio becomes a warm frosted-glass register over a
  code-authored NPI -> source states -> source-labelled roles horizon. The
  existing record-to-reuse sequence becomes a hard-cut inverse editorial band
  with architectural type, seven numbered physical objects, hairline structure,
  and mobile two-column moments. VitalCV's paper, ink, Fraunces, 8px primary
  action, and semantic source-green remain; no black/violet reference palette,
  font, photo, raster illustration, scientific wallpaper, decorative state hue,
  or new mono register is copied.
- **Truth and authority boundary:** The glass register and motion display remain
  explicitly illustrative. Distinct evidence states do not collapse into a
  score or implied Trust Compiler output. Real public opportunities retain source,
  observation, availability, and application-mode boundaries. Clinician choice
  precedes exact-packet review; accepted head start follows an employer-recorded
  decision; reuse requires fresh consent. No API, schema, migration,
  authorization, packet, decision, Recognition, or durable-state behavior
  changes.
- **Evidence:**
  `docs/design/evidence/home-refero-synthesis-2026-08-14/` contains production
  before and optimized-build after frames at every required width, a full-page
  composition, hero and career-loop details, reduced-motion, no-JavaScript,
  200% zoom, desktop and mobile recordings, reference classification, scorecard,
  and computed typography/contrast/overflow measurements. The changed band has
  zero monospace and the implementation adds no source-green decoration.
- **Verification:** Focused Vitest, including the glass governance ratchet,
  passes **4 files / 44 tests**;
  production-build Chromium passes **19/19** across 390/768/1024/1280/1440/1728,
  reduced motion, no JavaScript, keyboard, source boundaries, and painted style
  assertions. Full repository typecheck, build, and lint pass. After restoring
  the canonical backend Prisma client with the repository's locked generator,
  the real-PostgreSQL backend sweep passes **343 suites / 2,761 tests** in band;
  the non-backend Turbo sweep passes **468 files / 4,532 tests**. Design, copy,
  claims, route, and generated-design-document gates pass. The glass ratchet
  contains one exact founder-directed marketing-illustration allowlist entry
  with a complete-readable-fallback requirement; operational evidence and decision
  surfaces remain prohibited.
- **Next gate:** Publish the draft PR and review environment, require
  refreshed-head CI and `CLEAN`, then review the live URL.
  After explicit founder GO, merge and require exact Railway `/api/version` plus
  desktop/mobile interaction verification before marking WO-17 landed.

## WO-16 · NPI-to-opportunity activation path — OPEN

- **Date:** 2026-08-14
- **Claim-check and creative ownership:** No open PR duplicates the `/pilot`
  or `/onboarding` composition. The remote onboarding and pilot branches are
  old, unsubmitted, and either listed for deletion or superseded by current
  `main`; open #1377, #1378, #1380, #1381, #1382, and #1384 address strategy or
  the authorized hire-to-start transaction. Codex is the creative owner
  applying the founder-selected human+tactile direction. Shared public chrome
  is unchanged.
- **Change:** Gives `/pilot` and `/onboarding` one shared, server-visible NPI →
  source states → CV Wallet → opportunity journey and one provenance-bound
  tactile scene. Onboarding preserves the existing NPI behavior, account
  boundary, signed-in phases, endpoints, and unhappy states while replacing a
  generic benefits list with the visible path. Pilot replaces a simulated KPI
  and dense card stack with a real-cohort target, canonical source states, six
  distinct measurement moments, explicit limits, and one governed request.
- **Truth, authority, and transaction boundary:** NPPES remains a public
  registry identity read, not identity possession or a license check. The
  clinician controls saving and presentation. The illustration stops before
  application, review, decision, credentialing, hire, or start. Pilot target
  is not published outcome; employer response is human; packet, clarification,
  credentialing, intended start, and actual start stay distinct. No schema,
  migration, authorization, packet, decision, Recognition, or durable-state
  path changes.
- **Accessibility and performance:** Production-build coverage confirms 0px
  horizontal overflow at 390, 768, 1440, and 1728 on both routes, complete
  static paths under reduced motion and no JavaScript, 44px/50px primary
  controls, and 16.74:1 H1 contrast. The 102,220-byte AVIF is below the 250KB
  target, shipped motion is zero, and no canvas, WebGL, or new animation engine
  is required. The controlled profile records maximum LCP 88ms, CLS 0.0597,
  and maximum INP 40ms.
- **Evidence:**
  `docs/design/evidence/wo16-activation-path-2026-08-14/` contains paired
  production-before and optimized-build-after frames for both routes at every
  required width, initial mobile viewports, reduced-motion and no-JavaScript
  frames, real route recordings, computed typography/contrast/performance,
  duplicate-intent classification, and generation provenance. The app is
  founder-pinned to one supported theme, light, and that theme is measured.
- **Verification:** Focused component, route, claim-parity, and scene coverage
  passes **7 files / 66 tests**; focused production-build Playwright passes
  **10/10**, and the combined activation plus retained-artifact contract passes
  **18/18**; full typecheck passes **50/50**; and the optimized web build passes.
  The aggregate web suite passes **468 files / 4,532 tests** and the
  migration-backed PostgreSQL backend census passes **343 suites / 2,761
  tests** in the exact documented CI mode. Copy, claims, design, route, and
  design-markdown gates pass; the copy ratchet improves from 100 to 90 and the
  design LINT-02 ratchet improves from 280 to 279.
- **Next gate:** Publish this implementation with its same-PR ledger receipt,
  require every refreshed-head check green and `CLEAN`, squash-merge, verify
  Railway web and API at the exact merge SHA, and exercise `/pilot` and
  `/onboarding` live on desktop and mobile before WO-17.

## WO-15 · Employer exact-packet review story — OPEN

- **Date:** 2026-08-14
- **Claim-check and creative ownership:** No open PR or remote branch duplicates
  this public `/employers` composition. Open #1377, #1378, and #1380 address
  category doctrine and authorized hire-to-start services; the older
  `codex/wave2-employer-packet-review` branch is signed-in application-reader
  work. Codex is the creative owner applying the founder-selected human+tactile
  direction. Shared public chrome is unchanged.
- **Change:** Rebuilds the employer page around a tactile consent-to-review desk,
  an anonymous documentary-style clinical-operations scene, three review
  truths, and one native horizontal six-moment review rail. Swipe, drag, 48px
  controls, arrow keys, active narration, reduced motion, and no-JavaScript
  completeness share one server-visible content path. A source-lane register
  reads the existing canonical source contract rather than hand-typed status.
- **Truth, authority, and transaction boundary:** The tactile illustration
  stops before a decision. Submitted and current evidence remain separate;
  clarification stays visible; acceptance remains a head start; credentialing,
  privileging, hiring, and start remain institution decisions. Type 2 NPI
  identity is not organization authority. No employer, clinician, result,
  source response, metric, readiness score, or speed claim is invented. This
  visual PR creates no packet, decision, authorization, schema, migration, or
  durable-state path and does not overlap the open canonical transaction work.
- **Accessibility and performance:** The optimized build has 0px horizontal
  overflow at 390, 768, 1440, and 1728; every review moment remains in the DOM;
  review controls are 48px square; and measured contrast ranges from 6.61:1 to
  15.28:1. The two shipped WebP assets total 67,982 bytes, shipped motion is
  zero, and no canvas, WebGL, or new animation engine is required. Three
  controlled runs record maximum LCP 96ms, CLS 0, and maximum INP 48ms.
- **Evidence:**
  `docs/design/evidence/wo15-employer-review-story-2026-08-14/` contains paired
  production-before and optimized-build-after frames at every required width,
  the initial mobile viewport, reduced-motion and no-JavaScript frames, a real
  carousel-control recording, computed typography/contrast/performance,
  duplicate-intent classification, and generation provenance. The public app
  is founder-pinned to one supported theme, light, and that theme is measured.
- **Verification:** Focused employer coverage passes **9 files / 64 tests** and
  focused production-build Playwright passes **30/30**. Copy, claims, design,
  route, and design-markdown gates pass; the copy ratchet improves by three.
  Typecheck passes **50/50**, build passes **35/35**, the aggregate web suite
  passes **467 files / 4,527 tests**, and the serialized migration-backed
  PostgreSQL backend census passes **343 suites / 2,761 tests**.
- **Next gate:** Publish this implementation and same-PR receipt, require every
  refreshed-head check green and `CLEAN`, squash-merge, verify Railway web and
  API at the exact merge SHA, and exercise `/employers` plus the review rail
  live on desktop and mobile before WO-16.

## WO-13B-F1 · Mobile source-title containment — OPEN

- **Date:** 2026-08-14
- **Production defect:** Exact live verification of merged WO-13B at 390px found
  the source-supplied title `NY Center Advanced Practice Provider (Nurse
  Practitioner/Physician Assistant)` rendering to 393.83px, beyond the 390px
  viewport. This is a bounded visual-defect correction inside the approved
  opportunity register; shared public chrome is unchanged.
- **Correction:** The existing role-heading grid now explicitly permits its text
  track and nested wrapper to shrink, long source strings wrap instead of
  escaping the card, and slash-delimited titles receive a semantic-free soft
  wrap opportunity without changing the source text or accessible name.
- **Truth, product, and architecture boundary:** No role fact, source label,
  filter, ranking, application path, API, schema, authorization rule, durable
  state, component family, or animation engine changes. The exact source title
  remains present and linked to the existing opportunity detail.
- **Evidence:**
  `docs/design/evidence/wo13b-mobile-overflow-2026-08-14/` contains the exact
  390px live-production before card and optimized-build after card. The title
  edge moves from 393.83px to 358px; the after document is 390px wide.
- **Verification:** Focused rendering passes **1 file / 6 tests** and
  production-build Playwright passes **6/6**, including the exact live title,
  390/768/1440/1728 widths, no JavaScript, reduced motion, keyboard, and 200%
  zoom. Typecheck passes **50/50**, build passes **35/35**, the aggregate web
  suite passes **467 files / 4,525 tests**, and the serialized migration-backed
  PostgreSQL backend suite passes **343 suites / 2,761 tests**. Exact
  refreshed-head CI and `CLEAN` remain required before merge.
- **Next gate:** Publish the same-PR correction and ledger receipt, require all
  refreshed-head checks green and `CLEAN`, squash-merge, verify Railway web and
  API at the exact merge SHA, and remeasure the exact live title at 390px before
  WO-15.

## WO-13B · Opportunity discovery controls — OPEN

- **Date:** 2026-08-14
- **Claim-check and creative ownership:** No open pull request or remote branch
  duplicates the source-aware discovery lens rail, expanded public browse
  contract, or explicit sort. Merged #1374 and #1375 are LANDED foundations,
  not competing implementations. Codex is the named creative owner applying
  the founder's HiringCafe-class functionality directive inside the locked D.2
  register; shared public chrome is unchanged.
- **Change:** Adds six tactile opportunity lenses with keyboard controls,
  native horizontal overflow, real no-JavaScript links, active state, and a clear
  MATCHA boundary. The advanced field grows from five browse facets to ten
  controls: specialty, profession, location, schedule, employment type, source
  observation window, application path, compensation detail, benefits detail,
  and sort. Every selection remains shareable through normalized URL state.
- **Truth and ranking boundary:** Source-observation filtering reads the
  opportunity's recorded observation time; compensation and benefits filters
  distinguish supplied, limited, and missing data without inference; and
  application mode preserves the original-listing versus VitalCV boundary.
  Sorting is only recent update, title, or organization. No public fit score,
  readiness verdict, hidden ranking, automatic rejection, sensitive inference,
  employer preference, or auto-application is introduced. Signed-in MATCHA
  remains the owner of natural-language intent and personal explanation.
- **Architecture and data:** Extends the existing `BoardFilters`, canonical
  opportunity truth matcher, list service, and anonymous API route. It creates
  no parallel board, matcher, animation engine, schema, migration, durable
  mutation, authorization path, or application API. Derived filters retain the
  existing 500-row bounded scan and explicit `truncated` response; title and
  organization sorting stay database-owned on the fast path.
- **Accessibility and performance:** Lens cards are real links without
  JavaScript; arrow controls are supplementary 48px targets; native selects
  retain the advanced path; focus, reduced motion, no-JavaScript disclosure,
  200% zoom, and 390/768/1440/1728 behavior are production-build tested.
  Measured horizontal overflow is 0px at all required widths, ink contrast is
  18.71:1, source green contrast is 6.33:1, and the implementation adds no
  shipped image, video, canvas, WebGL, or motion payload.
- **Evidence:**
  `docs/design/evidence/wo13b-opportunity-discovery-2026-08-14/` contains paired
  production-before and optimized-build-after frames at all four required
  widths, reduced-motion and no-JavaScript frames, a real carousel-control
  recording, computed geometry and contrast, duplicate-intent evidence, and
  the explicit local-source limitation.
- **Verification:** Focused frontend passes **1 file / 5 tests**; focused
  opportunity truth and service coverage passes **2 suites / 22 tests** against
  the migration-backed PostgreSQL harness; production-build Playwright passes
  **5/5**. Zero-warning lint, copy, claims, design, route, design-markdown,
  typecheck, and full build gates pass. The aggregate web suite passes **467
  files / 4,524 tests** and the backend passes **343 suites / 2,761 tests**
  against the migration-backed PostgreSQL harness. Refreshed exact-head CI and
  `CLEAN` remain required before merge.
- **Next gate:** Publish the same-PR implementation and ledger receipt, require
  all refreshed-head checks green and `CLEAN`, then squash-merge. Verify Railway
  web and API `/api/version` at the exact merge SHA and exercise the new lens and
  advanced URL flow on desktop and mobile before WO-15.

## WO-14 · Opportunity detail and signed-in MATCHA — OPEN

- **Date:** 2026-08-14
- **Claim-check and creative ownership:** No open PR duplicates the WO-14
  source-preserving public detail, external-versus-integrated action boundary,
  closed-role receipt, or signed-in MATCHA continuity. Historical #477 is the
  LANDED baseline this work replaces rather than a competing implementation.
  Codex is the named creative owner implementing founder-locked Direction D.3;
  shared public chrome is unchanged.
- **Change:** Rebuilds `/opportunities/[id]` as a human+tactile editorial role
  record using the same canonical opportunity truth as `/explore`: real role
  facts, a provenance-bound documentary crop, tactile source ticket, ruled fact
  register, and source receipt. The signed-in clinician detail retains that
  record and adds `Why this may fit`, evidence gaps, uncertainty, and
  clinician-controlled next steps. Integrated roles continue into the existing
  disclosure composer rather than a parallel application path.
- **Truth boundary:** External roles only say `View original listing`; only
  integrated roles may say `Apply with VitalCV`. Closed direct links remain
  readable as closed and expose no application action. Missing descriptions,
  compensation, source pages, observations, and explanation elements remain
  explicit. No public readiness score, automatic eligibility verdict, hidden
  employer ranking, inferred sensitive fact, invented requirement, or employer
  endorsement was added.
- **Authorization, evidence, and data:** The anonymous detail contract and the
  signed-in proxy remain unchanged. No new auth route, packet API, decision
  service, schema, migration, or durable mutation is introduced. The clinician
  application action reuses the existing preview, selective disclosure,
  consent, and sealed-packet flow. The detail reader now preserves a closed
  opportunity's canonical availability truth rather than converting it to a
  not-found response.
- **Accessibility and performance:** The committed production-build evidence
  covers 390, 768, 1440, and 1728 widths, reduced motion, no JavaScript, the one
  supported public theme, computed typography/contrast, mobile control
  clearance, and a real scroll recording. Horizontal overflow is 0px; measured
  contrast is 5.86:1 to 18.71:1; the primary action is 52px high; and three
  controlled runs record maximum LCP 196ms, CLS 0, and maximum INP 56ms. The
  route reuses the 167,602-byte WO-13 poster, adds no shipped motion, canvas,
  WebGL, or animation engine, and keeps evidence facts outside the pixels.
- **Evidence:**
  `docs/design/evidence/wo14-opportunity-detail-matcha-2026-08-14/` contains
  paired 390, 768, 1440, and 1728 before/after frames, the initial mobile
  viewport, reduced-motion and no-JavaScript frames, a real detail-scroll
  recording, computed visual/performance measurements, provenance, and the
  duplicate-intent record. No local Clerk credentials were present, so the
  authenticated route was not weakened with a bypass to manufacture a frame;
  signed continuity is source- and component-tested and remains in the
  controlled post-deploy receipt when an authorized session is available.
- **Verification:** Focused UI passes **2 files / 11 tests**, including the
  actual signed-in detail component for external and integrated modes; focused
  opportunity truth and service coverage passes **2 suites / 20 tests** against real
  PostgreSQL; and canonical opportunity contract coverage passes **4 files / 246
  tests**. Zero-warning lint, copy, claims, design, route, design-markdown,
  typecheck, and full build gates pass. The aggregate passes **467 web files /
  4,522 tests**; the seven web database-gated files pass **45/45** against
  ephemeral PostgreSQL 16; and the backend passes **343 suites / 2,759 tests**
  against the migration-backed harness. Refreshed exact-head CI and `CLEAN`
  remain required before merge.
- **Next gate:** Publish this implementation and same-PR ledger receipt, require
  refreshed-head CI green and `CLEAN`, then squash-merge. Verify Railway web and
  API `/api/version` at the exact merge SHA and exercise the public detail on
  desktop and mobile plus the authorized signed detail when a controlled
  session is available before WO-15.

## WO-13 · Public opportunity field — OPEN

- **Date:** 2026-08-14
- **Claim-check and creative ownership:** No open PR or remote branch duplicates
  WO-13's source-labelled editorial field, five-facet browse register,
  documentary scene, or application-mode boundary. Merged #1005 is LANDED
  search groundwork. Codex is the named creative owner implementing the
  founder-selected human+tactile extension of Direction D; shared public chrome
  is unchanged.
- **Change:** Replaces `/explore`'s dense dashboard/feed treatment with a
  server-rendered editorial opportunity field and documentary clinical scene.
  The page exposes current roles before sign-up, exactly five browse facets,
  large ruled role records, native no-JavaScript filters, and explicit external
  versus integrated application actions. The anonymous opportunity contract now
  derives profession, schedule, availability state and confidence, source URL,
  observation time, application mode, and compensation source. Public-feed
  listings cannot inherit claims from a placeholder organization's profile.
- **Truth and rights boundary:** External listings retain `View original
  listing`; only integrated records may use `Apply with VitalCV`. Missing pay,
  unavailable observation time, stale or closed state, and unavailable source
  pages remain explicit. The generated anonymous-clinician scene is art
  direction, not a clinician, patient, employer, credential, result, or customer
  claim; it contains no visible identifier or PHI. No readiness percentage,
  automatic eligibility, hidden ranking, unsupported source, or speed promise
  was added.
- **Accessibility and performance:** The optimized build has 0px horizontal
  overflow at 390, 768, 1440, and 1728 widths; the H1 is computed Fraunces; the
  measured contrast range is 5.86:1 to 17.31:1; and the primary row action is at
  least 48px high. The 167,602-byte LCP poster is below budget, shipped motion is
  zero, no WebGL or canvas is required, and the controlled profile records LCP
  700ms, CLS 0, and INP 16ms. The one supported public theme is light and is
  measured directly.
- **Evidence:** `docs/design/evidence/wo13-public-opportunity-field-2026-08-14/`
  contains paired 390, 768, 1440, and 1728 before/after frames, full-page,
  reduced-motion, and no-JavaScript frames, a real-row scroll recording,
  computed typography/contrast/overflow, controlled performance results,
  provenance disclosure, and the duplicate-intent record.
- **Verification:** Focused frontend coverage passes **2 files / 19 tests**;
  focused production-build Playwright passes **4/4**; and the real-PostgreSQL
  opportunity/ingestion suites pass **3 suites / 52 tests**. EC-9 vocabulary,
  glass, and sitemap-freshness ratchets pass after the aggregate gate found and
  corrected two new vocabulary uses, two blur treatments, and the stale
  homepage freshness date. Copy, claims, design, route, typecheck, build, the
  zero-warning lint, and typecheck gates pass. The final aggregate run passes
  **465 web files / 4,510 tests** plus the real-PostgreSQL backend at **343
  suites / 2,756 tests**. The web aggregate's seven database-gated files / 45
  tests remain assigned to refreshed CI's PostgreSQL step. Refreshed-head CI and
  `CLEAN` remain required before merge. Final review also pinned the SSR pilot
  control, opportunity-owned freshness, physician-title coverage, and stale-page
  normalization with regression tests before landing.
- **Next gate:** Publish this implementation and same-PR ledger receipt, require
  all refreshed-head checks green and `CLEAN`, then squash-merge. Verify Railway
  web and API `/api/version` at the exact merge SHA and exercise `/explore` on
  desktop and mobile before WO-14 begins.

## WO-12 · Human+tactile homepage release — OPEN

- **Date:** 2026-08-14
- **Claim-check and creative ownership:** No open PR or remote branch duplicates
  the human+tactile homepage, career-mobility story, or opportunity-horizon
  intent. Merged #1371 is the Direction D baseline. Codex is the named creative
  owner implementing the founder's dated Direction D.1 choice; shared public
  chrome is unchanged.
- **Change:** Reframes `/` as a single clinician career-mobility story with the
  exact founder-selected eyebrow, headline, lede, NPI primary action, and public
  opportunity secondary action. A documentary clinical scene carries the human
  stakes; the existing source-state record becomes a tactile CV Wallet folio;
  current source-labelled roles appear directly below the hero; and the page
  continues through clinician choice, exact packet, employer review, accepted
  head start, and consented reuse. The existing NPI lookup, server-visible
  evidence rows, truth labels, and canonical motion infrastructure remain in
  place.
- **Truth and rights boundary:** The anonymous generated hero is art direction,
  not clinician, employer, result, or customer evidence, and its manifest plus
  adjacent disclosure record that boundary. It contains no patient identifiers
  or PHI. Opportunity rows preserve source, source URL, observation time,
  availability, and the external-versus-integrated application boundary. The
  page adds no readiness percentage, unsupported source, invented employer,
  speed promise, hidden ranking, automatic decision, packet mutation, or access
  change.
- **Accessibility and performance:** The production-build reading order remains
  complete without JavaScript and under reduced motion. Required viewport
  captures have no horizontal overflow; keyboard focus and semantic links are
  exercised. Computed contrast is at least 5.86:1 for measured hero text and
  18.71:1 for the primary action. The 201,854-byte LCP poster is below the
  250KB target, there is no shipped motion payload or required WebGL, and the
  controlled profile records LCP 816ms, CLS 0, and INP 24ms.
- **Evidence:** `docs/design/evidence/wo12-human-tactile-home-2026-08-14/`
  contains paired 390, 768, 1440, and 1728 before/after frames, full-page
  captures, the motion recording, reduced-motion and no-JavaScript frames,
  performance results, computed typography/contrast, asset measurements, the
  duplicate-intent record, and provenance disclosures.
- **Verification:** Focused Vitest coverage passes **7 files / 71 tests**. The
  production-build Playwright homepage suite passes **17/17**, including all
  required viewport, keyboard, reduced-motion, and no-JavaScript cases. Copy,
  claims, design, route, typecheck, zero-warning lint, and build gates pass. The
  final canonical root run passes **464 web files / 4,506 tests** and the
  real-PostgreSQL backend at **343 suites / 2,751 tests**. The seven web
  database-gated suites also pass **45/45** against ephemeral PostgreSQL 16.
  The first backend
  attempt compiled against a shared Prisma client generated from another
  worktree; after explicit backend-schema regeneration, one run reproduced the
  documented order-sensitive pilot-suite failure while that suite passed 6/6 in
  isolation. The final canonical run passed every backend suite and test; only
  that final green result is counted. Refreshed-head CI remains required before
  this entry can move from OPEN to LANDED.
- **Next gate:** Open the same-PR implementation and ledger receipt, attach the
  committed evidence, require all refreshed head checks green and `CLEAN`, then
  squash-merge. Verify Railway web and API `/api/version` at the exact merge SHA
  before exercising `/` on desktop and mobile. WO-13 begins only after that
  receipt is complete.

## WO-11 · Canonical Titan execution program — RESCUED IN #1368

- **Date:** 2026-08-13
- **Claim-check and stale-stack classification:** #1368 is the only open PR for
  the Titan execution-program intent. Its branch carried one UNIQUE docs commit;
  all preceding product and operations commits are LANDED on `main`. Codex
  rebased only that docs commit onto production baseline `d08b69231` and
  preserved the newer WO-11 market-evidence and WO-6 API-probe ledger entries.
  The concurrent lanes reused `WO-11`; this entry retains the program's
  pre-existing identifier while PR numbers remain the unambiguous work receipts.
- **Change:** Replaces the stale pre-reconciliation snapshot with
  `VITALCV_TITAN_EXECUTION_PROGRAM_2026-08-11.md` as the canonical current
  program. It records the founder's 2026-08-13 human+tactile decision, an
  evidence-bounded benchmark scorecard, clinician-opportunity strategy, the
  accepted-evidence differentiation, and ordered WO-12 through pilot waves.
  References to the removed dated action plan and handoff protocol are retired.
- **Truth and authority boundary:** The program implements the selected
  documentary-photography plus proprietary-tactile direction; it does not
  license invented metrics, unsupported sources, hidden employment ranking,
  automatic credentialing, or public outcome claims. Shared public chrome,
  security enforcement flips, destructive migrations, unsupported integrations,
  and high-stakes automated employment decisions remain separately gated.
- **Verification:** Docs-only change. `git diff --check`, copy and public-claims
  gates, typecheck, and build pass. The final non-interactive aggregate run
  passes **464 web files / 4,505 tests** plus the real-PostgreSQL backend at
  **343 suites / 2,751 tests**. The first aggregate attempt was interrupted
  after its TTY renderer retained control with no useful completion status; no
  interrupted result is counted as evidence. Require refreshed CI green and
  `CLEAN` before merge.
- **Next execution unit:** WO-12, the human+tactile homepage release. It starts
  with a dated EC-20 amendment and retains the visual evidence, no-JavaScript,
  reduced-motion, performance, truth, and exact-SHA production gates.

## WO-6 · API production surface probe — RESCUED IN #1370

- **Date:** 2026-08-13
- **Claim-check and stale-stack classification:** #1370 is the sole open PR for
  the anonymous API production-surface probe. Its product, disclosure-boundary,
  organization-binding, and market-evidence ancestors already landed on
  `main`; Codex classified those commits as LANDED and rebased only the two
  UNIQUE probe and ledger commits onto production baseline `253091496`.
- **Change:** Adds a dependency-free, anonymous API probe and a single shared
  public/guarded-surface contract consumed by both the post-deploy workflow and
  a real-app backend test. The workflow records a deployment receipt after its
  existing exact-SHA wait; the probe never sends credentials or performs a
  mutation. `/readyz` now fails closed: only HTTP 200 with `status: ready` can
  satisfy the deployment contract, so database-unready HTTP 503 cannot produce
  a false-green release.
- **Verification:** The focused real-app contract passes **45/45** through the
  real PostgreSQL harness, including the exact ready payload and an explicit
  assertion that HTTP 503 is never accepted. Curated public and guarded routes,
  plus any newly exposed undeclared route, are exercised through the real app;
  the larger census verifies mounted-route and tenant-boundary state without
  issuing 100-plus side-effectful requests inside the parallel database suite.
  The unrelated post-response investigator recovery is mocked to finish
  immediately so it cannot outlive the contract test. The census explicitly
  records the two issuer JWKS routes that answer 200 when the issuer-key secret
  is configured; they remain outside the curated availability probe because
  production baseline `253091496` returned 500 while that key was unavailable.
  The tightened read-only probe also passed every declared check against
  `https://api.vitalcv.com` at production SHA `253091496`: `/health` and
  `/api/version` agreed on the exact SHA, `/readyz` returned 200/ready, declared
  public routes answered as contracted, and all ten guarded routes returned
  `401 organization_context_required`. The final local gate passes typecheck,
  build, **464 web files / 4,505 tests**, and the real-PostgreSQL backend at
  **343 suites / 2,751 tests**. The web aggregate's 45 database-gated tests are
  exercised separately by the CI `web-quality` PostgreSQL step.
- **Next gate:** Require refreshed-head CI, including the PostgreSQL web-quality
  step, every required check green, and `CLEAN` before merge. After merge,
  require the workflow receipt and a live probe against the exact deployed main
  SHA.

## WO-11 · Land August 2026 market evidence — LANDED #1366

- **Date:** 2026-08-13
- **Claim-check and stale-stack classification:** #1366 is the sole open PR for
  the August market-evidence intent. Its previous branch contained an older
  stack whose product, directory, FTO, and name-clearance commits already
  landed on `main`. Codex classified those commits as LANDED and rebased only
  the one UNIQUE market-evidence commit onto production baseline `1b9632b24`;
  no stale stack content was retained.
- **Change:** Adds the dated five-ring market evidence brief, links it from the
  strategy index, records the bounded Axuall presentation-exchange design-around
  in `CLAUDE.md`, and extends governance-citation coverage to Markdown links in
  the operating and strategy documents.
- **Truth boundary:** The brief is rank-5 supporting research. Competitor,
  market, and regulatory figures remain attributed research and do not license
  public VitalCV outcome, verification, speed, compliance, or readiness claims.
- **Verification:** Focused governance and sitemap suites pass **2 files / 20
  tests**; copy and public-claims checks pass; `pnpm typecheck` and `pnpm build`
  pass. The first aggregate run found `/trust` freshness still stamped
  `2026-08-10` after #1372 changed that route; with no other open repair, this
  PR updates the factual sitemap date to its Git-derived `2026-08-14`. The
  corrected aggregate run passes **464 web files / 4,505 tests** plus the real
  PostgreSQL backend harness at **344 suites / 2,722 tests**. Merge required
  checks and `CLEAN` passed; #1366 merged as `253091496`, Railway reported that
  exact SHA, `/trust` published the corrected `2026-08-14` sitemap date, and the
  production-browser audit passed.

## WO-8 · Direction D homepage recovery — OPEN

- **Date:** 2026-08-11
- **Claim-check:** The production route resolves to `easy` when
  `PUBLIC_HOME_VARIANT` is unset; the live homepage served the dark `ezh-`
  composition at the start of this work. The implementation changes
  `apps/web/components/home/easy/`, not a rollback variant. A claim check of
  open and merged pull requests found no open `Watch it build` homepage
  implementation.
- **Change:** Added the dated EC-20 Direction-D route register, then rebuilt the
  served hero around the real NPI entry and one self-labelled record. The record
  names source-backed, clinician-controlled, access-required, and needs-review
  states; it is complete in server HTML and only gains its row assembly after
  hydration. The duplicate five-chapter homepage explainer is removed from the
  served composition. EC-10 shared chrome geometry is unchanged.
- **Truth and accessibility:** No real clinician, NPI, employer, source result,
  metric, or employer outcome is depicted. The illustration states that it is
  not a live result; the existing consent and institution-review boundary stays
  visible. The real NPI flow, keyboard access, and reduced-motion static frame
  remain covered.
- **Verification:** `pnpm check:design`, `pnpm check:copy`, `pnpm check:claims`,
  `pnpm typecheck`, a production `next build`, focused route tests (32 passed),
  and the production-build homepage Playwright suite (15 passed) all pass. The
  browser review measured 0px horizontal overflow at 390×844; the desktop
  implementation was reviewed at 1440×900. The pre-existing mobile shared
  chrome control cluster still overlays the viewport by its locked EC-10 design;
  it is recorded, not modified in this homepage-composition work order.
- **CI recovery (2026-08-13):** The restored remote gates found four server-frame
  assertions and two browser assertions still describing the retired dark,
  layered homepage. They now assert Direction D's light paper composition,
  Fraunces display/Geist reading contract, visible source states, and
  clinician-controlled disclosure boundary. `DESIGN.md` was regenerated after
  the Direction D tokens made its freshness test fail. `pnpm typecheck`, the
  production web build, focused Vitest (27 assertions), and focused production
  Playwright (26 browser checks) pass. The aggregate root command's web phase
  passes (460 files / 4,444 tests); its backend phase hit the known
  shared-worktree Prisma-generation collision while the isolated remote
  backend job is green. The next pushed head requires the full remote gate run
  before landing.
- **Gate:** Creative owner: Codex. Before merge, attach 390/1440 before-and-after
  screenshots, the reduced-motion capture, a motion recording, and review
  environment evidence to the PR. Production promotion remains outside this
  work order and requires explicit founder instruction plus exact-SHA proof.

## WO-10 · Trust Center source-record copy correction

- **Date:** 2026-08-12
- **Claim-check:** Checked open and recently merged pull requests plus remote
  trust-copy branches before editing. The older `hotfix/employer-trust-copy`
  and `trust-copy-pass` branches do not change this control card or its test.
- **Change:** Replaces the unsupported clinician source-observation correction
  promise with the exact implemented boundary: source-backed values retain their
  source and read time; clinicians may add self-attested profile information;
  VitalCV does not silently replace source records.
- **Verification:** The focused Trust Center test was run RED against the old
  card, then GREEN after the copy replacement. `pnpm check:copy` and `pnpm
  check:claims` cover the resulting public copy.
- **Scope boundary:** No clinician correction, review, attachment, overwrite, or
  dispute workflow was added.

## WO-4 · Remediate #1369 disclosure-boundary review findings — IMPLEMENTED LOCALLY, UNPUSHED

- **Date:** 2026-08-12
- **Finding and change:** The anonymous NPI timeline had remained a stated
  exclusion while reading and merging `acceptance` evidence. It now projects only
  the public-filtered passport collection and does not read or transform
  acceptance history, so acceptance labels, values, relationships, and derived
  recognition/trust effects do not cross the public boundary; public licensure
  evidence remains visible. The authenticated employer reader and the acceptance
  producer are unchanged.
- **Issuance boundary:** `POST /api/exchange/issue` now fails closed unless this
  deployment has a server-bound federation issuer and machine credential, and a
  timing-safe Bearer comparison succeeds. A caller may bind its request to that
  issuer but cannot select another configured federation member. The endpoint
  remains an explicit authorized exclusion from the public collection filter.
- **Verification:** Test-first RED reproduced the acceptance disclosure, the
  unclassified timeline route, anonymous issuance, and caller-selected issuer.
  GREEN: `pnpm --filter @vitalcv/web exec vitest run
  __tests__/recognition-timeline.test.ts
  __tests__/evidence-chain-disclosure-closure.test.ts
  __tests__/evidence-route-public-disclosure.test.ts
  __tests__/graph-routes-public-disclosure.test.ts
  __tests__/trust-exchange-route.test.ts` — **5 files / 61 tests pass**.
- **Next gate:** Run the repository pre-commit gates and `git diff --check`, then
  commit this review remediation without pushing. Any deployment that needs
  exchange issuance must provision the two server-only exchange-issuer settings;
  until then, the route returns its static unavailable response.
## WO-5 · Unblock #1364 — self-serve employer organization binding — OPEN #1364

- **Date:** 2026-08-11
- **Claim-check and rebase:** #1364 is the only open PR for the self-serve
  employer tenancy defect. Codex rebased its four commits directly onto current
  `origin/main` at `7de868d9d`, without merging any stale parent. The functional
  fix binds the setup user to the organization it just created; the data-only,
  idempotent migration backfills only unambiguous active memberships and preserves
  already-bound users.
- **Shared gate repair:** The failing backend check was reproduced under the
  CI-compatible Node 22 runtime. `hiringAutomationService` is a legacy
  `@ts-nocheck` module whose mixed Prisma value/type ESM import was elided by the
  ts-jest CommonJS transform, leaving `client_1` undefined before affected tests
  could execute. Its runtime `Prisma` namespace now uses an explicit CommonJS
  load and keeps `PrismaClient` type-only. The full run then exposed a second
  runtime-only Prisma field-name defect in the same module: the schema field is
  `isActive`, not `active`. Both repairs preserve the existing authorization and
  data semantics and remove the shared blocker for WO-6.
- **Verification:** After generating the backend client from the backend schema,
  the focused automation, Copilot strategy, self-serve DB/HTTP, and updated
  opportunity-service tests pass: **6 suites / 50 tests**, Node 22.20. The full
  real-Postgres backend harness passes **344 suites / 2,722 tests**; the aggregate
  root gate also passes (21 non-backend workspace tasks, 460 web files / 4,450
  tests, then the same backend harness). The unit mock now proves both
  existing-profile and create-profile flows call `User.update` with the resolved
  organization; the DB suites prove the resulting persisted behavior.
- **Next gate:** Run repository typecheck, build, and aggregate test gates on this
  rebased head; confirm the migration's second application is a no-op and that
  multi-org users remain unbound; then require `Backend Tests (Postgres)` and every
  refreshed head check to be green and `CLEAN` before merge.
## WO-4 · Rebase and land #1357 — ADR 0006 disclosure boundary — OPEN

- **Date:** 2026-08-11
- **Claim-check and rebase:** #1357 was the sole open disclosure-boundary
  follow-up and its stacked base `feat/g4-backlinks-adr0006` had already merged.
  Codex rebased the one-commit branch with `git rebase --onto origin/main
  feat/g4-backlinks-adr0006` after WO-3 landed at `7de868d9d`, then rebased again
  onto current `origin/main` at `e20b3d52d` after WO-5. `git range-diff
  3fd346a1^..3fd346a1 HEAD^..HEAD` reports the rebased commit as patch-equivalent;
  no stale base was merged in and `git diff --check origin/main...HEAD` passes.
- **Change:** Applies the explicit public-evidence allow-list before projection
  across the remaining NPI-keyed public route consumers, replaces raw internal
  error echoes with static client descriptions plus server logging, and adds
  structural and behavioral regression coverage for the route census.
- **Truth and authorization:** The route-level boundary does not make an
  NPI-keyed projection an authorization grant. Issuance, workspace configuration,
  and the product-owned timeline remain explicit, tested exclusions with their
  distinct authorization or product boundaries documented in the test.
- **Verification:** A public projection containing non-allow-listed data is
  exercised by `evidence-route-public-disclosure`,
  `graph-routes-public-disclosure`, and `evidence-chain-disclosure-closure`:
  **3 files / 49 tests pass**. `pnpm typecheck`, `pnpm build`, and diff checks
  pass. The aggregate root run passes 343/344 backend suites but repeats the
  unrelated, order-sensitive `pilot.routes` 500 result (its focused real-Postgres
  run is 6/6). This is recorded as a suspected suite-isolation defect and is not
  folded into the disclosure-boundary PR.
- **Next gate:** Open a replacement PR from the rebased Codex branch rather than
  force-pushing the stale Claude source; require its refreshed head checks to be
  green and `CLEAN`. Resolve the pilot-suite isolation defect in its own bounded
  work order before treating repeated aggregate red runs as a disclosure failure.

## WO-3 · Merge #1358 — clinician-record distribution and removal controls — OPEN #1358

- **Date:** 2026-08-11
- **Claim-check:** Claude's `wave/clinician-record-distribution` is the sole
  open PR for this intent. Its 11 commits and all required prior checks were
  inspected; it is `CLEAN` against its target. The Codex takeover branch merges
  current `main` before any new evidence is added.
- **Change:** Removes a real clinician's identity from the pilot proof and
  noindexes it; makes the public CMS registry record discoverable only behind
  the runtime `DIRECTORY_SITEMAP=enabled` switch; adds an on-page claim handoff,
  bounded analytics, removal contact, exclusion/noindex behavior, and source
  provenance for the declared NPI seed.
- **Truth and privacy:** This does not claim a directory record is credentialing
  or a verification result. The sitemap stays disabled by default. The removal
  path stops VitalCV from advertising the record and marks it `noindex`; it does
  not claim to alter the underlying CMS filing.
- **Verification:** Existing PR checks are green. Fresh `pnpm typecheck`, `pnpm
  build`, and `pnpm test` pass on the current merge ref; final diff review and
  a new head-check run remain required before landing.
- **Next gate:** Add this ledger entry in #1358, require all refreshed head
  checks to finish green with a clean merge state, then land it. Production
  enablement of the sitemap is intentionally outside this merge and requires a
  founder decision.

## WO-1 · Merge #1362 — delete `verifyProduction.ts` — OPEN #1362

- **Date:** 2026-08-11
- **Claim-check:** Ran the protocol resume sequence against `origin/main` at
  `35574fd9e`. #1362 is the sole open PR for this intent and is `CLEAN`; no
  merged PR or unclaimed branch duplicates it. A full text search finds legacy
  mentions in two historical `.claude/settings.local.json` permission entries
  and explanatory backend comments, but no import, package script, workflow,
  or executable caller. The deleted script itself was the only executable
  implementation.
- **Change:** Removes the orphaned production-check script. It asserted route
  outcomes that the current tenant guard cannot produce and was not wired into
  a runnable repository path.
- **Verification:** `git diff --check origin/main...HEAD` exits 0. `git grep
  -n -i 'verifyProduction' HEAD` found only historical text references after
  the deletion, not a runnable caller. The PR head's 14 check runs all reported
  `success`, including Backend Tests (Postgres), Web Quality, both Playwright
  suites, axe, copy, claims, design, route, and workflow-contract gates.
  WO-2 landed the focused `/pricing` correction in `b861a4abf`; on this updated
  merge ref, fresh `pnpm typecheck`, `pnpm build`, and `pnpm test` all pass
  (4,401 web tests passed; the suite's seven environment-gated files remain
  intentionally skipped).
- **Gate:** The merge includes the current `main` ledger rather than overwriting
  it, avoids a force-push, and keeps the executable deletion as the only
  functional change in this work order.

## WO-2 · Merge #1365 — Axuall '891 FTO read and presentation-exchange tripwire — OPEN #1365

- **Date:** 2026-08-11
- **Claim-check:** The open and merged pull-request lists and remote branches were
  checked before takeover. No existing merged work carried this FTO record or its
  dormant-presentation guard.
- **Change:** Documents the Axuall '891 research constraint, adds a five-file
  deployed OID4VP baseline and tripwire test, and corrects the stale `/pricing`
  sitemap `lastModified` value that made the existing full test suite fail on
  current `main`.
- **Verification:** The focused tripwire suite passes cleanly. Three deliberate
  injections failed as intended: a new deployed `presentation_definition` path,
  a product-page import of `AcceptancePanel`, and a product caller of
  `/api/oid4vp`; each was removed before continuing. `pnpm typecheck`, `pnpm
  build`, and `pnpm test` all pass.
- **Scope boundary:** This records a research and regression boundary only. It
  does not activate OID4VP exchange, change product behavior, or remediate the
  separately identified unauthenticated-endpoint concern.
- **Next gate:** Push this ledger entry, require all head checks to finish green
  with a clean merge state, then land #1365. Its sitemap correction unblocks the
  existing WO-1 deletion PR from a known baseline test failure.
