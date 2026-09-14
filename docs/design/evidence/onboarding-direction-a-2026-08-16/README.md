# /onboarding Direction A register pass — founder-visual-gate evidence

**Wave:** design(onboarding): Direction A register pass — the claim loop's landing
**Date:** 2026-08-16
**Method:** every image and report in this folder was captured with Playwright
(`apps/web/scripts/capture-onboarding-a-evidence.mjs`) against a **local
production build** (`next build` + `next start`, port 3277, Clerk cleared →
the signed-out lane, ephemeral receipt key). The hosted review environment is
unavailable (the known GitHub secret-propagation fault blocks
deploy-review.yml), so a local production server is the disclosed substitute —
same build mode CI's e2e server uses.

## The fixture NPI — check-digit-invalid by design

**Fixture:** NPI `1558395518` — **check-digit-invalid by design** (the
sanctioned `15583955xx` synthetic family; real-format NPIs name real people,
so an evidence fixture must be a number CMS can never have issued). NPPES
`result_count: 0`, verified 2026-08-16. Every **checksum-valid** member of
the sanctioned family was probed the same day and each is a **real, active
registrant** — which is exactly why no committed pixel, video, or report in
this folder carries a checksum-valid NPI: committed artifacts cannot be
re-verified by grep, and any checksum-valid number can later be issued to a
real person. "Ada Rivers" is a fabricated name bound only to this invalid
number. All network the flow touches is stubbed in the browser context;
nothing reaches a real registry, backend, or auth provider.

## The checksum-error capture, and the resolved-record note

The guest-resolve scenario is captured at its **checksum-error state** — the
client Luhn gate (`lib/vital/npi.ts`, CMS 80840 check digit) rejecting the
invalid fixture before any network call. This is deliberate evidence, not a
workaround artifact: Direction A has to render rejection well — the error is
carried by words with `role="alert"` and `aria-invalid`, never by colour
alone — and this proves it. The motion recordings end on the same state.

**The resolved-record state is not in the committed evidence set because an
honest capture requires a checksum-valid NPI, and committed artifacts may not
carry one (doctrine; the checksum-valid members of the sanctioned family are
all real registrants, verified 2026-08-16). The state is reviewable live: run
the local production build and enter any NPI at review time — nothing is
committed.**

## Files

- `before-*` — the pre-pass (origin/main) build. Note `before-fetching-*`:
  the shipped defect this pass fixes — the step was authored dark
  (`text-white`) under a light layout; measured h1 contrast **1.06:1** (see
  `before-runtime-report.json`).
- `after-*` — the register pass, same scenarios:
  - `entry` — /onboarding anonymous gate (1440×900 · 1280×800 · 390×844 ·
    768×1024 · reduced-motion · 200%-zoom-equivalent (720 logical px of a
    1440 canvas) · focus-visible on the action)
  - `checksum-error` — /onboarding?npi= carrying the invalid fixture; the
    Luhn gate's rejection rendered in the register
  - `fetching` — the hand-off beat (+ reduced-motion)
  - `identity` — step 2 resolved-provider review (storage-seeded synthetic
    bootstrap; the interior steps shape-gate on ten digits only)
  - `readiness` — step 3 paced activation, `readiness-completed`,
    `readiness-error`
  - `after-motion-{desktop,mobile,reduced}.webm` — the entry→checksum-error
    interaction recordings
- `{before,after}-runtime-report.json` — console/page errors, horizontal
  overflow (scrollWidth **and** the per-element right-edge sweep — the
  `1fr`/min-content trap hides from scrollWidth), interactive-target sizes
  against the EC-5 44px floor, and canvas-measured WCAG contrast of the key
  painted pairs (Chromium returns `oklch()` from getComputedStyle; colours
  are normalised through a canvas pixel and alpha-composited).

The `readiness-completed` and `readiness-error` shots render deliberately
synthetic stub responses (readiness L2 · 62/100; a synthetic 500) purely to
photograph those states — the same technique as the `/directory` evidence set
(#1424).

## After-report summary (measured, not assumed)

- Worst measured contrast across all scenarios/probes: see
  `after-runtime-report.json` (every probe ≥ 4.5:1; the fetching h1 goes
  **1.06 → 14.75**).
- Horizontal overflow at 390px: **none** (scrollWidth = innerWidth and no
  element right edge exceeds the viewport, on every scenario).
- Page errors: **0**. Console errors are harness artifacts only (the intended
  401 signed-out probe, the deliberate 503/500 stubs, and Clerk-disabled RSC
  prefetch of /holder/home — present identically in the before run).
- Sub-44px targets remaining: the shared chrome's skip link and sign-in
  (chrome is out of scope — #1434's lane) and inline prose links
  (WCAG 2.5.8-exempt inline text; unchanged from before). Every control this
  pass owns measures ≥44px.
