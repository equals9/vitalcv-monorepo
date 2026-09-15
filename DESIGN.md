# VitalCV — DESIGN.md

> **GENERATED — do not edit by hand.**
> `node --experimental-strip-types scripts/generate-design-md.ts`
> `design-md-freshness.test.ts` fails if this file drifts from the CSS.

This file states **facts about the tokens as they are declared today**. It is written for
coding agents building VitalCV UI, and it is regenerated from the CSS so it cannot
describe an architecture nobody shipped.

## Governance — this file is not the authority

| Domain | Authority | This file |
|---|---|---|
| Brand decisions (type, palette, radius, motion, light/dark) | `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` **EC-20** | points, never restates |
| Component + token architecture | `design-handoff/claude-design-2026-07-12-wave1505/wave1505/DESIGN_SYSTEM.md` | points, never restates |
| Truth/copy contract, banned strings | `CLAUDE.md` + **EC-3** | points, never restates |
| Which tokens exist, where, and which wins | **here** | authoritative |

Where wave-1505 and EC-20 disagree, **EC-20 wins**: 1505 is the architecture, its values
are superseded. Reading 1505 for values ships the wrong brand.

## Cascade order (the precedence nobody had written down)

Token files are `@import`ed by `app/globals.css` in this order. **Later wins** at equal
specificity, so this list is the precedence:

| # | File | `--vt-*` declarations |
|---|---|---|
| 1 | `apps/web/styles/themes/index.css` | 230 |
| 2 | `apps/web/styles/tokens.css` | 32 |
| 3 | `apps/web/styles/vitalTokens.css` | 65 |
| 4 | `apps/web/styles/matcha-zen.css` | 16 |

**343 declarations across 4 files, 254 distinct tokens.**

### Route-scoped token files (outside the global cascade)

Imported directly by a route component, not by `app/globals.css`. They load **after** the
global cascade on the routes that pull them in, so they override — but only there.
They are listed separately rather than ranked, because a global precedence number for a
per-route override would state a cascade that does not exist.

| File | `--vt-*` declarations |
|---|---|
| `apps/web/styles/band-system-components.css` | 24 |
| `apps/web/styles/band-system.css` | 38 |
| `apps/web/styles/wave1501-home.css` | 47 |

**109 further declarations** live here and are invisible to the global
precedence table above.

## Collisions — one declaration silently overriding another

Same token, **same selector**, different value, in more than one file. Theme variants
(`[data-theme]`, `.mz`, `.dark`) are not collisions — that is what theming is, and
**59 tokens** legitimately vary by selector.

**15 tokens are silently overridden.** The winning value is the lowest row for
each (latest import). Reported, not resolved — resolving them is a design decision, and
this file only measures.

