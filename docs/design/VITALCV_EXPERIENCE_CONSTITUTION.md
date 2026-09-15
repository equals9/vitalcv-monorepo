# VitalCV Experience Constitution

**Status:** CANONICAL — founder GO on the R2 layering, 2026-08-08. Phase 0 approved; EC-20 back-filled from the final UX-01 verdict (Direction B with amendments) per the ruling's execution step 3.
**Drafted:** 2026-08-08 (R1) · revised same day (R2)
**Successor-of-record to:** `VITALCV_CREATIVE_DIRECTION.md` (CD-1…CD-20), amended per CD-19 with a dated pointer forward — never a silent fork. CD remains a valid execution record; where the two documents disagree, this one wins.
**Companion:** `VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md` (execution plan) · `PARKED_VISUAL_ERAS.md` (freeze record).

**The layering rule (R2).** Every clause belongs to exactly one class:

- **Class A — INVARIANT.** Binding regardless of visual direction. Rejection law today.
- **Class B — DIRECTION-LOCKED.** Not law until the UX-01 founder verdict fills EC-20. Prior visual eras are raw material here, never authority.
- **Class C — CONTEXTUAL GUIDANCE.** Strong defaults enforced by design review with named rationale — never by CI.

Every clause is numbered **EC-n**. Reject a PR by citing a number — but only Class A clauses and locked EC-20 rows reject; see EC-21. Every product PR carries a **Design Handoff References** section naming the EC clauses it implements.

---

## EC-0. The design-only boundary and the freeze — Class A, founder-approved

This text rides at the top of every overhaul wave, verbatim:

> **DESIGN-ONLY BOUNDARY**
> This wave may change UI, UX, visual design, interaction design, responsive behavior, animation, information hierarchy, customer-facing copy, navigation presentation, and brand expression.
> It may not change application truth, authentication, authorization, consent semantics, data models, APIs, readiness calculations, agent policy, source behavior, employer decisions, business logic, or pricing behavior.
> If the proposed experience requires one of those changes, record it as a product dependency and stop. Do not solve it inside the design PR.

**Operating rule:** Product contracts are inherited. Visual decisions are not. No wave inherits a prior visual treatment merely because it exists.

