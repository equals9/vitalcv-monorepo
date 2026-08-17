# Cursor Field — design-lab exhibit

**What this is.** A faithful, fully original replication of the interactive cursor
particle animation on `antigravity.google` (the hero field), reverse-engineered
2026-08-16 and rebuilt in raw WebGL2 with VitalCV's sanctioned palette. It is a
**design-lab exhibit only** — nothing here is mounted on a product surface, and
per the analysis below it must not be until the founder amends the law.

Run: any static server over this directory → `cursor-field/`.
`?rm=1` forces the reduced-motion path for review.

---

## 1. The source mechanism (reverse-engineered)

Source: `MainParticlesComponent.astro_astro_type_script_index_0_lang.Dox42TL8.js`
(three.js GPGPU; two instances on the page — light hero, dark download section).
The cursor dot itself is a separate GSAP `quickTo` follower (`CustomCursor…js`);
the morphing product-panel shapes are a third component. This exhibit replicates
the hero field.

| Piece | Mechanism |
| --- | --- |
| Home positions | Poisson-disc sampling (`poisson-disk-sampling`), 500×500 grid, min distance mapped `density 0–300 → 10–2`, normalized to [-1,1] |
| State | 256×256 RGBA float texture, ping-pong FBOs; texel = `(pos.xy, scale, velocity)` |
| Ring | Cursor raycast onto an invisible plane; ring position eases toward it at 0.02/frame (0.01 when idle, wandering on 1-D noise); radius breathes: `0.175 + sin(t)·0.03 + cos(3t)·0.02` |
| Excitation | Three smoothstep bands around the ring radius (outer band `uRingWidth`, sharp band `uRingWidth2`, interior fill) → target scale; scale eases 0.2/frame; velocity = `v·0.5 + scale·0.25` |
| Ambient | 3-D simplex noise at three scales (×2, ×4, ×20) + a sine drift; every particle keeps a small nonzero scale |
| Displacement | Particles push away from the ring center by `t2^0.75 · uRingDisplacement`, with a ×0.8 damped positional feedback blended ×0.25 (the springy settle; fixed point = 1.25× home) |
| Sprite | Point sprite shaped by a rounded-box SDF (`b=(0.5,0.2)`, `r=0.25`) — a pill — rotated to face the ring plus noise; size = `scale·7·(dpr·0.5)·(cssWidth/2000·particlesScale)` |
| Color | 3-stop ramp mixed by low-frequency noise (`h=0.8`); light scheme multiplies by velocity so resting pills darken toward ink and excited ones show color |
| Hygiene | IntersectionObserver pause offscreen, every-other-frame raycast, full dispose on unload |

Live tuning read off the deployed hero: `density 230 · ringWidth 0.006 ·
ringWidth2 0.107 · displacement 0.62 · particlesScale 0.59` (defaults in this
exhibit). Dark section: `0.15 / 0.05 / 0.23 / 220 / 0.65`.

## 2. What is original here

No source code, assets, or fonts were copied. The implementation is written
from the spec above: raw WebGL2 (no three.js — XS-1b bans the import), Bridson
Poisson sampling, seeded mulberry32 PRNG (zero `Math.random`, per house
discipline), ping-pong `RGBA32F`/`16F` state, `gl_VertexID` point pull, and the
standard Ashima/Gustavson simplex GLSL (MIT). Palette is VitalCV's:

- **Scene:** `#A5B4FC` (indigo-300) → `#4338CA` (indigo-700) → `#151412` (scene canvas)
- **Paper:** `#4338CA` → `#322BA6` (press) → `#1A1815` (ink), velocity-darkened
- Reference modes carry the source's values for fidelity comparison only.

Indigo is the one hue the constitution allows as atmosphere ("Indigo is
atmosphere and focus; it never reports state"). No state hue is spent as
decoration (EC-3).

## 3. Law analysis — why this is not mounted

Verified against `origin/main` @ `57dfe9f8b` (2026-08-16):

1. **EC-29 "Nothing loops" (Class A).** Amendment F.1 (founder ruling
   2026-08-16, "Allow ambient loops") authorizes ambient loops **only inside a
   homepage illustration figure** (`.ezh-fig-art`, pure CSS), `/` only. A
   full-bleed cursor-reactive canvas is outside that scope. Extending the
   exception "requires its own amendment" (F.1, closing line).
2. **Parked era.** `PARKED_VISUAL_ERAS.md` §3 — "Antigravity (particles, glass,
   magnetic buttons)" — is parked and unloaded (W1083). EC-22: parked eras
   return only via amendment. A cursor particle field is this era's named
   device.
3. **Duplicate intent.** `ParticleLayer.tsx`, `BackgroundField.tsx`,
   `AmbientField.tsx`, `NetworkBackground.tsx`, `FlowBackground.tsx`, and
   `CareerEvidenceField` (+ `webgpu.ts`) all exist with zero production
   importers. Founder Visual Gate §1 forbids another primitive with the same
   intent; the mounting wave must supersede or delete them, not join them.
4. **EC-14.** Decorative 3D/atmospheric imagery is default-rejected at review;
   founder sign-off can override.
5. **EC-26.** A mounted field is a `VisualScene` (`kind='decorative'`,
   `priority='background'`) and owes a poster + static reduced-motion
   composition. The exhibit already produces the static composition natively.

## 4. Draft amendment (for the founder to adopt, adapt, or reject)

> **Amendment F.2 — pointer-reactive ambient field on the `/` scene register
> (founder ruling, YYYY-MM-DD).** One bounded extension of F.1: a decorative,
> pointer-reactive particle field may render as the hero scene background on
> `/`. Constraints: fine pointers only; under `prefers-reduced-motion` the
> field rests in a complete static composition with zero animation; no-JS and
> no-WebGL render the plain scene background with nothing missing; the field
> never owns input (`pointer-events: none`), never carries meaning (EC-4:
> removing it costs only atmosphere), uses only editorial-indigo atmosphere
> tokens (never a state hue, EC-3), and text contrast floors hold over the
> field's brightest local state (EC-5). This returns exactly one device of the
> parked Antigravity era (the particle field); glass and magnetic buttons stay
> parked. Implementation must supersede the repo's dead particle primitives
> (`ParticleLayer`, `BackgroundField`, `AmbientField`, marketing backgrounds) —
> one primitive, one consumer, or delete them in the same wave.

## 5. Integration plan (if ruled GO)

1. Port this file's engine into one TS component (client-only, dynamic import,
   SSR-safe) under `components/home/scene/`, superseding the dead primitives.
2. Mount as the `/` hero background layer behind `.ezh-wrap`; hero copy and
   `NpiEntry` untouched; canvas `aria-hidden`, `pointer-events: none`.
3. Gates to clear: design-lint (no raw hex → tokens via CSS variable reads;
   `--vt-z-*` stop; no new keyframes), doctrine test (no wheel/touch
   interception — the field has none), EC-26 scene registration, founder
   visual gate evidence set (1440/390/768/1728 + reduced-motion + recordings +
   review URL), and the production-build verification.
4. Perf budget: DPR ≤ 2, sim texture ≤ 64², ~1–2k particles, rAF paused
   offscreen/hidden — measured, not assumed, per EC-29.
