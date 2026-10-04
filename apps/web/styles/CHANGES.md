# Public style changes

## 2026-08-16 — The read-settle beat (cursor-field study adoption)

- Added two `from`-only house keyframes, `ezh-read-settle` (color) and
  `ezh-read-settle-dot` (background-color): a resolving-narration read-log
  step that flips to `is-read` arrives in the editorial signal hue and
  settles to its own resting ink over 220ms (the file's state-transition
  convention, `cubic-bezier(0.22, 1, 0.36, 1)`). Single-shot per step, tied
  to the genuinely-running NPI lookup — never a loop, never the carrier of
  meaning (the word and glyph carry state, EC-4). Consumed only by
  `.ezh-rv-step.is-read` and its dot in `easy-home.css`; the route's
  reduced-motion kill switch stops it with everything else.
- Provenance: the one behaviour adopted from the antigravity cursor-field
  design-lab study (`design-lab/cursor-field/`) after the founder ruled the
  full-bleed particle field NO-GO for `/` — excited elements carry indigo,
  then settle to ink, with excitement bound to real work.

## 2026-08-16 — Homepage v4 (amendment F)

- The F recomposition retires the E.2 clinical-motion consumers it landed
  beside on the same day: `ezh-badge-swing`, `ezh-fig-draw`, and
  `ezh-count-pop` lose their consumers with the superseded E figures and are
  removed from `motion.css`. Two E.2 animations KEEP consumers under F:
  `ezh-status-pulse` — the route's ONE lawful loop (EC-29 system-status
  exception, the "Listed as open" availability dot) — and `ezh-row-in`, the
  one-shot arrival for late-mounted live-feed rows.
- Added the one-shot `ezh-f-arrive` house animation for the v4 hero folio's
  four source tiles (220ms each, state-transition band, staggered). Section
  entrances reuse E.2's `useSectionReveals` one-shot system (transitions, no
  new keyframes).
- **Ambient illustration loops (amendment F.1, founder ruling "Allow ambient
  loops", 2026-08-16).** The founder's v4 illustration kit defaulted its
  animations to ambient loops; the initial F port shipped single-shot under
  EC-29's no-loop rule, then the founder ruled to allow ambient and EC-29 was
  amended (F.1) in the same PR. Ported the four `body.mo-amb` behaviours as
  house keyframes — `ezh-il-draw` (the hero cadence line's continuous trace),
  `ezh-il-travel` (the trust-flow packet dot's travel, `--ezh-tx`),
  `ezh-il-dash` (the accent connectors' dash-march), and `ezh-il-tick` (an
  illustration marker glyph's opacity breath) — each consumed ONLY by
  `.ezh-fig-art` illustration classes (aria-hidden art), never a control,
  text, status, or evidence surface (EC-4). The retired single-shot
  `ezh-f-draw` keyframe was removed with the change.
- The live-feed status pulse (`ezh-status-pulse`, EC-29's separate
  system-status exception) is unchanged.
- **Reduced motion stops EVERY animation on the route** — entrances, ambient
  loops, transitions, and the status pulse — leaving each figure in its
  complete, solid frame; the traveling packet rests invisible. SSR and no-JS
  render the complete frame; the ambient loops are pure decorative CSS.

## 2026-08-16 — Amendment E.2: homepage clinical motion set (superseded same day by F, except the status pulse)

- Added five house animations in `motion.css`, all consumed by
  `easy-home.css` behind arming attributes hydration sets only outside
  reduced motion:
  - `ezh-badge-swing` — the hero badge clips on with a ≤1.4° swing settle and
    rests untransformed (Option 1 "Chart & Badge"; one shot, 450–800ms band).
  - `ezh-fig-draw` — one-shot figure line-draw: offset animates from the
    element's `--ezh-draw-len` (set ≥ its real path length; the resting
    dasharray is that same var, so the resting stroke is visually solid).
    Chromium does not scale CSS dash values by SVG `pathLength`, so lengths
    are explicit.
  - `ezh-row-in` — one-shot arrival for late-mounted live-feed rows.
  - `ezh-status-pulse` — the route's ONE lawful loop (EC-29 system-status
    exception): the "Listed as open" availability dot, opacity-only, slow.
  - `ezh-count-pop` — 100ms control feedback on the NPI digit counter,
    animating only between real typed counts (EC-3).
- SSR, no-JS, and reduced motion render the complete resting frame; the
  easy-home reduced-motion block now also set `animation: none`.

## 2026-08-14 — Homepage warm-glass career horizon

- Added the single-shot `ezh-horizon-travel`, `ezh-horizon-breathe`, and
  `ezh-glass-catch` house animations in `motion.css`.
- The animations communicate NPI start, distinct source states, and the
  opportunity horizon; they do not loop or gate content.
- Reduced-motion and no-JavaScript states render the complete final frame.
