# Reference adoption — the Antigravity teardown (2026-09-15)

**Status:** Adjudicated. Every item in the reference has a verdict below.
**Reference:** a teardown of `antigravity.google` captured 15 Sep 2026 (tokens read from the
live CSSOM, shipped bundles and computed styles). Founder instruction, verbatim: *"i want all the
functions and design specified here to be implemented into vitalcv … meaning vitalcv.com."*
**Authority:** subordinate to [`VITALCV_EXPERIENCE_CONSTITUTION.md`](VITALCV_EXPERIENCE_CONSTITUTION.md)
(EC-n), [`MOTION.md`](MOTION.md), [`PARKED_VISUAL_ERAS.md`](PARKED_VISUAL_ERAS.md), and the
product decision filter. This document supplies the mapping; the constitution supplies the law.
Where a reference pattern and a clause disagree, the clause wins and the pattern is recorded here
with the number that killed it — so the next lane cites this page instead of re-deriving it.

**Why this page exists.** A style report that reads like a rich source can be one the repo has
already absorbed and fenced (Dimension: `VITALCV_2026_VISUAL_LANGUAGE.md` §1.1 + LINT-14; the
Antigravity cursor field itself: the 2026-08-16 ruling recorded on PR #1441). This is the third
time an Antigravity artefact has reached the repo. The verdicts are dated so their freshness can be
checked against `origin/main` before they are cited (`git show origin/main:<path>`).

## 1. Verdict table

Legend — **ADOPTED**: built in the PR named. **ALREADY LAW**: VitalCV settled it earlier, in the
same or the opposite direction; nothing to build. **BLOCKED**: a Class A clause or a recorded
founder ruling forbids it; reopening needs an EC-22 amendment or a founder ruling, not a PR.
**INAPPLICABLE**: the mechanism does not exist on this stack. **FOUNDER YES/NO**: lawful but a
visual/product decision the founder must make; listed in §3.

| # | Reference pattern | Verdict | Basis |
|---|---|---|---|
| 1 | Three token layers — palette → semantic role → component state; components touch only layer 3 | **ADOPTED** (partial: the action families) | Layers 1–2 already exist (`styles/tokens.css` scales; `styles/themes/index.css` `--vt-scene-*`). Layer 3 was rest + press only. PR #1484 (`design/action-state-layer`) completes rest / hover / focus / press / disabled for the primary action on both registers, wires `VitalAction`, the eyebrow rail action and the employer decision control, and pins every state pair ≥ 4.5:1 in `scene-token-contract.test.ts`. Hover is a new distinct step, so the PR carries founder-visual-gate evidence. |
| 2 | Token typos that fail silently (`22pxx`, unit-less `112`) — the reference's own defect | **ADOPTED** as a gate | PR #1482 (`chore/design-lint-token-integrity`): LINT-16 (malformed custom-property values) and LINT-17 (`var(--x)` with no fallback where `--x` is declared nowhere) in `scripts/check-design-lint.ts`, ratchet/error per the gate's standing mode rule, injection-proofed. |
| 3 | Headings as styled spans; unlabeled `<nav>` landmarks; nested `<main>`; no skip link — the reference's a11y findings | **ADOPTED** as fixes on vitalcv.com | Measured 2026-09-15: `/onboarding` rendered with no `main` landmark and its server shell with no `h1` (the hydrated page had one); the shared footer `<nav>` was unlabeled on every interior route. PR #1483 (`fix/a11y-landmarks-headings`). Skip link already exists (`RootChrome.tsx`); `/` already has one `h1`, real `h2`/`h3` hierarchy, labeled navs. EC-5. |
| 4 | Zero reduced-motion handling (reference defect) | **ALREADY LAW**, better than the reference | `app/globals.css` global `prefers-reduced-motion` kill switch (`animation-duration: 0.01ms !important`, iteration-count 1, transition-duration, scroll-behavior); EC-25–29 treat reduced motion as a composition, not a fallback; Playwright reduced-motion sweep on `/`. Nothing to add. |
| 5 | Image hygiene — 4K JPEGs at card size, no `srcset`/lazy/WebP (reference defect) | **ALREADY LAW / no finding** | `/` ships zero raster images (SVG illustration); interior routes serve `.avif` scenes with alt text. EC-29 budgets bound the hero. No defect measured; not built. |
| 6 | One radius for pills (9999px on every interactive pill), surfaces 4/8/16/24/36/48 | **ALREADY LAW — settled the opposite way** | EC-20 A-1/A-2/E: an **action is square** (radius 0 on chrome, `--vt-shape-action-page` 8px on page actions); a **word-label may be a pill**; a pill is never a state marker (EC-4). The reference makes the pill mean "clickable"; VitalCV makes the square mean it. Do not invert. |
| 7 | Ship the whole Penner easing set (19 curves) as tokens | **BLOCKED** | `MOTION.md` + `tokens.css` §3: one house curve, `--vt-ease-system: cubic-bezier(0.2, 0.8, 0.2, 1)`; every `--ease-*` is an alias; "don't introduce a fourth curve." `motion-token-sync.test.ts` pins one easing family. A curve set is the opposite of the UX-02 record. |
| 8 | Two tiny CSS keyframes (`delayed-fade-in` stagger trick; `blink` caret) | **ALREADY LAW** (stagger) / **BLOCKED** (blink) | Stagger: `--duration-stagger` and the `components/motion/Reveal` family already carry single-shot entrance with no observer dependency for the no-JS frame; LINT-03 confines keyframes to `styles/motion.css` (ratchet 99). Blink is an unbounded loop on text: EC-29 "nothing loops" — F.1's exception is illustration-only on `/`. |
| 9 | Wire `opsz` to the type scale (`font-variation-settings: "opsz" N` = px size) | **INAPPLICABLE** | EC-20 locks Geist (display + body) and Geist Mono, self-hosted. Geist publishes no optical-size axis, so there is nothing to wire. Fraunces (loaded, serif) has `opsz`, but browsers already apply it automatically at each rendered size; an explicit per-step pin would be identical to `font-optical-sizing: auto` and Fraunces is not the constitution's display face. |
| 10 | Variable-font micro-weights (430 / 450 on headings and buttons) | **FOUNDER YES/NO** — recommendation: NO | Geist Variable can render 450, but EC-20 locks Geist at 400/500/600 (LOCKED row); a new weight is an EC-22 amendment + founder visual gate for a sub-perceptual change. Same class as the 2026-08-16 ruling that scrapped tracking harmonisation. |
| 11 | Google Sans Flex / Google Sans Code / Google Symbols | **BLOCKED** | EC-20 font rows LOCKED (Geist, Geist Mono, `next/font/local`, never `next/font/google`). |
| 12 | Blue-biased grey palette, `blue-600 #3279f9`, particle blue/red/yellow | **BLOCKED** | Brand identity is VitalCV's warm-graphite/paper register (EC-20 neutral palette, LOCKED). Third-party reference hexes are a LINT-14-class violation by policy; indigo is the only accent and never a status colour (A-1). |
| 13 | Spacing scale as fixed steps (`--space-xs…7xl`) | **ADOPTED** (founder YES, 2026-09-15) | PR #1485 (`design/ux02a-spacing-scale`): `--vt-space-{2…112}` (26 rem-valued steps derived from the islands' measured 236 literals), source of truth `design-system/tokens/spacing.ts` mirrored in `styles/tokens.css` and pinned by `spacing-scale-contract.test.ts`; the two public islands migrated (226 references) with 0 differing pixels across 8 captures; 11 off-scale literals kept and listed; EC-20 spacing row amended in the same PR. |
| 14 | Icon-size scale, 12/8-column grid classes, breakpoint tokens | **ALREADY LAW / DEFERRED** | Grid: EC-20 grid row (full-width hairline bands, content max ~1400px, chrome gutter 30/20px). Icons: EC-20 icon row DEFERRED to UX-02 (family consolidation first). Breakpoints: the eyebrow's 900/767 and the islands' container queries are the live contract. |
| 15 | Hide-on-scroll nav (52px fixed bar, hides going down, returns going up) | **FOUNDER YES/NO** — recommendation: NO | EC-10: the eyebrow's structural form is invariant and the glass rail geometry is LOCKED (A-4); hiding the chrome is a behaviour change to shared chrome, i.e. founder-gated. The rail is ~60px and already frosted; there is no scroll owner on `/` to coordinate with. |
| 16 | Full-width mega menu with promo column | **BLOCKED** | EC-10 + A-4 lock the takeover's form; the four-item primary nav is a strategy-contract surface (`docs/strategy/README.md`). |
| 17 | Typed heading with a trailing gradient caret (SplitText) | **BLOCKED** | Hero copy on `/` is LOCKED (D.1/C1 rows); no blocking or gating hero sequence (EC-20 animation row, amendment 5); the caret is a loop on text (EC-29). |
| 18 | Scoped custom cursor (`gsap.quickTo` "Play intro" pill) | **BLOCKED** | The glass cursor was deleted in W1083 and its era parked (`PARKED_VISUAL_ERAS.md` era 3); EC-4 forbids meaning by hover alone; no touch equivalent. |
| 19 | Bouncing icon-chip marquee (7 s loop) | **BLOCKED** | EC-29 "nothing loops" outside F.1's illustration exception; the decision filter classifies it as decoration (strengthens none of the seven outcomes). |
| 20 | Sticky scroll rail with per-word fade across a 3,003 px track | **BLOCKED** | One scroll owner per page (XS-1, cited by EC-4); scroll storytelling needs an explicit founder ruling per surface (`MOTION.md`); the journey rail was deleted 2026-08-09 and the film homepage is parked. |
| 21 | Virtual smooth scroll (`translateY` lerp wrapper) | **BLOCKED** | Same as 20, plus it replaces native scrolling for every visitor including reduced-motion users; EC-5. |
| 22 | Draggable carousels (use cases, blogs) with throw | **BLOCKED** | Carousel format, wheel/touch-driven scrolling and auto-advance are standing rejections (`reference-experience-atlas.md` §amendment; EC-14 guidance); no such content surface exists in the product. |
| 23 | GPGPU particle field, ring-shaped cursor displacement (Three.js) | **BLOCKED** — ruled 2026-08-16 | Founder NO-GO on the full-bleed homepage field (fails the decision filter, competes with the record as protagonist, degenerates to autonomous drift on mobile). Three.js is CI-banned (XS-1b). The lawful descendant — a **single-shot paper-mode ink-to-indigo beat on NPI submit** — is built and unmerged in draft PR #1441. That PR, not a new field, is the open decision. |
| 24 | Native `<dialog>` platform picker with OS detection | **INAPPLICABLE** | No downloadable product. |
| 25 | Blur surfaces limited to two values (8px / 16px) | **ALREADY LAW** | A-1: frost on chrome and scene overlays only, one blur (14px on the rail), never on an evidence surface. |
| 26 | Button transition `0.15s ease-out`, asymmetric pill padding for a trailing icon | **ALREADY LAW** | Control feedback band 120ms on the house curve (`--duration-instant`, EC-29); pill padding is moot under #6. |
| 27 | Analytics / consent bar (GTM) | **ALREADY LAW** | PostHog is live (2026-08-16); consent presentation is a product surface outside this reference. |

## 2. What was built (2026-09-15)

Three disjoint pull requests, one per file set so none can make another `CONFLICTING`:

1. #1484 `design/action-state-layer` — the component-state ladder (item 1). Public-facing visual PR:
   creative owner named, desktop + mobile evidence, `FOUNDER VISUAL DECISION` pending.
2. #1482 `chore/design-lint-token-integrity` — LINT-16 / LINT-17 (item 2). Tooling only. Measured 109 references to undeclared custom properties on `origin/main` (`--warm-charcoal` ×42, `--glass-*` ×28, `--gf-*` ×26 among them) — silent style losses now frozen as a ratchet.
3. #1483 `fix/a11y-landmarks-headings` — `/onboarding` main landmark and headings for its headingless states (the hydrated page already had one h1; the server shell did not), labeled navigation landmarks (item 3).
   Class A accessibility fix, no copy or pixel change.

Plus this record (#1481).

## 3. Founder rulings (2026-09-15, in session: "move forward with your recommendations for each")

1. **Distinct hover step on the primary action** (item 1) — **GO.** #1484 carries `FOUNDER VISUAL DECISION: GO`.
2. **Draft PR #1441**, the read-settle beat (item 23) — **land it** under the standing 2026-08-16 "move on this" directive, once re-verified against current main.
3. **Spacing scale with island adoption** (item 13) — **YES**, as a UX-02A wave: declare `--vt-space-*`, migrate the two public islands with zero pixel change, amend the EC-20 spacing row in the same PR. Built as #1485.
4. **Hide-on-scroll rail** (item 15) — **NO.** The chrome carries the primary action on every route; hiding it costs a click and buys nothing (EC-10, A-4).
5. **Micro-weight 450** (item 10) — **NO.** Sub-perceptual; would need an EC-22 amendment to a LOCKED row (same class as the 2026-08-16 tracking ruling).

Landed the same day: #1482 (`bfe8f0e5a`), #1483 (`24dd7c1a7`).

## 4. Method note

Every "measured" claim above was taken on 2026-09-15 from `origin/main` at `fa7e47b71` or from
read-only page loads of vitalcv.com (no probes). Rulings are cited by PR number or constitution
clause; the working tree of any feature branch was not used as a doctrine source
(see `PARKED_VISUAL_ERAS.md` for why branch copies of the constitution lie).