| Token | Value | Declared in | Selector | Wins? |
|---|---|---|---|---|
| `--vt-badge-critical-bg` | `transparent` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-critical-bg` | `var(--vt-badge-unavailable-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-critical-border` | `var(--vt-severity-critical)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-critical-border` | `var(--vt-badge-unavailable-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-critical-text` | `var(--vt-severity-critical)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-critical-text` | `var(--vt-badge-unavailable-text)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-info-bg` | `transparent` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-info-bg` | `var(--vt-badge-preview-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-info-border` | `var(--vt-border)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-info-border` | `var(--vt-badge-preview-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-info-text` | `var(--vt-text-primary)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-info-text` | `var(--vt-badge-preview-text)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-neutral-bg` | `transparent` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-neutral-bg` | `var(--vt-badge-access-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-neutral-border` | `var(--vt-border)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-neutral-border` | `var(--vt-badge-access-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-neutral-text` | `var(--vt-text-secondary)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-neutral-text` | `var(--vt-badge-access-text)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-success-bg` | `transparent` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-success-bg` | `var(--vt-badge-checked-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-success-border` | `var(--vt-status-resolved)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-success-border` | `var(--vt-badge-checked-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-success-text` | `var(--vt-status-resolved)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-success-text` | `var(--vt-badge-checked-text)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-warning-bg` | `transparent` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-warning-bg` | `var(--vt-badge-pending-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-warning-border` | `var(--vt-severity-medium)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-warning-border` | `var(--vt-badge-pending-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-warning-text` | `var(--vt-severity-medium)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-warning-text` | `var(--vt-badge-pending-text)` | `styles/tokens.css` | `:root` | **yes** |

## Tokens — Typography

Fallback chains are shown in full: the substitute is what a reader actually sees when
the primary face has not loaded, so it is part of the design, not an implementation detail.

| Token | Primary | Fallback chain |
|---|---|---|
| `--vt-font-body` | `--font-geist-loaded` | `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif` |
| `--vt-font-display` | `--font-fraunces-loaded` | `Georgia, 'Times New Roman', serif` |

## Tokens — Spacing & Shapes

**Base unit:** 4px (derived — the GCD of the declared ladder)

| Token | Value |
|---|---|
| `--vt-spacing-xs` | `0.25rem` |
| `--vt-spacing-sm` | `0.5rem` |
| `--vt-spacing-md` | `1rem` |
| `--vt-spacing-lg` | `1.5rem` |
| `--vt-spacing-xl` | `2rem` |
| `--vt-spacing-2xl` | `3rem` |

### Radius, per element

| Token | Value |
|---|---|
| `--vt-radius-sm` | `0.25rem` |
| `--vt-radius-md` | `0.5rem` |
| `--vt-shape-action-page` | `8px` |
| `--vt-shape-control` | `10px` |
| `--vt-radius-lg` | `0.75rem` |
| `--vt-shape-card` | `20px` |
| `--vt-shape-panel` | `24px` |
| `--vt-shape-pill` | `9999px` |

## EC-20 conflict candidates

Locked EC-20 rows, beside tokens that implement the treatment they forbid.

**This section measures; it does not adjudicate.** Some of these legitimately serve
scoped islands (ops surfaces, `.mz`, the wave-1505 island) where the public-register
rules do not apply. Calling them defects would overclaim; calling them fine would
underclaim. Resolving each is a design decision — this file only makes them visible.

### Glass treatment

**EC-20 (LOCKED):** Frost on **chrome and scene overlays only** (A-1); evidence surfaces stay solid

| Token | Effective value |
|---|---|
| `--vt-glass-bg` | `oklch(1 0 0 / 0.05)` |
| `--vt-glass-divider` | `oklch(1 0 0 / 0.05)` |
| `--vt-glass-ring` | `oklch(1 0 0 / 0.10)` |
| `--vt-glass-ring-faint` | `oklch(1 0 0 / 0.06)` |
| `--vt-glass-subtle-bg` | `oklch(1 0 0 / 0.03)` |

### Card grammar

**EC-20 (LOCKED):** Solid hairline-ruled panels, radius 0–3px, **no shadows**

| Token | Effective value |
|---|---|
| `--vt-shadow-card` | `0 14px 32px rgb(26 34 40 / 0.05), 0 2px 10px rgb(26 34 40 / 0.03)` |
| `--vt-shadow-md` | `0 8px 16px -4px oklch(0 0 0 / 0.04), 0 4px 8px -2px oklch(0 0 0 / 0.02)` |
| `--vt-shadow-pill` | `0 1px 2px rgb(26 34 40 / 0.04)` |

### Corner-radius philosophy + pill policy

**EC-20 (LOCKED):** Scene shape scale (A-1); actions square on chrome, `--vt-shape-action-page` on page actions (A-2, E); pills for word-labels only

| Token | Effective value |
|---|---|
| `--vt-radius-lg` | `0.75rem` |
| `--vt-radius-md` | `0.5rem` |
| `--vt-radius-sm` | `0.25rem` |
| `--vt-shape-action-page` | `8px` |
| `--vt-shape-card` | `20px` |
| `--vt-shape-control` | `10px` |
| `--vt-shape-panel` | `24px` |
| `--vt-shape-pill` | `9999px` |

### Typography — display / body / mono faces

**EC-20 (LOCKED):** **Geist** for display and body; **Geist Mono** for machine facts

| Token | Effective value |
|---|---|
| `--vt-font-body` | `var(--font-geist-loaded, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif)` |
| `--vt-font-display` | `var(--font-fraunces-loaded, Georgia, 'Times New Roman', serif)` |

## Agent Prompt Guide

For an agent about to build or change a VitalCV surface. Read this before the token
table — the table says what exists, this says what to do.

- **Read the authority, not this file, for brand decisions.** EC-20 in `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` is rejection law. Where wave-1505's `DESIGN_SYSTEM.md` disagrees, EC-20 wins — 1505 is the architecture, its values are superseded.
- **Never write a raw hex or px in a component.** Consume `--vt-*` semantic tokens. Raw values outside the token files are lint-illegal, and the token table below is the whole vocabulary.
- **Check the cascade table before adding a token.** Six files declare `--vt-*` and later `@import`s win. Adding a value to the wrong file is silently overridden — 15 tokens are in that state right now.
- **A state is never colour alone.** Every state renders glyph + word. Remove all colour and the screen must stay fully readable and fully honest (EC-4).
- **Red is reserved.** `--vt-severity-critical` belongs to `revoked` — a withdrawal at the source — and nothing else. Absence (unavailable, no-active-record, not-decision-grade) is neutral: absence is not severity.
- **A check glyph means a source backed the fact.** Never put one on a gated, review, unavailable, or self-attested state. This is the design system's cardinal sin (LINT-07).
- **Every asserted state carries attribution.** Source and as-of, or an explicit statement that none was recorded. `ProvenanceChip` enforces this at the type level; do not route around it.
- **Contrast floor is AA, measured against the painted result** — not against the class name, and not against a token you assumed. Check the pair you actually ship.
- **Touch targets are 44px**, and that beats WCAG's 24px here — it is a founder ruling, not a default.
- **Customer-facing copy has a banned list.** No bare "Verified" as a status; no "automatically verified", "HIPAA compliant", "instant credentialing". `CLAUDE.md` holds the full list and CI enforces it.
- **Before creating a component, search for one that already exists.** This repo has three parallel `StateChip` implementations and five parallel evidence-row types. Duplicate design-system infrastructure is CI-blocking after UX-02.
- **Public-facing visual work needs a founder decision.** Rendered before/after evidence at desktop and mobile, a review URL, and an explicit `FOUNDER VISUAL DECISION: GO`. Green CI is not visual approval.
- **Spend the accent like a budget, not a palette.** The strongest reference systems ration colour to functional emphasis and stay near-achromatic everywhere else. VitalCV already bans state hues as decoration (EC-20) — treat that as *at most one chromatic surface per view*, and let structure come from rules and space.
- **Elevation is earned by a content class, not offered as an affordance.** Where a system permits any lift at all, it belongs to the artifact being presented, never to ordinary containers. Here the answer is stricter — EC-20 locks no shadows — so a card earns its box with a hairline or it does not get one (EC-14).
- **Tighten tracking as size grows.** Negative letter-spacing that scales with type size is what stops large display text reading as loose. EC-20 fixes the anchors and leaves the ramp to UX-02; this is the method that ramp should use.
- **Reach for half-step weights before jumping.** A variable face gives 430/450/480 as real hierarchy steps. Use them before going to 500 — the coarse 400/500/700 ladder is a static-font habit.
- **A link affordance must survive colour removal.** An arrow suffix or an underline carries it; colour alone does not (EC-4). Underline-on-hover-only is acceptable *only* when a non-colour glyph carries the affordance at rest.
- **A semantic colour's meaning is locked, and may not be borrowed for an adjacent state.** If a hue means *source-backed*, it may not also mean *nearly there*; if red means *revoked*, absence stays neutral. Borrowing a state hue for a neighbouring state is how a palette starts lying — it is the same defect as putting a check on a gated source.
- **Distinguish ink colours from surface colours, per token.** A hue licensed for data, links, and strokes is not licensed as a large fill. Ink and surface are separate roles; a token that crosses over silently changes how much weight a colour carries on the page.
- **Dark and light meet at a hard cut, never a blend.** EC-20 permits a dark public register and *requires* light for evidence artifacts, so the two registers will sit adjacent. Gradients are locked to None, so the transition is a hard edge by construction — treat it as a deliberate seam, not something to soften.

## Tokens

Role sentences come from `docs/design/design-md-roles.json`. **12 of 254**
tokens have a documented role; the rest say so plainly rather than inventing one.

| Token | Effective value | Declared in | Role |
|---|---|---|---|
| `--vt-accent` | `var(--accent)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-accent-editorial` | `var(--accent)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-accent-editorial-on-dark` | `#A5B4FC` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-accent-editorial-on-paper` | `#4338CA` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-accent-hover` | `#322BA6` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-accent-press` | `#322BA6` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-accent-strong` | `var(--ink-900)` | `styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-accent-wash` | `#ECEBF8` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-bg` | `var(--vt-action-primary-bg-rest)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-bg-disabled` | `var(--vt-scene-panel-raised)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-bg-focus` | `var(--vt-action-primary-bg-rest)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-bg-hover` | `#EDEBE5` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-bg-press` | `#E4E1D8` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-bg-rest` | `var(--vt-scene-paper)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-fg` | `var(--vt-action-primary-fg-rest)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-fg-disabled` | `var(--vt-scene-text-secondary)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-fg-focus` | `var(--vt-action-primary-fg-rest)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-fg-hover` | `var(--vt-scene-paper-text)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-fg-press` | `var(--vt-scene-paper-text)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-fg-rest` | `var(--vt-scene-paper-text)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-bg` | `var(--vt-action-primary-inverse-bg-rest)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-bg-disabled` | `#E9E7E0` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-bg-focus` | `var(--vt-action-primary-inverse-bg-rest)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-bg-hover` | `#242220` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-bg-press` | `#32302D` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-bg-rest` | `#151412` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-fg` | `var(--vt-action-primary-inverse-fg-rest)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-fg-disabled` | `var(--vt-scene-paper-text-secondary)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-fg-focus` | `var(--vt-action-primary-inverse-fg-rest)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-fg-hover` | `#F6F5F1` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-fg-press` | `#F6F5F1` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-fg-rest` | `#F6F5F1` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-bg-disabled` | `transparent` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-bg-focus` | `var(--vt-action-quiet-bg-rest)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-bg-hover` | `color-mix(in oklab, var(--vt-scene-text) 12%, transparent)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-bg-press` | `color-mix(in oklab, var(--vt-scene-text) 18%, transparent)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-bg-rest` | `transparent` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-fg-disabled` | `var(--vt-scene-text-tertiary)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-fg-focus` | `var(--vt-scene-text)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-fg-hover` | `var(--vt-scene-text)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-fg-press` | `var(--vt-scene-text)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-fg-rest` | `var(--vt-scene-text-secondary)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-inverse-bg-disabled` | `transparent` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-inverse-bg-focus` | `var(--vt-action-quiet-inverse-bg-rest)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-inverse-bg-hover` | `color-mix(in oklab, var(--vt-scene-paper-text) 7%, transparent)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-inverse-bg-press` | `color-mix(in oklab, var(--vt-scene-paper-text) 11%, transparent)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-inverse-bg-rest` | `transparent` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-inverse-fg-disabled` | `var(--vt-scene-paper-text-secondary)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-inverse-fg-focus` | `var(--vt-scene-paper-text)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-inverse-fg-hover` | `var(--vt-scene-paper-text)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-inverse-fg-press` | `var(--vt-scene-paper-text)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-quiet-inverse-fg-rest` | `var(--vt-scene-paper-text-secondary)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-badge-access-bg` | `#F0F1F3` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-access-text` | `#676257` | `styles/tokens.css` | Warm grey ink for gated and access-required states. Warm on purpose: CD-4 requires a warm ramp, and the prior blue-leaning value put cool ink on a warm surface. |
| `--vt-badge-checked-bg` | `#E8F5EE` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-checked-text` | `#2E7D45` | `styles/tokens.css` | Ink for the one affirmative state. Only `checked` earns it — a source returned a usable payload. Never decoration, never a default success colour. |
| `--vt-badge-critical-bg` | `var(--vt-badge-unavailable-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-critical-border` | `var(--vt-badge-unavailable-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-critical-text` | `var(--vt-badge-unavailable-text)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-info-bg` | `var(--vt-badge-preview-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-info-border` | `var(--vt-badge-preview-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-info-text` | `var(--vt-badge-preview-text)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-neutral-bg` | `var(--vt-badge-access-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-neutral-border` | `var(--vt-badge-access-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-neutral-text` | `var(--vt-badge-access-text)` | `styles/themes/index.css, styles/tokens.css` | Ink for absence — unavailable, no-active-record, not-decision-grade. Neutral because absence is not severity; red is reserved for revoked alone. |
| `--vt-badge-pending-bg` | `#FEF3E2` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-pending-text` | `#A05C00` | `styles/tokens.css` | Ink for in-flight and aged states (pending, stale, review-required). Amber says 'not settled', never 'wrong'. |
| `--vt-badge-preview-bg` | `#E5F4F5` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-preview-text` | `#0A7B7F` | `styles/themes/index.css, styles/tokens.css` | Ink for synthetic/preview payloads. Must never be mistaken for a real source confirmation. |
| `--vt-badge-success-bg` | `var(--vt-badge-checked-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-success-border` | `var(--vt-badge-checked-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-success-text` | `var(--vt-badge-checked-text)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-unavailable-bg` | `#F5EDED` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-unavailable-text` | `#8C2A2A` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-warning-bg` | `var(--vt-badge-pending-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-warning-border` | `var(--vt-badge-pending-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-warning-text` | `var(--vt-badge-pending-text)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-bg` | `var(--paper)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-border` | `var(--rule)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-border-2` | `var(--vt-border-subtle)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-border-subtle` | `var(--rule-soft)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-cloud-dancer` | `#F0EEE9` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-color-brand-primary` | `oklch(0.66 0.18 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-brand-secondary` | `oklch(0.48 0.18 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-danger` | `oklch(0.65 0.20 25)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-info` | `oklch(0.60 0.18 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-100` | `oklch(0.210 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-200` | `oklch(0.274 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-300` | `oklch(0.320 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-400` | `oklch(0.400 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-500` | `oklch(0.550 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-600` | `oklch(0.700 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-700` | `oklch(0.870 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-800` | `oklch(0.922 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-900` | `oklch(0.965 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-success` | `oklch(0.68 0.18 155)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-warning` | `oklch(0.75 0.17 80)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-critical` | `var(--vt-severity-critical)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-divider-light` | `oklch(0.90 0.008 80)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-divider-ops` | `oklch(0.274 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-ease-system` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-edge-co-author` | `#333333` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-edge-co-grant` | `#333333` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-edge-co-investigator` | `#333333` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-edge-industry-payment` | `#f59e0b` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-edge-practice-group` | `#333333` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-focus-ring` | `#E4E3E0` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-focus-ring-scene` | `var(--vt-accent-editorial-on-dark)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-focus-ring-scene-paper` | `var(--vt-accent-editorial-on-paper)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-font-body` | `var(--font-geist-loaded, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif)` | `styles/tokens.css` | Geist Sans via `next/font/local`, correctly bound to `--font-geist-loaded`. Matches EC-20. Fallback is the system sans stack — the substitute is part of the design, not an implementation detail. |
| `--vt-font-display` | `var(--font-fraunces-loaded, Georgia, 'Times New Roman', serif)` | `styles/tokens.css` | Fraunces, the SUPERSEDED display face — EC-20 locks Geist. Verified 2026-08-10: narrower than it looks. All four `home.css` consumers are `.film-*` classes and the film variant does NOT render in production, so the homepage is unaffected. Live consumers are `typography.css` (`--font-display`), `matcha-zen.css` (`--mz-serif`), and the authed holder nav. Resolving it is a design ruling, not a bug fix. |
| `--vt-frost-bg` | `color-mix(in oklab, var(--vt-scene-panel) 72%, transparent)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-frost-border` | `color-mix(in oklab, var(--vt-scene-text) 12%, transparent)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-glass-bg` | `oklch(1 0 0 / 0.05)` | `styles/vitalTokens.css` | Glass surface tint. EC-20 (amended A-1) permits frost on chrome and scene overlays only; evidence surfaces stay solid, so use on a proof row, artifact, receipt, or any decision-bearing surface is a conflict; the remaining tokens survive for scoped islands. Check the island before assuming a defect — the unused ones were retired in the dead-token sweep. |
| `--vt-glass-divider` | `oklch(1 0 0 / 0.05)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-glass-ring` | `oklch(1 0 0 / 0.10)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-glass-ring-faint` | `oklch(1 0 0 / 0.06)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-glass-subtle-bg` | `oklch(1 0 0 / 0.03)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-glow-passport` | `oklch(0.45 0.01 255 / 0.10)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-home-d-dim` | `#5C5852` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-d-ground` | `#F7F6F3` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-d-ink` | `#131211` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-d-panel` | `#FFFFFF` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-d-rule` | `#E0DDD6` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-d-source` | `#0F6D4E` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-action` | `#D92800` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-action-hover` | `#C42400` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-action-label` | `#FFFFFF` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-action-press` | `#B22000` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-band-text` | `#FBFAF7` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-dim` | `#5C5852` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-figure-accent` | `#D92800` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-figure-accent-band` | `#FF6B4A` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-figure-bar` | `#E6E2DA` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-figure-dim` | `#5C5852` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-figure-line` | `#141312` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-ground` | `#FBFAF7` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-ink` | `#141312` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-panel` | `#FFFFFF` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-rule` | `#E0DDD6` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-e-source` | `#0F6D4E` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-access` | `var(--vt-state-access)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-action` | `#1A1815` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-action-disabled` | `var(--vt-home-f-inset)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-action-focus` | `var(--vt-home-f-action)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-action-hover` | `var(--vt-home-f-ink)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-action-label` | `#F6F4EF` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-action-label-disabled` | `var(--vt-home-f-ink-muted)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-action-press` | `#32302D` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-attention` | `var(--vt-state-pending)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-confirmed` | `var(--vt-state-source-confirmed)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-ground` | `#EDEAE3` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-ink` | `#2B2823` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-ink-muted` | `#57534A` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-ink-strong` | `#1A1815` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-ink-subtle` | `#655E51` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-inset` | `#E3DFD5` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-raised` | `#F6F4EF` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-rule` | `#D9D4C8` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-rule-strong` | `#B8B1A1` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-signal` | `#4338CA` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-signal-wash` | `#ECEBF8` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-snapshot` | `#6E5A1C` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-home-f-unchecked` | `var(--vt-home-f-ink-subtle)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-info` | `var(--vt-accent)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-node-alert` | `#ef4444` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-node-company` | `#8b5cf6` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-node-institution` | `#E4E3E0CC` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-node-provider` | `#E4E3E0` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-node-publication` | `#E4E3E066` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-node-trial` | `#E4E3E066` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-ops-from` | `oklch(0.05 0.008 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-ops-to` | `oklch(0.05 0.008 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-ops-via` | `oklch(0.08 0.006 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-outline-default` | `1px solid var(--vt-color-neutral-200)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-outline-focus` | `2px solid var(--vt-color-brand-primary)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-outline-strong` | `2px solid var(--vt-color-neutral-900)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-outline-thin` | `1px solid var(--vt-color-neutral-800)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-overlay` | `rgba(20, 20, 20, 0.85)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-passport-from` | `oklch(0.045 0.004 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-passport-to` | `oklch(0.075 0.008 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-passport-via` | `oklch(0.07 0.005 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-radius-lg` | `0.75rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-radius-md` | `0.5rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-radius-sm` | `0.25rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-risk-high` | `var(--p0)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-risk-low` | `#10b981` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-risk-medium` | `var(--watch)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-scene-canvas` | `#151412` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-line` | `#32302D` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-line-strong` | `#403D39` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-panel` | `#1D1B19` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-panel-raised` | `#232120` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-paper` | `#F6F5F1` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-paper-line` | `#D9D6CD` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-paper-text` | `#151412` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-paper-text-secondary` | `#5B5C57` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-state-needs-person` | `#E4B45C` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-state-source-confirmed` | `#4ADE97` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-state-source-confirmed-deep` | `#2E9E6B` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-state-waiting` | `#8F8C88` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-text` | `#F2F1ED` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-text-secondary` | `#9C9D99` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-text-tertiary` | `#888A85` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-severity-critical` | `#ef4444` | `styles/themes/index.css` | The reserved fail-closed red. `revoked` only. Any other state painting this is a truth defect, not a style choice. |
| `--vt-severity-high` | `#f59e0b` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-severity-low` | `#71717a` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-severity-medium` | `#3b82f6` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-shadow-card` | `0 14px 32px rgb(26 34 40 / 0.05), 0 2px 10px rgb(26 34 40 / 0.03)` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-shadow-md` | `0 8px 16px -4px oklch(0 0 0 / 0.04), 0 4px 8px -2px oklch(0 0 0 / 0.02)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-shadow-pill` | `0 1px 2px rgb(26 34 40 / 0.04)` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-shape-action-page` | `8px` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-shape-card` | `20px` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-shape-control` | `10px` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-shape-panel` | `24px` | `styles/themes/index.css` | 24px panel radius within the A-1 scene shape scale (pill/control/card/panel); actions stay square on chrome and take --vt-shape-action-page on page actions (A-2, E). Retained for scoped islands; a public panel reaching for this is a rejection under EC-21. |
| `--vt-shape-pill` | `9999px` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-spacing-2xl` | `3rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-spacing-lg` | `1.5rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-spacing-md` | `1rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-spacing-sm` | `0.5rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-spacing-xl` | `2rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-spacing-xs` | `0.25rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-state-access` | `#a5b4fc` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-state-blocked` | `#fb7185` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-state-contradicted` | `#d8b4fe` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-state-pending` | `#fbbf24` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-state-source-confirmed` | `var(--ok)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-state-unknown` | `#94a3b8` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-status-acknowledged` | `#a1a1aa` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-status-dismissed` | `#52525b` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-status-investigating` | `#8b5cf6` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-status-new` | `#3b82f6` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-status-resolved` | `var(--ok)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-success` | `var(--vt-status-resolved)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-surface` | `var(--card)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-surface-2` | `var(--vt-surface-subtle)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-surface-base` | `oklch(0.12 0.008 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-surface-brand` | `oklch(0.97 0.03 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-surface-dim` | `#100F0E` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-surface-hero` | `linear-gradient(180deg, rgb(255 255 255 / 0.96), rgb(249 251 250 / 0.92))` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-surface-ops-base` | `oklch(0.08 0.005 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-surface-ops-raised` | `oklch(0.12 0.008 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-surface-overlay` | `oklch(1 0 0 / 0.8)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-surface-raised` | `oklch(0.18 0.008 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-surface-subtle` | `var(--paper-2)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-surface-sunken` | `oklch(0.08 0.005 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-text-1` | `var(--vt-text-primary)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-text-2` | `var(--vt-text-secondary)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-text-3` | `var(--vt-text-muted)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-text-muted` | `var(--ink-500)` | `styles/themes/index.css, styles/matcha-zen.css` | Captions and metadata, 12px and up. Never body text. |
| `--vt-text-primary` | `var(--ink-900)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-text-secondary` | `var(--ink-600)` | `styles/themes/index.css, styles/matcha-zen.css` | Support copy. The darkest grey allowed for prose at AA on paper. Never body text on a dark ground without rechecking contrast. |
| `--vt-warning` | `var(--vt-severity-medium)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-z-raised` | `10` | `styles/themes/index.css` | — *(role not documented)* |