**The freeze.** LIFTED 2026-08-09 (founder ruling) — UX-03 shipped as UX-V1 (#1190) plus #1232. The exemptions below are historical; the founder visual gate and the design-only boundary are what bind visual work now. **Exempt** (each still design-review gated): accessibility regressions; production-breaking UI defects; security/truth corrections; founder-authorized urgent fixes. No unrelated visual feature work rides an exemption.

---

## Part I — Class A: Invariants

### EC-1. Target feeling and the Easy Button frame

**Calm intelligence doing complicated work for you.** Not healthcare software you have to operate. The one product idea every surface serves: **"Enter your NPI. VitalCV does the rest."** The emotional target of the first session: *"That's it? VitalCV already knows this and is handling the rest?"*

The product must NOT primarily feel like: a credential wallet, an evidence network, a provenance system, a résumé builder, a credentialing vendor, a blockchain product, a data-viz project, a job board, or an AI chatbot. Complexity lives behind the screen.

### EC-2. The ten principles

1. Easy outside, sophisticated inside.
2. Show users what VitalCV did, not all the machinery used to do it.
3. One obvious next action.
4. Value before commitment.
5. Work completed is more important than data displayed.
6. Explain consequences, not system states.
7. Trust through clarity, not trust vocabulary.
8. AI manifests as work, not chat.
9. Mobile is designed independently.
10. Motion explains transformation.

### EC-3. Truth invariants

- **Truth outranks visual implication.** No treatment — color, motion, composition, chrome — may imply more certainty than the underlying data supports. This is direction-independent: it bans certainty-theatre on evidence in any palette.
- **No false verification, readiness, or employer claims.** Banned in customer-facing copy or attributes: "automatically verified", "guaranteed verification", "complete credentialing", "instant credentialing", "legally accepted", "risk transferred", "final verification without review", "source confirmed before response", "certified compliant", "HIPAA compliant" (→ HIPAA-aligned), "SOC2 certified", "NPDB" (as a customer-facing noun), "hire instantly", "blockchain-anchored", "zero-knowledge proof", "all 50 states", bare "Verified" as a status. Never a confirmed mark on gated (Nursys, FSMB) or non-integrated (NPDB, DEA, ABMS, SAM.gov, Doximity) sources.
- **Every asserted state is attributed:** what source, and how old. "Confirmed" is always qualified by what confirmed it and when. Freshness words never outrun the lane (`live`, `real-time`, `current` only where genuinely read per request). System-retrieved facts are never blurred with VitalCV-authored prose — *how* the distinction renders is Class B; *that* it renders is invariant.
- **Numbers animate only between real returned values.** Illustrative figures are static and labeled.
- **State-vocabulary freeze:** CD-5's six public states and the nine coverage + two review states in `packages/trust-state/sourceCoverage.ts` are reconciled by UX-02 via one mapping table. Until then neither vocabulary grows.

### EC-4. Meaning is never carried by color, motion, or hover alone

Every state renders as glyph + word (plus attribution per EC-3). Remove all color and the screen stays fully readable and fully honest. Meaning never lives exclusively in motion, hover, GPU, or a shader: reduced-motion, no-JS, and static fallbacks are first-class compositions, reviewed as such. One scroll owner per page (standing XS-1 law, `VITALCV_EXPERIENCE_SYSTEM_2026.md`).

### EC-5. The accessibility floor

AA minimum everywhere. Every state legible in grayscale and to a screen reader without color reference. Visible focus on every interactive element — never `outline: none`. Full keyboard path through every flow. 200% text zoom with no clipped control. 44px minimum touch targets. Motion, GPU, JS, and network all optional for meaning.

### EC-6. Mobile is designed independently

Every priority flow is composed for a 390px device deliberately — never stacked desktop. No horizontal scroll from 360px up. The chrome recomposes deliberately: the glass rail stays ONE detached bar at the top, narrower, with the link row and standalone sign-in folded into the takeover and the action shortened, and the page reserving clearance so no control is ever covered (EC-10, A-4).

### EC-7. Ownership and control — presentation preserves the controller

The product's canonical ownership model is inherited and is not redefined by UI vocabulary. Work is controlled by exactly one of: **the clinician · VitalCV · the employer · an institution (hospital, health system, board) · a source**. Presentation may simplify; it may never semantically collapse controllers.

Preferred presentation vocabulary:

- **VitalCV handles**
- **Needs your approval**
- **Needs you**
- **Waiting on / controlled by [the specific external actor]** — *"The hospital must review this step."*, *"Waiting on the state board."*

**"Employer decides" is used only when the employer actually decides the matter.** A licensing-board or hospital-controlled dependency is never labeled an employer decision.

### EC-8. The agent manifests as work, not chat

No chat bubbles, no fake transcripts, no giant conversational prompt, no "Ask VitalCV anything", no bot mascots. The agent behavior ladder — *observe → explain → recommend → prepare → execute with consent → escalate* — is an inherited product contract, untouched by design waves. **The ladder produces a bounded family of user-visible work states** (currently: VitalCV did it · VitalCV prepared it · VitalCV needs you · someone else controls it · something changed · something is blocked · finished). The family is presentation and may be tuned by design review; the ladder is not.

Approval moments are the sacred interaction: nothing moves without the clinician, and the UI makes that legible. Clinician control and consent remain visibly clear at every step. Activity renders as completed work — a record of what happened, by whom, when (see EC-9 for the nouns).

### EC-9. Customer-facing language

The system talks about: **VitalCV · your profile · jobs · applying · next actions · work VitalCV handles · hiring · starting.**

Never customer-facing: packets · artifacts · lanes · evidence networks · provenance · holder · readiness score · passport · wallet · graph · trust tier · dossier · credential object · recognition (as a UI noun) · any technical credential construct.

**"CV Wallet", resolved (founder ruling, 2026-08-15):** "CV Wallet" is permitted as a secondary product noun on interior locked surfaces (the existing `/pilot` and `/onboarding` EC-20 rows), never in acquisition-critical copy (homepage hero, primary CTAs, onboarding headings) and never required to understand or enter the product.

**Receipt, resolved:** `receipt` is an internal and audit concept. It remains lawful on audit and trust-center surfaces. Customer-facing surfaces say **"Activity"** or **"Completed work."** The same noun is never simultaneously banned and mandated.

**"Provider Career Evidence Network", retired (founder rulings, 2026-08-15):** the phrase is retired as public category language everywhere — it is not a customer noun, not an eyebrow, not metadata. The EC-9 machine ratchet no longer carries it as a ratified compound; remaining occurrences are frozen baseline debt scheduled against the surface waves that retire them (the homepage occurrences fall with the C1 vocabulary PR and the Direction A recomposition). The canonical customer nouns are **VitalCV · your VitalCV profile · VitalCV Jobs · Apply with VitalCV**.

The machine-checkable subset is planned as `scripts/copy-rules.json` (UX-16) — **it does not exist yet**; today's enforcement is `scripts/check-public-claims.ts`, which already covers every EC-3 banned string (verified W1080, 2026-08-08; its matcher normalizes hyphens and case, so "zero-knowledge proof" and "zero knowledge proof" both fail). Until UX-16 lands, cite the script, not the JSON. Voice: calm, declarative; facts with lineage, never enthusiasm; errors never apologize twice, never "oops."

### EC-10. The eyebrow — structural form is invariant

**Amended 2026-08-16 (A-4), superseding A-2/A-3's zero-height "palantir" group on the founder's
direct directive ("build the glass rail", 2026-08-16).** The site chrome is a **single detached
glass bar floating over the page**: one fixed, centred, max-width frosted rectangle held a short
offset from the top, carrying its instruments INSIDE it in flow — not floating over an inert
rectangle, as A-2 had it. LEFT: restrained identity (the wordmark). MIDDLE: a short, durable
primary link row, subordinate to identity and action — never the main event. RIGHT: quiet
sign-in, the real verify affordance, at most one dominant action, and the menu trigger. The bar
is frosted chrome (A-1) that degrades to a solid panel; its geometry is architecturally stable on
scroll — content moves beneath the glass, the bar never moves (register/colour may change,
position never). Menu opens as a full-takeover canvas that paints BELOW the still-live rail, with
a visible close control. Mobile recomposes deliberately: the rail stays ONE object at the top,
narrower, with the link row and standalone sign-in folded into the takeover.

**Banned forms:** a horizontal link row *as the main event*, SaaS status pills, a decorative
navbar carrying no product action, an ordinary slide-out hamburger sheet (the takeover is the full
index, not a partial drawer). **A-4 retires the ban A-2 wrote against exactly this shape:** a
floating rounded glass container and a backdrop-blurred bar are now the REQUIRED chrome form, on
the founder's directive — enforcing the old line against the founder-ordered rail is the
"guard enforcing retired doctrine" failure this document exists to prevent.

Exact geometry inside this form — offset, width cap, gutter, control sizes, corner language,
inversion behaviour — is Class B and locks in EC-20 (amended A-4). Shared chrome remains
founder-gated: this amendment implements the founder's 2026-08-16 directive and itself lands only
through the founder visual gate — the rendered rail still owes a FOUNDER VISUAL DECISION on its PR.

### EC-11. Value before commitment, and the four asymmetries

Value before commitment; one obvious next action on every surface. Against the named competitive bar (Medallion, Carefam — employer-first, demo-gated, unauditable claims, speed heroes):

1. They gate the product; **we give it away in the first viewport** — an NPI field that returns real state, no account.
2. They claim numbers; **we show one artifact** with source, timestamp, scope, and what it does not decide.
3. They speak to the back office; **we speak to the clinician.**
4. They say "AI-powered"; **we demonstrate it.**

### EC-12. Inheritance

Product contracts are inherited. Visual decisions are not. No wave inherits a prior visual treatment merely because it exists — including every era in `PARKED_VISUAL_ERAS.md` and every value in `VITALCV_CREATIVE_DIRECTION.md`'s palette and type sections.

---

## Part II — Class B: Direction-locked

### EC-13. The direction-locked register

The following are **not law until the UX-01 founder verdict fills EC-20**. Until then: prior-era rules in these domains (the CD mono law, CD pill retirement, CD glass/solid law, gradient bans, Calm Wave and 1505 values) are *candidate defaults and raw material* — they may not be cited to reject work, and no wave may ship new values in these domains outside an approved UX-01 exploration (the EC-0 freeze covers this).

1. Typography (faces, scale)
2. Palette (grounds, ink, accent)
3. Radius
4. Pill policy
5. Mono presentation policy (which facts render mono, and how)
6. Card grammar
7. Glass treatment
8. Gradient treatment
9. Rule/border treatment
10. Illustration policy (the EC-14 own-artifacts default supplies the interim posture)
11. Light/dark doctrine — including whether dark-first public exists; a dark verdict must explicitly supersede "light is the only public mode", wave-1505 LINT-04, and CD's 2026-08-02 one-Ink-chapter amendment
12. Exact eyebrow geometry inside EC-10's structural form
13. Product-UI visual density
14. Animation character and easing (the program's four timing bands are the working default structure; values lock at verdict)

EC-3 still applies inside every one of these domains — no locked or candidate treatment may imply false certainty.

---

## Part III — Class C: Contextual guidance

### EC-14. The guidance register

Strong defaults. A surface that departs from them is a **design-review finding requiring named rationale** — never a CI failure, never an automatic rejection.

- **Imagery:** the default is that VitalCV publishes its own artifacts — a real result, a real requirement list, rendered honestly. Stock clinician photography, isometric illustration, and decorative 3D are default-rejected at review; founder sign-off can override.
- **Section patterns:** avoid generic headers ("Features", "Why VitalCV") in favor of sections that say something.
- **Card usage:** cards earn their box; prefer structure from rules/space over container sprawl.
- **Editorial composition:** one argument per surface; density serves comprehension.
- **Where visual boldness is spent:** **NPI resolution is the first signature product moment** and the current concentration of the visual budget — but not constitutionally the only one. The Start Agent doing real work, approval moments, and successful completion are candidate signature moments the winning direction may elevate. Quietness elsewhere exists so signature moments land.
- **Public vs workspace register:** acquisition surfaces argue; working surfaces operate. The exact registers are shaped by the verdict.

*(EC-15 – EC-19 are retired in R2; see Appendix A for where each clause went.)*

---

## Part IV — Locked brand decisions

### EC-20. The brand decision table

The **structure** is locked now. The **values** are filled from the UX-01 verdict (`design-lab/homepage-reset/DECISION.md`) and locked thereafter. A wave that ships before back-fill inherits nothing visually — it waits.

**Verdict status: FINAL 2026-08-08 — Direction B GO, with amendments** (see EC-24 and DECISION.md). **Back-filled 2026-08-08 on founder GO** (R2 layering accepted). The amendments govern every value below: B's thesis is the brand (the product demonstration), the prototype is reference not implementation canon; dark-first warm-graphite is a **public register, not a mandate**; evidence artifacts stay **printable/light by default**; no 14–18s blocking hero — motion communicates the Easy Button quickly; the eyebrow gets its own UX-03 implementation and founder visual gate.

| Decision | Value | Status |
|---|---|---|
| Typography — display / body / mono faces | **Geist** (400/500/600) for display and body; **Geist Mono** (400/500) for machine facts and micro-labels | LOCKED |
| Type scale | Anchors from the verdict reference: hero h1 44–52px desktop / 30–34px mobile; micro-labels 11px mono uppercase `+0.08em`. Full ramp finalized in UX-02 within these anchors | LOCKED ANCHORS · ramp in UX-02 |
| Grid + page width | Full-width hairline-ruled band composition; content max ~1400px. Precise grid in UX-02 | LOCKED · grid in UX-02 |
| Eyebrow exact geometry (within EC-10's form) | **Amended 2026-08-16 (A-4)**, superseding A-2/A-3's zero-height floating group and every dimension it recorded (1480 cap, 70px inert rectangle, 205px action, radius-0 square instruments, bottom-pinned mobile cluster). **The glass rail:** a single `position: fixed` bar — `top: 14px`, `left: 50%` + `translateX(-50%)`, `width: calc(100% - 40px)` (20px inset each side), **capped at 1400px** (the content column, EC-20 grid row) and centred above the cap; rounded `--vt-shape-card` (20px), frosted (`backdrop-filter: blur(14px)` over a register-aware `color-mix`, degrading to a solid panel via `@supports`), soft `--vt-shadow-card` lift. **Inside it, in flex flow:** the wordmark (18px/600 Geist); the durable PRIMARY_NAV link row (`--vt-shape-action-page` 8px word-labels); then a right cluster — quiet sign-in, the shield-check verify affordance (44×44), the ONE dominant action (filled, `--vt-shape-control` 10px: paper-inverse over dark, ink over paper, never green/indigo), and the menu trigger (44×44). **Every control measures ≥44px (EC-5) as its real box** — no transparent-ring trick; the bar is ~60px tall. **Tablet (≤900px):** the inline link row folds into the takeover. **Mobile (≤767px):** the rail stays ONE bar at `top: 10px`, `calc(100% - 20px)` wide, `--vt-shape-control` radius; the link row and standalone sign-in fold into the takeover; the action shortens to its `shortLabel`. **The takeover rides the same centred, capped band** and carries a visible ✕ close (audit #56) | LOCKED (amended A-4) |
| Button grammar (primary/secondary/quiet/destructive; ≥44px targets locked via EC-5) | Primary = solid work-green square-cornered instrument with AA-corrected near-black ink (reference `#4ADE97`; solid `#2E9E6B` + off-white recorded as the alternative); secondary = hairline outline; quiet = text. Exact styles in UX-02 | LOCKED STRUCTURE · styles in UX-02 |
| Rule/border treatment | 1px hairlines structure panels and bands (`#2E2F33` on the graphite register) | LOCKED |
| Icon family | **Consolidate to one family in UX-02.** Two are installed today: `lucide-react` (imported by 330 `apps/web` files) and `@blueprintjs/icons`; 47 components also carry inline `<svg>`. Whichever wins must satisfy the locked grammar — 1px hairline weight, near-sharp 0–3px, no glass, no gradient, no glow — and the loser is removed, not left resident. Design review picks; this row records the constraint and the count | DEFERRED · UX-02 owns · constraint locked |
| Corner-radius philosophy + pill policy | **Amended 2026-08-09 (A-1, then A-2).** A-1 superseded "near-sharp 0–3px on panels and instruments; pills retired" and gave the public **scene register** a four-step shape scale — `--vt-shape-pill` 9999px, `--vt-shape-control` 10px, `--vt-shape-card` 20px, `--vt-shape-panel` 24px. **A-2 resolves what the scale left ambiguous: an ACTION is square, a WORD-LABEL may be a pill.** Every action on a public surface takes radius 0 — chrome instruments and page actions alike — and so does any illustration that DEPICTS an action. The pill survives for names and labels (source names, owner chips, disclosure tags, step indices), which makes the silhouette carry meaning: square means you can act on it. A-1's limits are untouched: evidence and operational surfaces stay near-sharp, and **a pill is never a state marker** (EC-4). Islands outside the scene register keep their own radii until migrated. **Amendment E (2026-08-15) resolves the seam A-2 left with Direction D:** on the public scene register, CHROME instruments and any illustration depicting chrome stay radius 0 (A-3 untouched); PAGE actions take `--vt-shape-action-page` (8px) — the value Direction D shipped and the e2e contract already pins. The bake-off artifact's 11px was normalized to 8px rather than minting a third value | LOCKED (amended A-2, then E) |
| Spacing rhythm | **Amended 2026-09-15 (UX-02A), superseding "No spacing scale exists yet."** One numeric, px-named, rem-valued scale: `--vt-space-{2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,36,40,44,48,56,64,72,84,96,112}` — 2px grain through 32, 4px to 48, 8px to 64, then the four section-band paddings. **Owner:** `apps/web/design-system/tokens/spacing.ts` (the one source of truth; `variables.ts` mounts it on `<html>`, `styles/tokens.css` carries the static CSS mirror, `__tests__/spacing-scale-contract.test.ts` pins the two). **Derived, not designed:** every step is a value the two public islands already painted (236 literals, 32 distinct, measured by `design-lab/spacing-histogram.mjs`), under the founder's zero-pixel-change ruling. **Consumers:** `styles/eyebrow.css` and `styles/easy-home.css` (the live `/` and the shared public chrome), 226 references, pixel-identical before/after at 1440/768/390 and the takeover at 1280/390. **Not on a step, kept literal as the debt the scale exposes:** `.ezh-stamp` gap 7px / padding-left 9px, `.ezh-fig-legend span` gap 7px, `.ezh-beat-frag` gap 7px, `.ezh-rv-step` padding 7px, `.ezh-rv-row` padding 11px, `.ezh-axis span` padding-top 11px, `section.ezh-hero` padding-top 150px, `.vcv-eb-menu` (≤767px) padding-top 76px; the two −1px offsets (`.ezh-sr`, `.ezh-beat::before`) are hairline alignment, not rhythm. **Drawn-glyph geometry is not rhythm and stays px:** `.vcv-eb__menu-glyph` gap 4px (three 1.5px bars in a fixed 18×14px box — on the rem scale it doubles at a 200% user font-size and the bars collapse to 0px; measured 2026-09-15). A value inside a fixed-px drawn artefact belongs to the drawing, not the scale. Rounding any of these onto the scale moves pixels and needs its own visual gate. Still bounded by the locked band composition (content max ~1400px) and the chrome gutter (20px each side, A-4). Other islands keep their literals until migrated — the scale is law for NEW spacing on public surfaces, and a migration is zero-pixel or it is a visual change | LOCKED (UX-02A, 2026-09-15) |
| Neutral palette (grounds, ink ramp, rules) | **Public register (dark, permitted not mandated):** ground `#141517`, panel `#1C1D20`, raised `#222326`, hairline `#2E2F33`, ink `#F2F1ED`, secondary `#9C9D99`. **Light register (required for evidence/printable/dense-legibility surfaces):** off-white family with graphite ink; exact artifact palette is a named UX-02 design task | LOCKED · light values in UX-02 |
| Interaction/accent treatment | **Amended 2026-08-09 (A-1): the accent-work merge is reversed.** Work-green (`#4ADE97`, `--vt-scene-state-source-confirmed`) is the single **work** colour — source-confirmed facts and completed work — and is **retired as the primary action**. The primary action is the warm-paper inverse instrument (`--vt-action-primary-bg` = scene paper, `--vt-action-primary-fg` = paper ink). Needs-you amber `#E4B45C`; waiting neutral `#8F8C88`. VitalCV indigo (`--vt-accent-editorial`, register-resolved via `-on-dark` / `-on-paper`) carries the focus ring and the editorial atmosphere, and is **never a status colour**. State words always in ink (EC-4). Full state-hue family reconciled in UX-02 with the EC-3 vocabulary mapping | LOCKED (amended A-1) |
| Mono presentation policy | Machine facts — NPIs, timestamps, state words, source names, micro-labels — in Geist Mono, `tabular-nums` | LOCKED |
| Card grammar | Solid hairline-ruled panels, radius 0–3px, no shadows | LOCKED |
| Glass treatment | **Amended 2026-08-09 (A-1), superseding "None."** Frost is permitted on **chrome and scene overlays only** — `--vt-frost-bg` / `--vt-frost-border`, both `color-mix` over scene surfaces, so the effect degrades to a solid panel wherever `backdrop-filter` is unsupported. **Evidence surfaces stay solid:** no frost on a proof row, artifact, receipt, or any surface a decision is read from. This restores CD's "glass on chrome, solid on evidence" as the operative line rather than a blanket ban | LOCKED (amended A-1) |
| Gradient treatment | **Amended 2026-08-09 (A-1), superseding "None."** Exactly one atmospheric gradient is permitted — `--vt-scene-glow`, the editorial indigo wash, **at most once per viewport**, behind a scene composition. It may never appear on a control, text, status marker, input, evidence surface, or card fill, and it carries no meaning: removing it must cost nothing but atmosphere (EC-4). No other gradient is authorised | LOCKED (amended A-1) |
| Light/dark doctrine | Dark-first warm-graphite is the permitted **public register**; the light register is **required** for evidence artifacts (printable by default, amendment 6), dense workflow surfaces, and legibility-critical contexts; **not** permanent dark everywhere (amendment 5). Explicitly supersedes CD-3 "light is the only public mode", CD's 2026-08-02 one-Ink-chapter amendment, and wave-1505 LINT-04's scope (rescoped in the EC-23 port) | LOCKED |
| Product-UI visual density | Designed in UX-02+ under **design review** — an EC-14 Class C judgement, never a CI rule. Bounded by what is already locked: cards earn their box, structure comes from rules and space rather than container sprawl, density serves comprehension, and working surfaces operate where acquisition surfaces argue | DEFERRED · UX-02+ owns · Class C, review-enforced |
| Illustration treatment | VitalCV's own artifacts plus abstracted, **self-labeling** product illustrations ("Illustration — not a live result"); no stock imagery | LOCKED |
| Animation character/easing + band values | Motion communicates the Easy Button **quickly**; no blocking or gating sequences (amendment 5); single-shot; the four-band structure holds; exact durations/easing set in UX-02 motion work | LOCKED CONSTRAINTS · values in UX-02 |
| Font delivery | Self-hosted variable `woff2` via `next/font/local` in `apps/web/app/fonts/`; never `next/font/google` | LOCKED |

State hues may never be spent as decoration (EC-3). The accent-work merge above is the recorded verdict decision. Rows marked "in UX-02" or **DEFERRED** are bounded design tasks inside locked constraints — not open questions.

#### Direction D homepage register — amendment D (2026-08-11)

The founder selected **D · Watch it build** for `/` on 2026-08-11. This is a
route-scoped implementation register for the production `easy` homepage; it
supersedes the conflicting Direction-B presentation on that route only. It does
not reopen the product, source, consent, authorization, or scene-truth
contracts above.

| Decision | Value | Status |
|---|---|---|
| Ground | Warm light paper `#f7f6f3` | SUPERSEDED by E (2026-08-15): `--vt-home-e-ground` `#FBFAF7` |
| Ink / dim / rule | `#131211` / `#5c5852` / `#e0ddd6` | SUPERSEDED by E (2026-08-15): `#141312` / `#5C5852` / `#E0DDD6` |
| Panel | Solid white `#ffffff` | SUPERSEDED by E (2026-08-15): unchanged value, `--vt-home-e-panel` |
| Accent | Deep green `#0f6d4e`, reserved for source-confirmation and focus | SUPERSEDED by E (2026-08-15): source-confirmation keeps green; focus returns to indigo per A-1; the page action takes `--vt-home-e-action` |
| Primary action | Ink `#131211`, white label, 8px radius | SUPERSEDED by E (2026-08-15): `--vt-home-e-action` `#D92800`, white label, `--vt-shape-action-page` |
| Hero H1 | `clamp(31px, 4.3cqw, 47px)`, 500 weight, `-0.035em` tracking, 1.04 line-height | SUPERSEDED by E (2026-08-15): `clamp(38px, 6.2cqw, 66px)`, 500, `-0.042em`, 0.96, Geist |
| Monospace | None on this surface | SUPERSEDED by F (2026-08-16): the mono law returns for machine facts on `/` (was: reaffirmed by E) |

The organizing idea is the product demonstration: a self-labelled career
record assembles row by row, naming the source or limitation on every row. The
complete record is server-rendered and visible before JavaScript; the assembly
effect may begin only after JavaScript marks the record animated. This preserves
the no-script and blocked-compositor failure mode.

**Deliberately not changed:** EC-10's shared public chrome geometry, its
instruments, and its route-declared theme mechanism. This amendment changes the
homepage composition beneath that chrome, not the chrome itself.

#### Human + tactile career-mobility amendment D.1 (2026-08-13)

The founder extended Direction D for `/`: the record remains the protagonist,
but the route may no longer ask an interface table and long-form copy to carry
the whole emotional load. The approved composition combines **original,
rights-cleared documentary clinical media** for human stakes with **VitalCV's
own tactile record objects** for identity, evidence, choice, packet review, and
reuse. This is an extension of Direction D, not a new homepage era.

| Decision | Value | Status |
|---|---|---|
| Public promise | **Amended 2026-08-15 (C1), superseding "The Provider Career Evidence Network."** — **Your VitalCV profile. Ready for every move.** | LOCKED for `/` (amended C1) |
| Hero headline | **One career record. More ways forward.** | LOCKED for `/` |
| Hero lede | **Start with your NPI. VitalCV assembles what sources can support, shows what still needs you, and helps you find roles where that record can move with you.** | LOCKED for `/` |
| Primary / secondary action | **Amended 2026-08-15 (C1), primary superseding "Start my CV Wallet."** — **Build my free profile.** / **Explore clinician opportunities.** (secondary unchanged) | LOCKED for `/` (amended C1) |
| Human media | Original commissioned, licensed, or generated documentary clinical imagery with recorded provenance; no patient, PHI, badge detail, employer mark, invented clinician identity, or implied outcome | LOCKED for `/` |
| Product media | Tactile folio and paper-object compositions built from the real record vocabulary: named source states, an explicit consent gate, exact packet, employer review, Recognition boundary, and fresh-consent reuse | LOCKED for `/` |
| Opportunity horizon | Current public listings may render without sign-up only with source label, original source URL where supplied, observation time, availability language, and the correct application boundary | LOCKED for `/` |
| Sequence | Record -> opportunity -> clinician choice -> exact packet -> employer review -> accepted head start -> reuse; the sequence is labelled as process, never as the visitor's result | LOCKED for `/` |
| Prohibitions | No dense network galaxy, generic SaaS card wallpaper, fake dashboard, staged white-coat portrait, fictional person or employer, invented result/score, unsupported source, or numerical speed promise | LOCKED for `/` |

The hero documentary still uses the existing `VisualScene` registry and the
existing record assembly treatment. A human image carries no evidence state.
Every source, limitation, consent choice, application boundary, and employer
decision remains selectable DOM text outside the pixels. The static server
frame is complete; motion is an optional single-shot enhancement and the
reduced-motion/no-JavaScript frame is the authored composition.

This amendment leaves EC-10 shared public chrome unchanged. It also leaves the
institutional authority boundary unchanged: the sequence may explain an
employer accepting a packet as a head start only when it says that this follows
an employer-recorded decision; it may not depict the current visitor as hired,
cleared, privileged, or started.

#### Public opportunity-field amendment D.2 (2026-08-14)

The founder extended the human+tactile career-mobility register to `/explore`
through WO-13. The route is an acquisition surface built from **current roles**,
not a dashboard and not a MATCHA verdict. Documentary clinical-setting media
supplies the human ambition; tactile, hairline-ruled listing folios carry the
real opportunity facts. Shared public chrome remains unchanged.

| Decision | Value | Status |
|---|---|---|
| Route promise | **Find clinical work with the source in view.** | LOCKED for `/explore` |
| Human media | An original, licensed, or generated anonymous clinical setting with recorded provenance; no patient, PHI, badge, employer mark, fictional identity, or implied hire | LOCKED for `/explore` |
| Dominant object | A real, source-labelled opportunity field with generous editorial hierarchy; no generic card grid or fake product dashboard | LOCKED for `/explore` |
| Required filters | Specialty, profession, location, schedule, and employment type; filtering never implies readiness or eligibility | LOCKED for `/explore` |
| Listing truth | Source and source URL, observation time, availability language and confidence, application mode, and supplied compensation provenance remain selectable text | LOCKED for `/explore` |
| Application boundary | External roles say **View original listing**; only integrated roles may say **Apply with VitalCV** | LOCKED for `/explore` |
| Prohibitions | No public readiness score, automatic eligibility verdict, hidden ranking, invented requirement, inferred compensation, stale listing disguised as current, or source-unavailable role presented as actionable | LOCKED for `/explore` |

The documentary frame is a manifest-owned `journey_film` route variant because
it carries human context, not opportunity state. The listings below are the
stateful surface: their facts come from the current API and remain complete
without the image. A route variant may select its own provenance-bound poster,
but it may not change the scene kind, invent state, exceed EC-29 budgets, or
move evidence facts into pixels.

#### Explore media pause amendment D.8 (2026-08-14)

The founder directed the current `/explore` composition to remove its documentary
frame for now. This amendment supersedes D.2's **mounted** human-media placement;
the parked manifest variant is not customer-facing authority to restore it. The
opportunity field, filters, source facts, and application boundaries remain
unchanged and now carry the page without an atmospheric raster.

Any future `/explore` image must be a dynamic close-up with human-centered,
optimistic energy: bright, vibrant, active, and visually immediate. Distant,
shadowed corridor views and isolated figures moving away from the viewer are not
authorized. A replacement still requires recorded provenance, no patient or PHI,
no readable badge or employer mark, and no implied identity, match, hire, or
outcome.

#### Opportunity detail and MATCHA continuity amendment D.3 (2026-08-14)

The founder extended the WO-13 register through public `/opportunities/[id]`
and the signed-in clinician detail in WO-14. The public route is a source-first
role record, not an application funnel. The signed-in route adds the clinician's
MATCHA explanation while preserving the exact source, observation,
availability, compensation provenance, and application mode from the public
record.

| Decision | Value | Status |
|---|---|---|
| Public composition | Editorial split hero with documentary clinical context, a tactile source ticket, a ruled fact register, source receipt, and one current application path | LOCKED for `/opportunities/[id]` |
| Public truth | Organization, role, setting, schedule, supplied compensation, source URL, observation time, availability confidence, limitation, and application mode remain selectable DOM text | LOCKED for `/opportunities/[id]` |
| Application boundary | External listings use **View original listing**; only integrated records may use **Apply with VitalCV**; closed or source-unavailable records expose no application action | LOCKED for opportunity detail |
| Signed-in MATCHA | **Why this may fit**, **Evidence gaps**, **Still unknown**, and **Clinician-controlled next steps**; no score, automatic eligibility verdict, hidden employer ranking, or inferred sensitive fact | LOCKED for clinician detail |
| Continuity | An integrated next step enters the existing selective-disclosure composer; the preview, consent, and sealed packet remain the canonical application chain | LOCKED for clinician detail |
| Media | Reuse the provenance-bound WO-13 documentary commission through a manifest-owned dynamic-route crop; the image carries human context only | LOCKED for public detail |

A closed direct link remains readable with `Closed` and its recorded limitation
instead of becoming an ambiguous 404. A public-feed role never receives
employer-stated requirements or a VitalCV application path merely because its
placeholder organization has data. MATCHA is clinician-side guidance: the
employer receives only the exact packet the clinician later chooses and
consents to submit.

#### Opportunity discovery-controls amendment D.4 (2026-08-14)

The founder directed `/explore` to reach the functional discovery bar of
HiringCafe while preserving VitalCV's own human+tactile register and stricter
source truth. WO-13B therefore extends D.2 with a horizontal **opportunity lens
rail** and richer advanced controls. This is a discovery layer over the same
canonical opportunity records, not a second job board, matcher, or visual era.

| Decision | Value | Status |
|---|---|---|
| Quick discovery | A keyboard-accessible horizontal rail for **Fresh from source**, **Pay in view**, **Apply with VitalCV**, locums, remote care, and profession lenses | LOCKED for `/explore` |
| Advanced controls | Existing role/place facets plus source-observation window, application path, supplied compensation detail, benefits detail, and explicit sort | LOCKED for `/explore` |
| Shareability | Every discovery selection is normalized into a bounded public URL and replayed by the server-owned API contract | LOCKED for `/explore` |
| Sorting | Most recently updated, role title A-Z, or organization A-Z; sorting does not imply fit, quality, eligibility, or employer preference | LOCKED for `/explore` |
| No-JavaScript path | Lens cards remain ordinary links and advanced controls remain native form elements; JavaScript enhances carousel movement and live filtering but does not gate the source-labelled field | LOCKED for `/explore` |
| MATCHA boundary | Natural-language intent and personal explanation belong to signed-in MATCHA; public discovery exposes no readiness score, hidden ranking, automatic rejection, inferred sensitive fact, or auto-application | LOCKED for opportunity discovery |

HiringCafe is a functional benchmark, not a design source to clone. VitalCV
keeps its documentary scene, paper-object geometry, source labels, observation
limits, and external-versus-integrated action boundary. A lens narrows records;
it never says the visitor qualifies. Missing compensation and benefits remain
filterable as missing rather than being inferred. The rail uses native overflow
with supplementary controls, requires no WebGL or new motion engine, and its
reduced-motion frame is identical except for immediate movement.

#### Employer exact-packet review amendment D.5 (2026-08-14)

The founder extended the human+tactile career-mobility register to
`/employers` through WO-15. The route must show the employer transaction rather
than explain it through a narrow text column: a clinician-selected exact packet
arrives, a human reviewer inspects it, clarification stays available, and any
acceptance is only a head start. Institution review and actual start remain
separate. Shared public chrome is unchanged.

| Decision | Value | Status |
|---|---|---|
| Route promise | **Review the exact packet. Keep the decision yours.** | LOCKED for `/employers` |
| Dominant object | A proprietary tactile **Employer Desk** process scene: exact packet -> consent gate -> inspect / clarify / institution review; the scene visibly stops before a decision | LOCKED for `/employers` |
| Human media | Original, licensed, or generated documentary clinical-operations imagery with recorded provenance; no patient, PHI, readable screen, badge, employer mark, fictional identity, or implied outcome | LOCKED for `/employers` |
| Interactive explainer | A keyboard-accessible horizontal review rail using the existing employer stages: request access, define requirements, receive the exact packet, inspect or clarify, accept as a head start, keep start events distinct | LOCKED for `/employers` |
| Review truth | Submitted packet version, clinician choice, named source and freshness, open gaps, clarification, employer-recorded head-start acceptance, and institution authority remain selectable DOM text outside the artwork | LOCKED for `/employers` |
| No-JavaScript path | Both scenes render their complete posters and transcripts; every review moment remains in DOM order and reachable through native overflow without JavaScript | LOCKED for `/employers` |
| Prohibitions | No fake candidate, employer, packet result, readiness percentage, approval seal, automatic decision, hidden ranking, credentialing replacement, start claim, generic dashboard wall, or unsupported numerical outcome | LOCKED for `/employers` |

The tactile Employer Desk uses a new `employer_desk` entry in the existing
`VisualScene` inventory and runtime. The documentary operations frame is a manifest-owned
`journey_film` route variant; it supplies human setting only and carries no
packet or outcome state. The interactive rail reuses
`EmployerWorkflowPreview` and `EMPLOYER_STAGES`, preserving one employer story
instead of creating a second carousel engine or review model.

The illustration is self-labelled as an example and stops at review, as
required by EC-25. The only real transaction action on the acquisition page is
the governed request for organization access. Type 2 NPI resolution remains
organization identity, not authority to act, and no visual treatment weakens
that boundary.

#### Activation-path amendment D.6 (2026-08-14)

The founder extended the human+tactile career-mobility register to `/pilot`
and `/onboarding` through WO-16. Both routes now show the same real product
continuity: public NPI record -> visible source states -> clinician-controlled
CV Wallet -> source-labelled opportunity. The pilot extends the path to the
exact packet and human employer response so it can measure the transaction;
onboarding stops at the first opportunity and preserves one visible next
action. Shared public chrome is unchanged.

| Decision | Value | Status |
|---|---|---|
| Pilot promise | **Prove the handoff. Measure what actually moves.** | LOCKED for `/pilot` |
| Onboarding promise | **Start with your NPI. See where your record can go.** | LOCKED for `/onboarding` |
| Dominant object | A proprietary tactile **Activation Path** process scene: abstract NPI card -> source-reading aperture -> CV Wallet folio -> clinician choice gate -> one opportunity doorway; it stops before application, review, decision, credentialing, hire, or start | LOCKED for `/pilot` and `/onboarding` |
| Shared path | NPI registry record -> separate source states -> saved CV Wallet -> source-labelled opportunity; `/pilot` alone adds exact packet and employer response as measured moments | LOCKED for both routes |
| Pilot measurement | Submitted packet, packet open, clarification, employer response, credentialing start, intended start, and actual start remain distinct events; every numerical outcome requires cohort, baseline, period, sample size, and lineage | LOCKED for `/pilot` |
| Onboarding action | The real existing NPI lookup/binding remains the single dominant action. Sign-in occurs only when the clinician chooses to save the public record; alternate training and recovery paths remain truthful and usable | LOCKED for `/onboarding` |
| Source truth | NPPES identity is a registry record match; OIG/LEIE and PECOS retain their real cadences; licensure stays access-gated; unavailable, unknown, invalid, organization-NPI, and system-error states remain explicit | LOCKED for both routes |
| No-JavaScript path | `/pilot` renders its complete process, source register, limits, and native request form without motion; `/onboarding` retains a server-visible public NPI fallback link when the session-aware client flow cannot run | LOCKED for both routes |
| Prohibitions | No fabricated pilot KPI, customer result, readiness percentage, employer decision, placement, start, source response, fake clinician, auto-application, generic KPI dashboard wall, or implication that the illustration is live product state | LOCKED for both routes |

The Activation Path is a new `process` entry in the existing `VisualScene`
runtime, authorized below through EC-22 rather than implemented as a second
illustration engine. Its selectable transcript carries the complete meaning;
the image contains no readable identity, source result, metric, status word,
employer, or outcome. The shared `ActivationPath` DOM component supplies one
semantic journey on both routes rather than two route-local diagrams.

#### Warm-glass and code-authored motion amendment D.7 (2026-08-14)

The founder directed the homepage lane to set aside its new photographic and
raster imagery for now and focus on animation, illustration, and motion
displays. This amendment replaces only the homepage media/material rows below. It
does not replace Direction D's paper, ink, Fraunces, source green, shared
chrome, real NPI flow, opportunity provenance, or career-mobility sequence.

| Decision | Value | Status |
|---|---|---|
| Homepage protagonist | The existing server-visible CV Wallet register becomes a warm frosted-glass object over a code-authored career horizon; the exact four source-state rows and clinician-choice boundary remain readable DOM text | SUPERSEDED by E (2026-08-15) |
| Homepage media | The D.1 documentary route variant is unmounted for this composition. No photo, generated raster, video, canvas, WebGL, fake person, or fake employer appears in the idle hero | SUPERSEDED by E (2026-08-15) |
| Motion | One-shot focus choreography may draw the career horizon, move a progress point, and catch light across glass. It never loops, hides the complete record, delays the NPI control, or resolves an employer decision | SUPERSEDED by E (2026-08-15) |
| Static behavior | All homepage objects and all truth text exist in the server frame. Reduced motion and no JavaScript show the complete final composition without hidden rows or required controls | SUPERSEDED by E (2026-08-15) |
| Reference synthesis | The supplied Dimension reference contributes translucency, backdrop blur, hairline highlights, pill labels, and restrained depth only. Its black canvas, violet accent, DM Sans/Geist register, gradient hero, and product category are not imported | SUPERSEDED by E (2026-08-15) |
| Technology-thesis boundary | This visual may show separate source states, an open-work boundary, selective clinician choice, and human review. It may not imply a deployed Trust Compiler, employer-policy satisfaction proof, universal acceptance, automatic eligibility, or a numerical readiness result | SUPERSEDED by E (2026-08-15) |

The two supplied professional-trust theses are treated as product and truth
context, not evidence that their target architecture is deployed. Their useful
visual consequence is separation: source-backed, clinician-controlled,
access-gated, and review-required states stay distinct. Their useful interaction
consequence is explainability: a viewer can follow what changed without a magic
percentage. Institution review remains visibly unresolved.

**A-1 classification.** The frosted homepage folio is an illustrative marketing
scene overlay, not current Wallet evidence, submitted evidence, a proof row, an
artifact, a receipt, or any surface from which a decision is made. Its text
names the evidence-state vocabulary but cannot be acted on. Operational and
decision-bearing evidence surfaces remain solid under A-1; D.7 does not license
frost on them.

#### Direction A homepage register — amendment E (2026-08-15)

The founder selected **Direction A** for `/` on 2026-08-15, at the end of a
four-round rendered bake-off (committed at
`design-lab/homepage-2026-08-direction-a/`, with the round-by-round rulings in
its `DECISION.md`). The directives this amendment implements, quoted from the
rounds: *"ok i like A the most. but i need illustrations and visuals not just
text"*; *"why isnt job opportunities mentioned once on homepage??"*; *"the idea
is for the clinician not needing to do anything. vitalcv keeps the clinician
updated and ready to get hired"*; and the standing bar: *"the user needs to
understand vitalcv within the first 30 secs of visiting the site."* Scope,
ruled the same day: the register applies to **all public surfaces, homepage
first**, under the homepage visual freeze recorded in
`docs/ops/FOUNDER_VISUAL_GATE.md`.

This is a route-scoped register for `/` in the Direction D lineage — it
supersedes the D/D.7 presentation rows marked above, and (once the C1
vocabulary amendment lands) the D.1 copy rows, without reopening product,
source, consent, authorization, or scene-truth contracts.

| Decision | Value | Status |
|---|---|---|
| Ground / ink / dim / rule / panel | `--vt-home-e-ground` `#FBFAF7` · `--vt-home-e-ink` `#141312` · `--vt-home-e-dim` `#5C5852` · `--vt-home-e-rule` `#E0DDD6` · `--vt-home-e-panel` `#FFFFFF` | SUPERSEDED by F (2026-08-16): the `--vt-home-f-*` warm-paper family, ground `#EDEAE3` |
| Primary page action | `--vt-home-e-action` `#D92800`, label `#FFFFFF` (4.94:1) · hover `#C42400` (5.83:1) · press `#B22000` (6.78:1) · radius `--vt-shape-action-page` | SUPERSEDED by F (2026-08-16): the paper-inverse ink instrument `--vt-home-f-action`; the radius row survives |
| Action-colour semantics | `#D92800` is an **action instrument, never a state**. It never renders as text-on-paper, a state chip, a chart mark, or a rule; removing it must cost nothing but emphasis (EC-4). It stays outside the `--vt-accent*` namespace. **`--vt-severity-critical` never renders on the `/` scene register** — the action red and the reserved revoked-red are distinguished by rule, not hue distance | LOCKED for `/` |
| Focus | Indigo `--vt-focus-ring-scene-paper` — restores A-1 on this route, superseding Direction D's green focus | LOCKED for `/` |
| Display | **Geist** (restores the EC-20 typography row; Fraunces is retired from the H1 and survives only as the serif editorial aside), hero H1 `clamp(38px, 6.2cqw, 66px)`, 500, `-0.042em`, 0.96 line-height | SUPERSEDED by F (2026-08-16): Fraunces returns as the display face on `/` |
| Monospace | None on this surface (Direction D row reaffirmed) | SUPERSEDED by F (2026-08-16): the mono law returns for machine facts on `/` |
| Material | Flat warm paper. **No frost on this route** — D.7's frosted folio is superseded; `styles/easy-home.css` leaves the frost allowlist with the recomposition. A-1's chrome-frost permission (the eyebrow rectangle) is untouched | LOCKED for `/` |
| Illustration | Drawn inline-SVG figures in the register inks (`--vt-home-e-figure-*`): every VALUE is a blank bar (`--vt-home-e-figure-bar`) because the real ones belong to the viewer; every figure carries its own self-labelling caption; no fabricated source response, count, score, employer decision, or completion (EC-25); art is `aria-hidden` with adjacent selectable caption text; complete in the server frame | LOCKED for `/` |
| Figure set | Six: sources→profile (hero — one row left visibly open where no source answered), match explanation (Roles), owner routing (Attribution), approval boundary + reuse (the dark band), standing watch | SUPERSEDED by F (2026-08-16): the v4 evidence-geometry set |
| Composition additions | A **Roles** section: the live opportunity feed (D.1 opportunity-horizon truth rows unchanged) framed by the match-explanation figure. A **standing watch** section: "Most weeks, you do nothing." — the clinician-does-nothing thesis stated to the limit of what the product truthfully does (watch, refresh, flag), never as a credentialing outcome | SUPERSEDED by F (2026-08-16): the live feed rides the v4 arc's Roles beat; the standing-watch section had already retired with E.1 |
| Dark band | The career-mobility sequence remains the route's one dark band, ground `--vt-home-e-ink`; its seven steps and boundary sentences are unchanged — the approval-boundary and reuse figures redraw its material, not its story | Retired by E.1 (2026-08-16); F has no dark band |
| Motion | One-shot only, inside the EC-29 bands: the figure line-draw reveal and the payoff line's **single-pass** cycling word (role → shift → hospital → state → application, then it settles). The server frame renders the settled word; reduced motion and no-JS show the settled word with an sr-only full sentence. Nothing loops | SUPERSEDED by F (2026-08-16): the cycling word retires; one-shot-only survives |

**Copy — supersedes the D.1 copy table (as amended by C1) when the
recomposition lands through the founder visual gate. This whole copy table is
in turn SUPERSEDED by F (2026-08-16), the founder's v4 copy as corrected by
standing law — see amendment F below:**

| Row | Value |
|---|---|
| Eyebrow | **For US clinicians** |
| Hero H1 | **Enter your NPI. VitalCV does the rest.** |
| Payoff line | **One profile. Every** {role · shift · hospital · state · application}**.** — settled word: **application** |
| Hero sub | **We find what we can, show you exactly what remains, and handle the administrative work that can safely be handled. Then we keep it that way — and show you where your record could go next.** |
| Primary action | **Start with your NPI** (matches the chrome action verbatim) |
| Secondary action | **Explore clinician opportunities** (unchanged) |
| Metadata tagline | **VitalCV — One career record. More ways forward.** (unchanged — noun-clean) |

**Deliberately not changed:** EC-10/A-3 shared-chrome geometry and its frost;
A-1's indigo-carries-focus rule (restored here, not modified); LINT-15's
green-action ban; the film and career-loop rollback variants and their
stylesheets; the opportunity-feed truth contract (honest SSR pending state,
source labels, observation times, the external-vs-integrated application
boundary); EC-9's "CV Wallet, resolved" interior-surface ruling (C1) — the
noun simply no longer appears on `/` once the recomposition lands.

**Law-then-values order (the A-1 lesson, inverted deliberately):** this
amendment and its tokens land while the route still renders D.7 under the
2026-08-15 homepage visual freeze. The recomposition PR that makes `/` match
this law carries the full founder visual gate. Until it merges, D.7 remains
what the route SHOWS, and this section is what the route OWES.

**On the difference (W1080 closure, 2026-08-08).** Three rows previously read
"PENDING UX-02", which is indistinguishable from an unresolved brand decision and
made the table read as incomplete when it is not. A deferral is legitimate only
when it names **the wave that owns it** and **the constraint it decides within**;
all three now do, and each records what was measured rather than a value nobody
has chosen. No row in this table is an open question, and no wave may fill a
DEFERRED row by inventing a value — EC-22 applies unchanged.

#### Composition amendment E.1 — the simple bottom half (2026-08-16)

Founder directive, same day the E recomposition reached its first production
render, quoted verbatim: *"everything currently live on localhost:3210 i am
not liking at all — specifically from 'only what you approved crosses over.'
down to the end of the page is all wrong. i dont like the visuals, i dont like
the headlines, its very very complicated and confusing. the user doesnt even
need to know the information presented. vitalcv needs to show simple,
practical, easy, positivity, and fun. not: boring, text-heavy, confusing,
complicated and constipated."*

**What this amends.** E's composition rows below the Roles section. Retired
from `/`: the seven-step career-mobility band (a D.1 inheritance), the
standing-watch section, the ownership/attribution section (four state cards +
ledger), and the five-item FAQ — with their four figures (owner routing,
approval boundary, reuse, standing watch). The information was true; a
homepage visitor does not need it. It remains taught where it is load-bearing:
`/trust` (the state grammar), the product surfaces themselves (ownership and
approval mechanics, at the moment of use).

**What replaced it.** One `ThreePromises` band — three benefit cards, each a
single claim stated once (the record moves with you · nothing is shared
without your say · VitalCV watches the dates), each with a small aria-hidden
pictogram that depicts no source, count, person, or result — then three flat
Quick-answer lines (the credentialing boundary, cost, no-account look), a
one-row employer doorway, and a centred final action ("Ready when you are.").

**Deliberate non-changes.** The hero, Recognition moment, Roles section, and
truth-boundary line stand exactly as E shipped them. The E register rows
(palette, action colour ladder, radius, type, figure material) are untouched —
this is a composition amendment, not a register amendment. The truth contract
loses nothing: consent and the institution-review boundary are still stated,
once each, in words a visitor would actually read.

**Composition budget.** The page-wide prose text-node ceiling tightens from
145 to **110**, enforced by `homepage-composition-gate.test.tsx`. Additions
are funded by cuts, permanently.

#### Composition amendment E.2 — clinical theme and motion (2026-08-16)

Founder directive on the shipped E.1 page, quoted verbatim: *"its better for
sure. but its lacking the clinic/clinician/hospital theme. again less text
more higher level and simplified visuals. the whole thing needs to be
interactive and animated, trendy, clean, polished, fun, smart engaging motion
throughout."*

**Theme ruling (2026-08-16).** The clinical theme was selected from a
three-option rendered bake-off. The founder picked **Option 1 "Chart &
Badge"** — the clinic expressed through its OBJECTS — verbatim: *"i think
option 1 is headed in the right direction. not perfect but [better] than the
two others."* Considered and **not selected**: Option 2 (an EKG/pulse-line
motif as connective tissue) and Option 3 (drawn clinician characters). Both
are recorded as rejected vocabulary for this route: no EKG/pulse-line
connective motif, and no drawn people. "Not perfect" is the founder's caveat —
refinement is expected at the visual gate.

**What this amends.** Three things, all inside the E register: the page gains
a clinical drawn-pictogram vocabulary, loses another pass of text, and gains a
page-wide one-shot motion system. Nothing outside `/`'s presentation moves.

| Decision | Value | Status |
|---|---|---|
| Clinical pictogram vocabulary | **Drawn only, never photographed** — the Option 1 "Chart & Badge" object set: simple 2px-stroke pictograms in the register inks, always `aria-hidden`, always depicting an OBJECT and never a fact. The profile is a clinician's **ID badge** (accent band, punched lanyard slot, empty photo frame, blank identity bars) whose **chart rows** fill from **labelled source pills** (pills are the ratified shape for source-name word-labels); source pictograms are registry building (NPPES), **cross-in-shield used sparingly** (state board), flag (federal list); plus watch-with-stethoscope curve (the standing-watch promise) and plus-in-building (an open role's facility). **Rejected:** EKG/pulse-line connective motifs and drawn clinician characters. No pictogram may depict a source response, count, score, person, employer decision, or result — EC-25 applies to pictograms exactly as to scenes. D.8's commissioning boundary for photography is untouched: this vocabulary does not authorize any raster or photographic asset | SUPERSEDED by F (2026-08-16): the v4 evidence-geometry set replaces the Option 1 pictograms; "drawn only, never photographed", the EC-25 pictogram rule, and both rejections survive |
| Motion posture | **The record assembling — one-shot entrances + micro-interactions, inside the EC-29 bands.** The badge clips on with a small swing settle (rotation ≤1.4°, the route's one narrative accent, 450–800ms band); chart rows slide/fade in sequence; connector lines from the source pills draw once (stroke-dashoffset). Section entrances are an IntersectionObserver-armed enhancement over an SSR-complete page: content is fully present in the server frame, hydration arms the one-shot reveal, a safety timer force-completes it, late-mounted sections are caught, and each section reveals exactly once. Micro-interactions (hover/press on cards, rows, and actions; the NPI digit-count pop) sit in the 80–150ms feedback band; state transitions 150–250ms; entrances and line-draws 250–450ms. Calm and precise, not showy. The digit counter animates only between real typed counts (EC-3) | PARTLY SUPERSEDED by F (2026-08-16): the section-entrance system, one-shot grammar, and band discipline survive and are adopted; the badge-swing and count-pop retire with their objects |
| Loops | **System-status pulses only** — EC-29's named exception. The one instance: the live feed's "Listed as open" availability dot may carry a slow opacity pulse, because it restates a status the row already states in words (EC-4). Nothing else on the route loops: no looping hero, no ambient sweep, no shimmer | LOCKED for `/` |
| Reduced motion / no-JS | The finished frame, with **zero animation**: the reveal system never arms, the pulse does not run, and every section, figure, and row is complete — asserted by `design-kernel.spec.ts` and `home-easy.spec.ts` against a production build | LOCKED for `/` |
| Scroll ownership | Unchanged: the document is the one scroll owner (EC-4). No scroll-snap, wheel listeners, or scroll-driven animation libraries (XS-1, R8) | LOCKED for `/` |
| Hero sub (supersedes the E copy-table row) | **We find what we can, show you exactly what remains, and keep it that way.** — one sentence | SUPERSEDED by F (2026-08-16): the v4 hero lede |
| Composition budget | The page-wide prose text-node ceiling tightens from 110 to **90**, enforced by `homepage-composition-gate.test.tsx`. Additions are funded by cuts, permanently | SUPERSEDED by F (2026-08-16): the founder's v4 is a deliberately denser document; the F ceiling is 285 (measured 259 + headroom) |

**Copy discipline (the "less text" pass).** Promise bodies are one sentence
each; Quick answers are one line each; the Roles subhead is one sentence; the
truth-boundary line shortens while keeping its two load-bearing phrases —
"nothing has been sent" and "institution review" — verbatim.

**Deliberately not changed:** the E register values (ground, ink, action
ladder, radius, type, figure inks); the E.1 composition order (hero →
Recognition → Roles → truth line → three promises → quick answers → employer
doorway → final action); the hero H1, payoff line, eyebrow, and both action
labels; the Roles feed contract (source labels, observation times, honest
loading/error/empty states, the external-vs-integrated application boundary);
the truth boundaries (consent stated once, institution review deciding, figure
self-labels and hidden transcripts); `NpiReveal`'s resolved-state semantics;
and `OpportunityHorizon`'s data contract.

#### Homepage v4 register — amendment F (2026-08-16)

**Founder directive, quoted verbatim: *"Implement: VitalCV Homepage v4.html"*
(2026-08-16).** The founder's design is committed byte-for-byte at
`design-lab/homepage-2026-08-v4/` (`index.html` + `vitalcv-ill-v4.css` +
`DECISION.md`). Its committed defaults: paper `#EDEAE3`, accent `#4338CA`,
illustration `filled`, motion `ambient`, headline **"Get hired faster. Start
working sooner."** This amendment is the design's law of record for `/`; it
**supersedes the E / E.1 lineage wherever the two differ**, and every
supersession is marked on the E rows above. It lands in the same PR as its
implementation (EC-22), and the route ships only through the founder visual
gate — no `FOUNDER VISUAL DECISION` on the rendered result is recorded yet.
Amendment E.2 landed the same day, before this one; F carries E.2's motion
SYSTEM forward (the one-shot section entrances, the live feed's status-pulse
loop, the row-arrival) while superseding its clinical pictogram vocabulary
and its copy/budget rows — each E.2 row above carries its own marker.

| Decision | Value | Status |
|---|---|---|
| Ground / raised / inset | `--vt-home-f-ground` `#EDEAE3` · `--vt-home-f-raised` `#F6F4EF` · `--vt-home-f-inset` `#E3DFD5` — warm paper with raised and inset paper surfaces, hairline-ruled document composition (`--vt-home-f-rule` `#D9D4C8`, `-rule-strong` `#B8B1A1` decorative only) | LOCKED for `/` |
| Ink family | `--vt-home-f-ink-strong` `#1A1815` · `-ink` `#2B2823` · `-ink-muted` `#57534A` · `-ink-subtle` `#655E51` — all AA-measured on ground, raised, and inset (worst pair 4.82:1) | LOCKED for `/` |
| Signal | `--vt-home-f-signal` `#4338CA` (+ `-signal-wash` `#ECEBF8`) — byte-equal to the CD-4 light-theme indigo, declared register-locked. Links, focus, the accent word, and drawn-figure emphasis; **never a state hue, never a status fill**. Supersedes E's hot `#D92800` as the route's one accent | LOCKED for `/` |
| Primary page action | The paper-inverse ink instrument (A-1): `--vt-home-f-action` `#1A1815`, label `#F6F4EF` (16.12:1), press `#32302D` (11.97:1), radius `--vt-shape-action-page` (the E seam value the e2e contract pins). Supersedes E's `#D92800` action | LOCKED for `/` |
| Display | **Fraunces** returns as the display face on `/` (H1, section H2s, beat headings), Geist for prose — supersedes E's Geist-display row. Self-hosted via `next/font/local` only | LOCKED for `/` |
| Monospace | **The mono law returns to `/`** — machine facts (the NPI field, digit counts, masked NPIs, source names, cadence labels, state stamps, micro-labels) render in Geist Mono with `tabular-nums`: *if you are looking at mono type, a source returned it*. Supersedes D's and E's "None on this surface" rows | LOCKED for `/` |
| State grammar | **Five states, no others**, each glyph + word in ink (EC-4): ● Source-confirmed (`--vt-state-source-confirmed`) · ◐ Snapshot, cadence inside the value (`--vt-home-f-snapshot` `#6E5A1C`, minted — no existing hue means "true as of a dated file") · ▲ Needs you (`--vt-state-pending`) · ⊘ Access required (`--vt-state-access`) · ○ Not checked (ink-subtle). Hue carries only the glyph and a left rule | LOCKED for `/` |
| Composition | Hero (H1 + NPI underline field + hero folio figure) → interactive resolution scene (eight real registry rows · read log · tally · next actions) → trust-flow diagram (four hops, one barred source) → five-beat arc with the **live opportunity feed** as the Roles beat's expansion (the jobs-on-`/` founder ruling holds; feed truth contract untouched) → truth boundary → exact-packet shape + refuses-to-decide list + state legend → employers (four claims + illustrative requirement ledger) → honest limits → close → footer with the source-cadence sentence | LOCKED for `/` |
| Motion | **Amended by F.1 (2026-08-16) — ambient loops ALLOWED.** One-shot entrances (E.2's system): the hero folio tile arrivals (220ms, state-transition band); the reveal's one-shot stagger; E.2's `useSectionReveals` one-shot section entrances (340ms, product-transformation band) over an SSR-complete page; and E.2's `ezh-row-in` for late-mounted feed rows. **Ambient illustration loops (founder "Allow ambient loops", 2026-08-16, EC-29 amended in the same PR):** the hero cadence line traces continuously, the trust-flow packet travels, the accent connectors dash-march, and illustration marker glyphs tick — all inside `.ezh-fig-art` only (EC-4: never a control, text, status, or evidence surface). The live feed's "Listed as open" status pulse (EC-29's separate system-status exception) stays. **Reduced motion stops every animation on the route** — the invariant, e2e-asserted. Server frame complete | LOCKED for `/` (amended F.1) |
| Text-node budget | **285** (measured 259 at landing + ~10% headroom) — supersedes E.1's 110: the founder's v4 is deliberately denser than the simple-bottom-half composition. Enforced by `homepage-composition-gate.test.tsx`; additions are funded by cuts | LOCKED for `/` |

**Copy of record for `/` (the founder's v4, as corrected by standing law):**

| Row | Value |
|---|---|
| Eyebrow | **For clinicians · no account required** |
| Hero H1 | **Get hired. Start working sooner.** — see deviation 1 |
| Hero lede | **Parts of your record already live in public sources employers trust. Enter your NPI and see what they return, what still needs you, and what nobody can read yet — before anyone asks you for a folder.** |
| Primary action | **Start with your NPI** (matches the chrome action verbatim) |
| Secondary action | **Explore clinician opportunities** (unchanged) |
| Tally caption | **Counts are of lanes, not a score. VitalCV does not grade clinicians.** — verbatim from the founder's v4, load-bearing |
| Duration note | **Durations are pilot targets, not returned data** — adjacent to the arc's axis |
| Metadata title | **VitalCV — One record, every job after it.** (the v4 title, wallet→record) |

**Port-manifest deviations — where standing law required the port to differ
from the committed v4 file. Each is a correction the founder can reverse only
by amending the law it cites:**

| # | The founder file said | Shipped as | Law |
|---|---|---|---|
| 1 | H1 **"Get hired faster. Start working sooner."**; axis ends **"Days, not months"** | **"Get hired. Start working sooner."**; axis ends **"Days"**, with the file's own honesty note ("Durations are pilot targets, not returned data") kept adjacent | `check-public-claims` bans "hired faster" and "days, not months" (brand-split ruling 2026-07-26 — un-retire only by deleting the gate entry once a pilot produces the number). **Open founder question** |
| 2 | "wallet" throughout — title, nav, arc eyebrow, H2, figure labels | "record" / "your record" throughout; H2 **"One record, once — then every job after it."**; title likewise | Strategy contract; EC-9; C1 ruling (#1392); `check:copy` tier 1 |
| 3 | Demonstration NPI **1043002765** + a "Use the demonstration NPI" button | Masked `NPI ··· ··· ····` in every illustration; the demo button is deleted; the interactive resolve wires to the real lookup (`useCareerLoop` → bootstrap + trust-state), and real data replaces the idle ledger on resolve | A well-formed NPI may name a real person; EC-25.1; the recognition-moment contract |
| 4 | Illustrative reads from **ABIM/ABMS** (not integrated), **NPDB** (banned noun), California `A-96421` / Oregon `MD187254` licences with expiry dates, **UCSF Health** privileges, **Meridian Health** recipient, `PKT-…` ids, `sha256` hashes, `vitalcv.com/verify/…` URLs, fixture clocks, OIG "no match returned" | The REAL registry lanes only (NPPES read live · OIG/LEIE monthly snapshot · PECOS quarterly snapshot · state licensure access-gated · employment/board-cert not read), blank bars for every value, no ids/hashes/URLs/clocks, no employer names, no depicted OIG response | EC-3, EC-25.2/3; NPDB ban; the no-fixture-clock rule |
| 5 | A six-state legend including **"Adverse · under dispute"**; heading "Six states, no others" | Five states; heading **"Five states, no others"**; Confirmed→**Source-confirmed**, Needs attention→**Needs you**, Snapshot keeps its cadence inside the value | Never teach a state the product cannot produce; EC-3 state-vocabulary freeze |
| 6 | Motion default **ambient** (infinite ECG draw, packet-travel, link-dash, beat-tick loops) | **Ambient loops IMPLEMENTED** (founder ruled "Allow ambient loops", 2026-08-16, after the initial single-shot port): the four `body.mo-amb` behaviours run inside `.ezh-fig-art` illustration art; reduced motion stops all of them | Initially shipped single-shot under EC-29's no-loop rule; the founder ruled to allow ambient, and **EC-29 was amended in the same PR (F.1)** to permit bounded ambient illustration loops on the `/` scene register — scoped to figures only (EC-4), reduced-motion-killed |
| 7 | A **floating glass nav rail** (fixed, rounded, frosted) | **PORTED — gap closed by amendment A-4 (2026-08-16).** F correctly recorded this as needing a separate founder chrome ruling; the founder then gave it ("build the glass rail"), so the rail is now VitalCV's shared public chrome and EC-10's ban on the floating rounded container is retired. The rail is chrome-only — it does not touch this route's register, which stays F's warm paper | EC-10 + EC-20 eyebrow-geometry row, **amended A-4**; `FOUNDER_VISUAL_GATE.md` (the rendered rail still owes a founder visual decision) |
| 8 | Intro claims "a real proof packet"; button **"Open a real public packet"** | The section is explicitly illustrative ("This is not a real submission"), values are blank bars, and the quiet link points at the real public surface, `/verify` | Packet receipts ship dark; `decisionGrade: false` is untouchable; EC-25.4 |
| 9 | Google Fonts `<link>`s; React/Babel tweaks scaffolding | Self-hosted `next/font/local` faces already in `app/fonts/`; no scaffolding | EC-20 font-delivery row |
| 10 | Section H2 vocabulary: "A job board that reads your credentials…" (carried from E) | **"Roles, read against your record — not your keywords."** — the noun "job board" is banned from the route | Founder UX audit 2026-08-16: VitalCV is not a job board; the noun hands the category away |
| 11 | "8 lanes" and lane-vocabulary throughout the customer copy | "lanes" survives in exactly ONE customer-visible line — the founder's load-bearing tally caption (row above, kept verbatim). Everywhere else: rows / sources / checks. The EC-9 AST ratchet baseline records the single occurrence (+1 in `ec9-vocabulary.baseline.json`, net total unchanged) | EC-9 (the EC-9/EC-20 vocabulary contradiction remains open for founder ruling; this amendment does not resolve it) |
| 12 | NPI input placeholder `0000000000` | Placeholder `··· ··· ····` (the 3-3-4 mask) | The homepage renders no ten-digit sequence (masked-NPI rule) |
| 13 | Idle resolution fixture: 8 invented reads with timestamps ("read 14:02 today", "Local time 14:02 · 2026-08-10") | The idle ledger is the real registry with **nothing read yet**: seven ○ Not checked rows + one ⊘ Access required (licensure), tally 7/1/0, log "Idle. No source has been queried."; no clock anywhere | EC-3 (numbers/times only from real returns); the request-clock trap |

**Deliberately not changed:** EC-10/A-3 shared-chrome geometry and its frost
(true as of F — **subsequently superseded by A-4**, which ported the rail on the
founder's chrome ruling; F's own row 7 above records the closure);
A-1's indigo-carries-focus rule; LINT-15's green-action ban; the film and
career-loop rollback variants and their stylesheets; the opportunity-feed
truth contract (honest SSR pending state, source labels, observation times,
the external-vs-integrated application boundary); the recognition-moment
pipeline (`useCareerLoop`, `buildEvidenceCapsule`, `NpiReveal` — presentation
re-cut to the v4 ledger, no API/auth/consent/data change).

#### Acquisition-vocabulary amendment C1 (2026-08-15)

Per the founder vocabulary rulings of 2026-08-15 (Wave C1): **"Provider Career
Evidence Network" is retired as public category language**, and **"your VitalCV
profile" is the primary clinician-facing object**. Two D.1 rows change and no
others: the public promise becomes the clinician promise line, **Your VitalCV
profile. Ready for every move.**, and the primary action becomes **Build my
free profile.** The H1, lede, and secondary action are untouched, as is every
media, motion, and material row.

**CV Wallet** remains lawful as a **secondary product noun** — the D.6 `/pilot`
and `/onboarding` rows and the D.7 work-surface register stand — but it is
never required to understand or enter the product, and it no longer appears in
acquisition-critical copy (see the EC-9 resolution of the same date). PTC stays
technical/R&D language and gains no customer-facing standing from this
amendment. This is a copy amendment: no visual recomposition, no layout,
motion, or CSS change rides it.

---

## Part V — Profile in Motion: the visual narrative system

Added by CC-01 / VIS-01 (2026-08-08) from `docs/design/VITALCV_LIVING_PROFILE_VISUAL_SYSTEM_2026-08-08.md` (the founder brief, committed with this amendment), amended in place per EC-22. These clauses govern illustration, scene, and motion work. They do not touch application truth, authorization, consent, data models, source behavior, or employer decisions (EC-0).

### EC-25. Scene truth review — Class A

Every scene, still or moving, passes this review before it ships. This is EC-3 applied to artwork, and it is rejection law.

A scene may never contain or imply:

1. A clinician presented as a real VitalCV user, or paired with a fictional
   identity, NPI, credential, source response, employer, or outcome. Under the
   dated D.1 amendment, anonymous documentary media may show a model-released
   or generated adult clinician when provenance is recorded, no patient or PHI
   appears, no identity/evidence claim is attached, and adjacent copy says the
   image is art-directed rather than a live result.
2. A source response that did not occur, a source that is not integrated, or a confirmation mark on a gated source.
3. A count, score, match, or metric presented as a measurement. Illustrative numbers are labeled illustrative or removed.
4. A submission, share, or send shown as complete before the real endpoint has succeeded.
5. An employer decision, hire, clearance, privilege, or start. **Employer scenes stop at review** — the review desk receives, it never resolves green.
6. Verification, clearance, or credentialing performed by VitalCV.

A scene must be impossible to mistake for live results. Where a scene sits next to real product state, the self-labeling illustration rule in EC-20 applies: it says what it is.

### EC-26. The `VisualScene` contract — Class A

There is one rendering path for public visual scenes, and it distinguishes **decorative art** from **data-driven app state** at the type level. A component may not blur the two.

```
VisualScene {
  scene      SceneId              // from the EC-28 inventory
  kind       'decorative'         // art; alt="" ; carries no state
           | 'process'            // explains a process; requires transcript
           | 'stateful'           // reflects real returned app state
  mode       'motion' | 'static' | 'auto'
  state?     <scene-specific>     // required when kind='stateful', else forbidden
  priority   'hero' | 'inline' | 'background'
  poster     <asset>              // required for every motion scene
  transcript <text>               // required for kind='process' and 'stateful'
}
```

Binding properties:

- **`kind='stateful'` renders only from real returned records.** It has no fixture path and no optimistic path. Unknown, unavailable, and error states are composed deliberately, never rendered as an empty or broken scene.
- **A scene is never the sole carrier of meaning** (EC-4). No state, consent choice, source limitation, ownership label, or employer decision may exist only inside artwork. Removing every scene from a surface must leave it fully usable and fully legible.
- **Reduced motion is a composition, not a fallback.** The static state tells the same story, with step controls where a sequence carries the meaning.
- **No autoplay** under `prefers-reduced-motion` or data-saving conditions; serve poster plus an explicit play or replay control.
- **No layout shift.** Scenes reserve their space.

### EC-27. The protagonist object and the five beats — Class C

**One protagonist across the product.** It is the clinician's own record — not a dashboard, hospital, network graph, AI motif, or a person.

This clause **reconciles with, and does not replace, `docs/design/vitalcv-cinematic-storyboard.md`** (issue #1069, Phase Z0), which already defines the object's anatomy — SILHOUETTE, PROPORTIONS, and the "cover the copy and the object still reads" test. That anatomy is the object's definition of record. The Living Profile brief's "profile object" and Z0's "living evidence record" are **the same protagonist under two names**; shipping them as two objects would recreate exactly the multiple-competing-systems problem this constitution exists to end. Waves cite Z0 for anatomy and this clause for narrative.

**The five permanent beats:** Identify → Build → Choose → Apply → Carry forward. The employer-review scene is a **bridge between Apply and Carry forward, never a sixth success beat** (EC-25.5).

The four ownership cues are already law in EC-7 and are the vocabulary every scene expresses through object behavior: VitalCV assembles; the clinician pulls, releases, and approves; the employer receives and reviews; open items stay visibly open.

Materials, palette, lighting, and camera are **Class B** — they resolve through EC-13 and the locked EC-20 rows, not here. This clause supplies narrative structure only.

### EC-28. The approved scene inventory and placement authority — Class C, with Class A gates

Only these scenes are approved for the first release. A new scene requires an EC-22 amendment.

| Scene | Kind | Home surface |
|---|---|---|
| Journey Film | process | See placement note below |
| NPI Reveal | stateful | NPI entry / resolution |
| Profile Layers | stateful | Claim, profile completion |
| Choice Gate | stateful | Apply, sharing permissions |
| Opportunity Field | stateful | `/holder/opportunities*` (see note) |
| Employer Desk | process | Employer acquisition |
| Continuity Ribbon | decorative | Application timeline, reuse |
| Quiet Source Constellation | stateful | Trust Center, Status |
| Workbench Window | process | Clinician product page |
| Decision Trail | stateful | Opportunity detail |
| Activation Path | process | `/pilot`, `/onboarding` |

**Placement note — the Journey Film is not authorized on `/` by this clause.** Homepage composition authority rests with the homepage reset and UX-04 (EC-24), and the retired film/scene model may not re-enter through an illustration wave. A Journey Film on the homepage requires an explicit EC-22 amendment and a founder visual gate. Independent of that, UX-01 amendment 5 forbids a blocking hero: no scene may make a visitor wait for the message, and the real NPI action outranks the journey (XS-10, EC-1).

**Homepage route-variant authorization (2026-08-13).** Amendment D.1 supplies
the required founder decision for a `journey_film` **static documentary route
variant** on `/`. It is a non-blocking human-stakes still beside the real NPI
action and tactile record; it does not restore the retired horizontal film,
create a scroll owner, or carry evidence/result state. The server poster is the
complete experience and remains subject to EC-25 and EC-29.

**Homepage warm-glass authorization (2026-08-14).** Amendment D.7 supersedes
the D.1 documentary placement for the current `/` composition. The manifest
entry remains available to other explicitly authorized routes, but `/` mounts
the frosted record and code-authored horizon instead of a raster poster.

**Explore route-variant authorization (2026-08-14).** Amendment D.2 supplies
the founder decision for a static `journey_film` documentary route variant on
`/explore`. It is atmosphere beside the public opportunity field, never a role,
clinician identity, employer relationship, match, or outcome. The route's
source and availability claims remain real text from the opportunity contract.

**Employers route-variant authorization (2026-08-14).** Amendment D.5 supplies
the founder decision for a static `journey_film` documentary route variant on
`/employers` and for the approved `employer_desk` process scene on employer
acquisition. The documentary frame is human setting only. The tactile desk
stops at inspect, clarification, and institution review; it never depicts an
acceptance, hire, clearance, credentialing decision, or start.

**Activation-path authorization (2026-08-14).** Amendment D.6 supplies the
founder decision and EC-22 amendment for the `activation_path` process scene on
`/pilot` and `/onboarding`. It illustrates a bounded journey from an abstract
NPI card to one opportunity doorway and stops before any submitted
application, employer review, decision, credentialing event, hire, or start.

**Route note (founder decision, 2026-08-08).** The source briefs target a `/jobs` surface. No such route exists. Opportunity and apply scenes target the surfaces that do: `/holder/opportunities{,/discover,/interested,/passed}`, `/holder/matcha/opportunities`, and `/opportunities/discover`. Renaming the customer-facing noun is UX-16 copy work; creating a `/jobs` route is a product dependency, not an illustration wave.

### EC-29. Media budgets and motion safety — Class A

Objective, measurable, and CI-enforceable (EC-23):

- Hero poster ≤ 250 KB. Desktop hero moving asset ≤ 1.5 MB per modern format after compression. Measure; do not assume.
- Every motion asset ships: poster, static reduced-motion composition, and — for `kind='process'` and `'stateful'` — a transcript or adjacent textual equivalent. Decorative crops carry empty alt text; meaningful process scenes never do.
- Every asset carries source, license, and origin metadata. An unlabeled, oversized, or fallback-less asset fails the gate.
- Motion timing follows the four bands already locked in EC-20: 80–150ms control feedback · 150–250ms state transition · 250–450ms product transformation · 450–800ms rare narrative.
- **Nothing loops** except a loading skeleton, a system-status pulse, a source check that is genuinely running, or a **bounded ambient illustration loop** authorised per the amendment below. A hero does not loop once it has finished.
- Numbers animate only between real returned values (EC-3).
- No body copy is printed inside an image; contrast floors hold independent of artwork (EC-5).

**Amendment F.1 — ambient illustration loops on the `/` scene register (founder ruling, 2026-08-16).**
Founder directive, quoted verbatim: *"Allow ambient loops"* — ruled on the Homepage v4 PR (#1431)
alongside the v4 GO. This adds one bounded exception to the no-loop rule, scoped as narrowly as
the rule it relaxes:

- **Permitted:** continuous, bounded, decorative motion loops **inside a homepage illustration
  figure** (the `/` route's `.ezh-fig-art` illustration art — the founder's v4 `body.mo-amb`
  behaviours: the hero cadence line's continuous trace, the trust-flow packet's travel, the accent
  connectors' dash-march, and an illustration marker glyph's opacity tick).
- **Never:** a control, an input, text, a status marker, a state marker, an evidence surface, a
  proof row, an artifact, or any number. The loop carries **no meaning** — removing it must cost
  nothing but atmosphere (EC-4), and the illustration's meaning stays in its static frame and its
  adjacent transcript.
- **Reduced motion stops every one of them.** Under `prefers-reduced-motion: reduce` the figure
  rests in its complete, solid frame with zero animation — this is the invariant, asserted against
  a production build in `tests/e2e/home-easy.spec.ts`. The no-JS frame is likewise complete; the
  loops are pure CSS and decorative, so their absence changes nothing legible.
- **Scope:** this exception is the `/` scene register only. It does not authorise loops on any
  other surface, and it does not touch the system-status-pulse exception (which remains separate —
  the live feed's "Listed as open" availability dot). Other routes remain under the unamended
  no-loop rule; extending the exception requires its own amendment.

---

## Part VI — Governance

### EC-21. Citability

- **Rejection law:** Class A clauses (EC-0…EC-12, EC-25, EC-26, EC-29) and **locked** EC-20 rows. Cite the number.
- **Class B (EC-13):** not citable as law until its EC-20 row locks. Neither prior eras nor new inventions may be asserted as authority in these domains before the verdict.
- **Class C (EC-14, EC-27, EC-28):** rejections happen in design review, citing the clause **plus a named rationale**. Never automated. EC-28's placement and route notes record founder decisions and bind like locked EC-20 rows.

### EC-22. Amendment

Class A clauses and locked EC-20 rows change only by editing this file with a dated rationale, founder-approved. A PR may not introduce a local exception. Class C guidance evolves through recorded amendments as review precedent accumulates. Parked eras (`PARKED_VISUAL_ERAS.md`) return only via amendment.

### EC-23. Enforcement — CI enforces contracts, review enforces taste

**CI-blocking (objective, lands with UX-02):**

- Truth/copy safety: the EC-3 banned strings and false-claim patterns (`scripts/check-public-claims.ts`, run as the `check-public-claims` required check); checkmark-on-gated-or-non-integrated-source
- Accessibility contracts: focus ring presence, target sizes, contrast floors
- Reduced-motion presence: every animated surface ships a reduced-motion composition
- State never by color alone: glyph + word pairing at the component level
- Token architecture: no raw values outside token files, no foreign prefixes, no new stylesheet imports, no literal z-index, `next/font/local` only
- Duplicate design-system infrastructure **after UX-02** (second badge systems, parallel component libraries, new scoped islands)

**Design/founder review (taste — never CI):** typography, palette, gradients, cards, radius, imagery, composition, visual density, animation character.

Subjective July-era taste is not encoded as CI law before the reset direction is chosen. The `check-design-lint.ts` port from `.worktrees/retire-speed-claim` is scoped to the objective list above; taste rules from wave-1505's set (pill radii, shadow discipline, dark-on-public) join CI only if and when the verdict locks the matching EC-20 row. Proof obligation stands: a deliberately-violating PR must fail CI on every objective count before the gate is considered live.

### EC-24. Records

- **UX-02A — the spacing scale, on founder ruling (2026-09-15).** The founder's ruling, verbatim:
  **"Spacing scale as a UX-02A wave — YES: declare `--vt-space-*`, migrate the two public islands
  with zero pixel change, amend the EC-20 spacing row in the same PR."** EC-20's "Spacing rhythm"
  row moves from DEFERRED to LOCKED (UX-02A, 2026-09-15).

  **What was found.** The row's 2026-08-08 measurement was still true of the CSS: zero
  `--vt-space-*` declarations and zero references across `apps/web/styles`. It was NOT true of
  the runtime: `design-system/tokens/spacing.ts` already held an eleven-step rem table
  (2…64) that `variables.ts` maps to `--vt-space-<px>` and `app/layout.tsx` mounts on
  `<html>` as inline style — a family declared on every route, consumed by nothing in CSS,
  and (because inline style outranks `:root`) able to silently override any CSS scale that
  disagreed with it. LINT-17 already treated that generator as the declaration. The decision
  was therefore adopt-and-mirror, not invent: `spacing.ts` is the source of truth, extended
  with the steps the islands measured; `tokens.css` mirrors it; a sync test pins both.

  **Why px-named and rem-valued.** The name states the pixel a step paints at the 16px root
  the app never overrides, which is what a reader of `padding: var(--vt-space-12)` needs and
  what the existing family already did. The rem value lets the rhythm follow a user's
  font-size preference (WCAG 1.4.4) instead of pinning it; at default settings the two are
  identical, which is what the pixel-diff proves.

  **Why these steps and not a designed ramp.** The reference teardown's 4/8/16/24/36/48/60/80
  ramp would have moved pixels on 100+ declarations. The islands' measured grain is 2px
  through 32 (6/10/14/18/22/26 carry 15–21 uses each — that is the rhythm, not noise), so the
  scale records that grain rather than legislating a coarser one. Eleven literals across six
  values (1, 7, 9, 11, 76, 150) fall off the scale and stay literal, named in the row: they are
  the debt the scale exposes, and rounding them is a visual change with its own gate.

  **What this does NOT do.** No colour, radius, shadow or motion line moved (the wave is
  line-disjoint with the action-state layer, #1484). No other island migrated. `--vt-space-*`
  is not a Tailwind spacing override and does not touch `components/vital/*`, which carry no
  raw px spacing.

  **The one thing rem changed, and the rule it produced.** At default settings rem and px are
  the same pixel, which the diff proves. At a 200% user font-size (WCAG 1.4.4) rem spacing
  scales with the text where px did not — the rail's gutter goes 20→40px, the hero's rhythm
  opens up, and nothing overflows at 390 or 1440. One element broke: the menu glyph's three
  bars collapsed to 0px, because their 4px gap is geometry inside a fixed 18×14px drawing,
  and doubling it overflowed the box. That gap stays literal, and the rule is recorded in the
  row: a value inside a fixed-px drawn artefact belongs to the drawing, not the scale. The
  check that found it (every island element's box, rem vs px, at 200%) is the check a future
  island migration runs before claiming zero change. The chrome geometry in the eyebrow row (top 14px, 20px inset) is unchanged in
  value; it now reads `var(--vt-space-14)` / `var(--vt-space-20)`.

- **A-4 — the floating glass rail, on founder directive (2026-08-16).** EC-10's structural form
  and EC-20's eyebrow-geometry row move from `amended A-3` to `amended A-4`, and EC-10's
  banned-forms list is rewritten. The founder's directive was plain: **"build the glass rail"**
  (2026-08-16) — the v4 homepage's `.vt-rail` chrome, adopted as VitalCV's shared public chrome.

  **What it supersedes.** A-2 built the chrome as a *zero-height sticky group* of absolutely-
  positioned instruments floating over an inert frosted rectangle, exact to palantir.com; A-3
  capped that rectangle at 1480 and made the instruments band-relative. A-4 replaces the FORM: the
  chrome is now a single detached glass BAR — one `position: fixed` element carrying its
  instruments in flow — not a group over a decorative rectangle. Every A-2/A-3 dimension retires
  with it (1480 cap → the 1400 content column; 70px inert rectangle → ~60px live bar; radius-0
  square instruments → soft-cornered rail controls; the bottom-pinned mobile cluster → a single
  top bar). The retired treatment is parked, not deleted (`PARKED_VISUAL_ERAS.md`); revert restores
  the eyebrow.

  **The banned-forms reversal is the load-bearing change.** A-2's EC-10 list banned exactly this
  shape — "floating rounded container" and "backdrop-blur-navbar-with-thin-line" — a line written
  when the palantir grammar was the target. The founder's directive supersedes it, so the same PR
  that ships the rail amends the list (EC-22 same-PR rule): those two forms are now the REQUIRED
  chrome, and the ban is retired. Shipping the rail while EC-10 still forbade it would leave
  `origin/main` contradicting its own rejection law — the exact failure EC-22 exists to stop.

  **What A-4 does NOT change.** The register mechanism is untouched: sections still declare
  `data-header-theme`, useHeaderScene reflects it onto `data-eb-theme`, and the frost + instruments
  invert over dark bands and return over light ones — the rail is legible over warm paper and over
  the dark takeover it floats on. Glass stays chrome-only (A-1): the rail frosts, evidence surfaces
  do not, and the frost degrades to a solid panel where `backdrop-filter` is unsupported. The action
  stays off green (LINT-15) and off indigo (A-1) — it is the warm-paper inverse, filled. The verify
  affordance is the shield-check "Verify a shared record" (#1430), not reverted to a magnifier.
  Every control is a real ≥44px box (EC-5). The takeover is the full index with a focus trap,
  Escape, route-change close, and now a visible ✕ (audit #56).

  **The mobile decision, recorded.** The retired eyebrow split identity to the top and pinned the
  controls to the viewport bottom. The rail is a single object and stays one bar at the top on
  mobile — narrower, with the link row and standalone sign-in folded into the takeover and the
  action shortened. Splitting it would break its identity as one detached bar; this is a deliberate
  choice, not an omission.

  **Founder gate.** This amendment records the founder's authorization of the FORM; the RENDERED
  rail still owes a FOUNDER VISUAL DECISION on its PR (`FOUNDER_VISUAL_GATE.md`). Shared chrome is
  founder-gated; A-4 lands only through that gate.

- **E — the Direction A homepage register, on founder verdict (2026-08-15).** Four rendered
  rounds, one winner, three rulings, and a freeze. The founder judged three live directions
  ("A — minimal-bold paper", "B — the ledger", "C — apply"), rejected B as *"too basic"*, took
  C's cycling payoff line into A, and closed with *"ok i like A the most. but i need
  illustrations and visuals not just text."* Two product rulings landed in the same rounds —
  jobs must be visible on `/` (*"why isnt job opportunities mentioned once on homepage??"*)
  and the standing watch (*"the idea is for the clinician not needing to do anything"*) — plus
  the standing bar: understood in thirty seconds. Same-day scope rulings: the register applies
  to all public surfaces homepage-first; a homepage visual freeze holds until the recomposition
  ships and is approved; jobs render as the live feed framed by the match-explanation figure.

  **What the amendment deliberately preserves:** the A-2 silhouette thesis survives scoped to
  chrome (square means you can act on it — on instruments); the 8px page-action value Direction
  D shipped is adopted rather than the artifact's 11px, so the seam between A-2 and D closes on
  the value the e2e contract already pins; A-1's indigo focus returns to `/` (Direction D's
  green focus was a deviation, not a decision); and the reserved severity red stays reserved —
  the E action colour is distinguished from it by rule, recorded in the E table, because the
  palette cannot carry that distinction itself.

  **Process note.** E lands law-and-tokens first while the route still renders D.7 — the
  inverse of the A-1 failure (values shipped a day before their law). The freeze makes the
  interim state legible: D.7 is what the route shows; E is what it owes. The bake-off artifact
  is committed at `design-lab/homepage-2026-08-direction-a/` — note the name collision with
  `design-lab/homepage-reset/direction-a/`, the *retired 2026-08-07 UX-01 candidate*, which is
  a different direction that happens to share the letter.

- **A-3 — the rectangle stops growing, on founder directive (2026-08-09).** EC-20's
  eyebrow-geometry row moves from `amended A-2` to `amended A-3`. The founder, on the chrome A-2
  shipped: *"can we make the top bar eyebrow less wide and more exact to the palantir.com size"*.

  **The defect was a measurement taken at one width.** A-2 probed the reference at 1440 and 390 and
  recorded "inset 10px left and right" — true at 1440, and false as a rule. Re-probed at
  1280/1440/1512/1728/1920/2560, the reference paints **1260 / 1420 / 1480 / 1480 / 1480 / 1480**,
  centred once capped: it holds a 10px inset only until the rectangle reaches **1480px**, then
  stops growing and centres. VitalCV's implementation had no cap, so on a 1920 display the chrome
  measured 1900 wide against the reference's 1480, and on a 2560 display 2540 against 1480. Every
  desktop assertion in the eyebrow suite ran at 1440 — *below the cap* — so nothing could see it.
  **The lesson generalises past this row: a geometry rule read off a single viewport is an
  anecdote. Probe a reference at the extremes of the range you intend to ship, or the constant you
  write down is really a coordinate.**

  The instruments turned out to be band-relative too, which the single-width probe also hid: the
  wordmark sits at reference `x` 30 / 36 / 144 / 240 / 560 as the viewport grows — always
  **20px inside the rectangle**, never at a fixed viewport gutter. Below the cap that is 10 + 20 =
  the 30px gutter A-2 recorded, which is why the two readings agreed at 1440 and only at 1440. The
  takeover was measured open at 1920: columns start at 240 and the last closes at 240 — **the same
  band**, so it moves with the chrome rather than staying full-bleed under it.

  Implementation note kept deliberately: the band is `max(10px, (100% - 1480px) / 2)` against
  `.vcv-eb`, **not `100vw`** — a classic (non-overlay) scrollbar makes `100vw` wider than the
  layout box and would push the centred band off-centre by half the scrollbar on exactly the
  platforms least likely to be checked.

  **Not touched, and recorded rather than taken silently:** the reference's dominant action is
  *fluid* — measured 178 / 205 / 217 / 253 / 285 / 392 across the same six widths, ≈`16.7vw − 36px`
  — while EC-20 locks ours at a 205px minimum, a value A-2 read at 1440 for the same reason it
  misread the inset. VitalCV's action stays 205 here: matching the reference would make the action
  *wider* on large displays, which is the opposite of the directive this amendment serves, and the
  action's shape was separately founder-ruled under A-2. **Flagged for a founder decision, not
  folded into a width-reduction PR.**

- **A-2 — the floating chrome, on founder directive (2026-08-09).** EC-10's structural form and
  EC-20's eyebrow-geometry row carry an `amended A-2` marker. This entry records the directive and
  what the amendment deliberately does not touch.

  The founder's standing request — restated 2026-08-09, "since the beginning, I've been asking for
  the top eyebrow to be exact to palantir.com" — is a **Class B geometry directive inside EC-10's
  form**, and EC-10's form itself had to move: the reference is not a bar. Measured from
  palantir.com on 2026-08-09 (probe and computed styles archived with the wave evidence): the
  chrome is a sticky group of zero height, the brand floats at a 30px gutter, the right cluster
  holds one 40 × 205px rectangular action plus two fused 40px squares, every corner is square, and
  the takeover paints beneath a chrome that stays live. VitalCV's implementation matches that
  geometry and maps the reference's search slot to the one real lookup it has (the public NPI
  check) rather than adding a decorative control.

  **The rectangle was missed on the first pass and the founder had to ask twice** ("did I mention
  I want the top bar to be in a wide rectangle shape — again just like palantir.com"). The reason
  is worth recording: the reference's defining surface is a single `div` whose only distinguishing
  property is `backdrop-filter`, it holds no text, and a DOM sweep for large rounded boxes near the
  top of the page returns nothing — its radius is 10px and it was filtered out as noise. It was
  visible in the very first screenshots as a soft rounded edge and was read as hero artwork. The
  lesson generalises: **when copying a reference, sweep for what PAINTS (backdrop-filter, blend
  modes, pseudo-elements), not only for what CONTAINS.** Measured values now in the EC-20 row.

  **What A-2 does not change.** The register mechanism is untouched: sections still declare
  `data-header-theme` and the chrome still inverts by declaration, never by pixel sampling or
  blend-mode trickery — the reference uses `mix-blend-mode: difference`, which VitalCV rejects
  because it makes contrast a function of whatever pixel is underneath, and EC-5's contrast floor
  has to be provable. Colour still routes through `--vt-scene-*`. A-1 is untouched and not
  contradicted: it *permits* the pill, it does not mandate it, and chrome instruments fall under
  A-1's own surviving limit that operational surfaces stay near-sharp. Work-green remains barred
  from the action (LINT-15). The page's primary NPI action keeps its A-1 pill; only the chrome is
  square. **That divergence is deliberate and visible on `/` — two "Start with your NPI" controls
  in different silhouettes — and is flagged for the founder at the visual gate.**

  **The page action followed the chrome, on founder ruling.** Squaring the chrome left `/` showing
  two "Start with your NPI" controls in different silhouettes — chrome square, page pill — which
  was flagged at the gate rather than resolved unilaterally. The founder ruled: *"square the page
  action to match."* So the EC-20 shape row above now states the rule that ruling implies, and it
  is a rule rather than a special case: **an action is square, a word-label may be a pill.**

  Measured before changing anything, `/` was the only public surface with pill-shaped actions —
  `/pricing`, `/employers`, `/trust`, `/explore` and `/verify` already carry none — so the change
  is one island (`easy-home.css`) and six real actions. Two DEPICTIONS of buttons inside the
  illustrative work surface went square with them, because an illustration that draws a product we
  no longer ship is simply a wrong picture. Four word-labels keep the pill: the disclosure tag,
  source names, the owner chip, and the reduced-motion step index. Nothing here weakens A-1: a
  pill is still never a state marker, and the state markers were already radius 0.

  **Two reference behaviours were adjusted on accessibility grounds; both deviations are recorded
  here rather than silently taken.**

  *Mobile clearance.* Mobile pins the control cluster to the viewport bottom, as the reference
  does. Measured at 390 × 844 before clearance was added, the cluster covered the footer's last
  two links and the feedback control at the document bottom. The footer now reserves 84px and the
  feedback chip rides above the cluster. The reference reserves equivalent clearance; copying the
  pinning without it would have shipped untappable links.

  *Target size.* The reference's instruments are 40px; EC-5's floor is 44px. **The two are
  reconciled rather than traded off:** every instrument paints its box in an inner span, so the
  interactive element measures 44px while the painted box measures the reference's 40px, and the
  row offsets absorb the 2px ring so the *visible* edges still land on the gutter. This is why the
  EC-20 row above states painted dimensions — a future wave measuring the outer element will read
  44 and must not "correct" the row. The required a11y baseline ratchet is what caught the
  regression (`/`: sub-44px targets 13 → 15) after a full local e2e run had gone green, because
  that spec landed on `main` while this work was in flight; the same pass also lifted the wordmark
  and sign-in link, which the baseline had grandfathered, taking `/` to 12.

- **A-1 — the 2026 scene register, ratified after the fact (2026-08-09).** Four locked EC-20 rows
  above carry an `amended A-1` marker. This entry records why, and the process failure that made
  the amendment necessary rather than optional.

  The work landed first. `#1229` (squash `4a023b269`) shipped the public scene register —
  `--vt-shape-*` (pill 9999px, control 10px, card 20px, panel 24px), `--vt-scene-glow`,
  `--vt-frost-*`, and the paper-inverse `--vt-action-primary-*` — into
  `apps/web/styles/themes/index.css`, and it is live. It did not touch this file. For roughly a
  day, four rows of citable law said the opposite of the running product: pills retired, glass
  none, gradient none, near-sharp 0–3px, work-green as the primary action.

  **A contradiction like that does not sit still — it converts into rejected correct work.**
  EC-21 makes locked rows rejection law, so the next wave to read EC-20 would have cited a number
  against the shipped design and been *right by the document and wrong by the product*. This is
  the failure `check-design-lint.ts` documents twice in its own comments (the R2 `HorizontalStoryRail`
  ban and the CD-3/4 accent arc), where a gate defends retired doctrine and the correct fix looks
  like a broken build. The remedy is not to relax the rule that caught it; it is to make the
  document tell the truth, on the record, with the limits restated.

  What the amendment **preserves** is the load-bearing part. Frost is confined to chrome and scene
  overlays and may never touch an evidence surface — CD's "glass on chrome, solid on evidence"
  becomes the operative line instead of a blanket ban. The single indigo wash is atmosphere with
  no meaning attached, capped at one per viewport, banned from every control and status marker.
  A pill is a control silhouette and **never** a state marker. EC-4 is untouched: nothing in this
  amendment lets colour, motion, or hover carry meaning alone.

  The one row that got *stricter* is the accent. The 2026-08-08 accent-work merge made work-green
  both the completed-work colour and the primary action; on the shipped homepage that produced a
  single hex doing two contradictory jobs — reporting "this is confirmed" and soliciting "click
  me" — across the NPI submit, the eyebrow action, and roughly fourteen completed-state selectors
  in one viewport. Two independent lanes reached the same correction on the same day
  (`#1229` and `#1230`'s ruling board, `design-lab/2026-register/`). A truth colour that also
  asks for clicks stops being a truth colour, so green is now work only and the primary action is
  paper.

  **Process note, recorded because the next amendment should not repeat it.** Two lanes executed
  the same founder brief in parallel roughly ten minutes apart, reaching mostly-identical
  conclusions through duplicated effort and one head-on collision (a duplicate `LINT-14` ID; the
  loser closed as `#1231`). A wave that changes a locked row must amend this file **in the same
  PR** — the EC-22 requirement is not satisfied by shipping the values and intending to write it
  down later.

- **W1080 decision closure (2026-08-08).** The UX-01 verdict was already FINAL and EC-20 already
  back-filled, so closure was not a matter of making decisions — it was making them *citable*.
  EC-21 declares this document law and every locked EC-20 row derives from the verdict, but the
  verdict itself, `design-lab/homepage-reset/DECISION.md`, was **never committed**. The rest of
  the exploration record around it *was* — master brief, all three direction briefs and
  prototypes, the three pass-1 critiques, the evidence harness, 17 files in all. The one file that
  never landed was the decision. It existed on one machine; nobody else could read the authority
  this document rests on, and one lost working tree would have taken the founder's ruling with it.
  It is now tracked. Three further citations were wrong:
  `scripts/copy-rules.json` was named in EC-23 as the live CI mechanism but **has never existed**
  (the real guard is `scripts/check-public-claims.ts`, which does cover every EC-3 string); the
  competitive mandate was **recorded missing when it is in the repo**, renamed to
  `docs/strategy/competitive-mandate.md`; and `PARKED_VISUAL_ERAS` cited three chrome specs by
  filename that were **deleted**, not parked, so it now names the retiring commit. The lesson is
  narrow and worth keeping: **a governance document that cites a file nobody can open is a claim
  about law, not law.** `apps/web/__tests__/governance-citability.test.ts` now makes citability a
  property this repo has rather than one it asserts.
- **CC-01 / VIS-01 amendment (2026-08-08):** Part V (EC-25…EC-29, Profile in Motion) added per the founder's Visual System + Workbench program (CC-01 wave; source brief `docs/design/VITALCV_LIVING_PROFILE_VISUAL_SYSTEM_2026-08-08.md`, committed with this amendment per the W1080 lesson); Governance renumbered to Part VI, clause numbers unchanged. Founder decisions recorded same day: customer-facing name **VitalCV Workbench** (collision with the ops-facing investigation workbench noted in `docs/architecture/workbench-baseline.md` §4-M5 — copy-only rename, no route/table changes); opportunity/apply waves **retarget to `/holder/opportunities*`** (no `/jobs` route exists; EC-28 route note). CC-00 baseline: `docs/architecture/workbench-baseline.md`.
- **R2 restructure (2026-08-08):** founder ruling — Phase 0 approved; UX-00 revised into the three-class layering; PR #1160 held draft at reviewed head `9568a4db1e`; merge blocked pending FOUNDER UX-00 REVISION REVIEW.
- **UX-01 verdict state — FINAL.** Lineage, all 2026-08-08: a parallel lane recorded "B as presented, no hybrid" (selection made in-session 2026-08-07) → the founder's UX-00 ruling reopened the verdict pending hybrid consideration (no back-fill occurred during the reopening) → the founder's amended ruling resolved it: **DIRECTION B GO, WITH AMENDMENTS** (memorialized in `DECISION.md`): product-forward brand; dark-first as public *register* with intentionally light evidence/dense surfaces; the Start Agent's visible work is brand; the eyebrow is binding with its own UX-03 gate; NOT authorized — blocking 14–18s hero, permanent dark everywhere, prototype-as-implementation. EC-20 back-fill follows only after this R2 layering is accepted (execution step 3). The verdict's register scoping supplies the explicit supersession EC-13.11 requires.
- **Companion ruling on #1165 (census):** accepted as evidence; merge held until governance rebase — "UX-02 adopts…" language renamed to "candidate substrate / measured recommendation" (the census establishes facts, it does not legislate); rebase after #1160 settles (main had advanced to `ab25931b6` at ruling time). Its Direction-B scoping assumption is now consistent with the final verdict.
- `VITALCV_EXPERIENCE_SYSTEM_2026.md` (XS-1…XS-10, est. 2026-08-02, deriving from `founder-rulings-2026-08.md`) is canonical for *interaction and progression* and was missed by the program audit. Carried forward: XS-1 (one scroll owner, cited in EC-4), XS-7 (reduced motion as deliverable), XS-9 (performance floor), XS-10 (the NPI field outranks the journey — aligned with EC-1). Its homepage-journey mechanisms (XS-3 media rail, XS-4 chapter menu) serve the retired journey model; **UX-04 must amend XS per its own rules** — a recorded dependency, not a silent supersession.
- Mainline CD carries the **2026-08-02 "One public Ink chapter" amendment**; any dark-public verdict must supersede it explicitly (EC-13.11).
- **Competitive mandate — found 2026-08-08 (W1080), correcting a "recorded missing" entry.** It is `docs/strategy/competitive-mandate.md`, tracked on `origin/main`. The earlier search looked for the original filename (`VitalCV_Competitive_Mandate_and_Claude_Code_Waves_2026-07-21.md`) across repo root / docs / design-handoff at depth ≤4 and missed it because the document had been **renamed**, not lost. Searching for a path rather than for the document is how a live file gets recorded as missing. Its authority is unchanged: homepage-composition authority rests with the homepage reset, the film/scene model is retired, and it carries a superseded-where-conflicting notice; its strategic copy is UX-16 salvage only.
- The wave-1505 design system (`design-handoff/claude-design-2026-07-12-wave1505/wave1505/`) remains the best token/component architecture in the codebase — UX-02's skeleton, re-skinned to the verdict; its taste rules are Class B raw material (EC-13, EC-23).
- Working-tree copies of CD on long-lived branches were found **stale** against `origin/main` during R1 drafting. Doctrine reads come from `origin/main`, never a branch's working copy.
- The UX-01 exploration record lives in `design-lab/homepage-reset/` (master brief, three direction briefs + prototypes, three pass-1 critiques — all PASS, Playwright evidence at 1440×900 / 390×844 + reduced-motion + motion captures).

---

## Appendix A — R1 → R2 revision map

| R1 clause | R2 disposition |
|---|---|
| EC-0 boundary | **Retained invariant** (EC-0) + freeze exceptions added |
| EC-1 target feeling | **Retained invariant** (EC-1) |
| EC-2 ten principles | **Retained invariant** (EC-2) |
| EC-3 five laws | **Split:** truth + meaning-not-color-alone + one-system → EC-3 / EC-4 / EC-23; glass law → **moved to EC-20 register** (EC-13.7) |
| EC-4 mono law | **Moved to EC-20 register** (EC-13.5); truth kernel (facts attributed, never blurred with prose) retained in EC-3 |
| EC-5 state law | **Split:** attribution + glyph/word retained invariant (EC-3, EC-4); stamp/hue rendering → EC-13; vocabulary freeze retained (EC-3) |
| EC-6 geometry semantics | **Moved to EC-20 register** (EC-13.3, EC-13.4) |
| EC-7 kill list | **Dissolved as a unitary rejection list:** truth/copy items → EC-3 (invariant); gradient/glass/pill/bento/glassmorphism → EC-13 (direction-locked); imagery/section/composition items → EC-14 (guidance) |
| EC-8 accessibility floor | **Retained invariant** (EC-5) |
| EC-9 asymmetries | **Retained invariant** (EC-11) |
| EC-10 visual budget on NPI moment | **Downgraded to guidance and revised** (EC-14): first signature moment, not the only permitted one |
| EC-11 truth contract | **Retained invariant** (EC-3) |
| EC-12 glass on chrome / solid on evidence | **Moved to EC-20 register** (EC-13.7); certainty kernel retained in EC-3 |
| EC-13 Easy Button frame | **Retained invariant** (merged into EC-1) |
| EC-14 four-owner vocabulary | **Corrected and retained invariant** (EC-7): controller preserved; external actors named specifically; "Employer decides" only when the employer actually decides |
| EC-15 agent ladder 1:1 mapping | **Corrected** (EC-8): the ladder produces a bounded family of work states; 1:1 claim removed; ladder contract preserved |
| EC-16 operator-not-chatbot | **Retained invariant** (EC-8); "receipt stream" wording removed |
| EC-17 vocabulary ban | **Retained invariant** (EC-9); receipt contradiction resolved — internal/audit noun kept, customer-facing "Activity" / "Completed work" |
| EC-18 eyebrow spec | **Split:** structural form retained invariant (EC-10); exact geometry → EC-20 (EC-13.12) |
| EC-19 motion law | **Split:** reduced-motion presence, number-truth, one scroll owner retained invariant (EC-3, EC-4); bands/easing/character → EC-13.14 |
| EC-20 brand table | **Retained** (EC-20), expanded to cover all Class-B domains |
| EC-21 citability | **Revised** (EC-21): rejection law = Class A + locked EC-20 rows only |
| EC-22 amendment | **Retained** (EC-22) |
| EC-23 enforcement | **Revised** (EC-23): CI = objective contracts; founder/design review = taste; no July-era taste as CI law pre-verdict |
| EC-24 records | **Retained** (EC-24) + R2 and verdict-state records added |
