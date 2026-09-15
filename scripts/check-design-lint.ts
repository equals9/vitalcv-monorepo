/**
 * check-design-lint — DG-18.4 design-lint rules, enforced in CI.
 *
 * Source: `wave1505/DESIGN_LINT.md` from the 2026-07-12 Claude Design handoff
 * bundle, adapted to this repository. The canonical, repo-specific rule text
 * lives in `docs/design/DESIGN_LINT.md`.
 *
 * WHY THIS IS NOT A STRAIGHT PORT. The handoff's rules were written for a
 * greenfield implementation of the design system. Measured against this
 * codebase on 2026-07-22 they would have failed on arrival:
 *
 *     LINT-01 raw color          117 existing
 *     LINT-02 raw lucide         326 existing
 *     LINT-03 @keyframes         117 existing
 *     LINT-05 literal z-index     27 existing
 *     LINT-06 shadow/radius       37 existing
 *     LINT-09 font-family          8 existing
 *
 * A gate that is red the day it lands teaches everyone to ignore it. So each
 * rule carries a MODE:
 *
 *   'error'   — must be zero. Used where the codebase is already clean, and
 *               for the COMPETE composition rules, which are new contract.
 *   'ratchet' — a measured baseline in design-lint-baseline.json that may
 *               shrink but never grow. This stops the bleeding honestly
 *               instead of pretending the debt is not there.
 *
 * Ratchets are not permanent. Lower the baseline as debt is paid; the gate
 * fails if a baseline is set below the real count, so it cannot drift up.
 *
 * Usage:
 *   pnpm check:design            # enforce
 *   pnpm check:design --update   # rewrite baselines (review the diff!)
 */

import { readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const web = join('apps', 'web');
const BASELINE_PATH = join(repoRoot, 'scripts', 'design-lint-baseline.json');
const UPDATE = process.argv.includes('--update');

type Mode = 'error' | 'ratchet';

interface Rule {
  id: string;
  mode: Mode;
  what: string;
  fix: string;
  /** Repo-relative roots to walk. */
  roots: string[];
  exts: string[];
  /** Strip comments before matching — rules that DOCUMENT themselves must not trip. */
  stripComments?: boolean;
  pattern: RegExp;
  /** Return true to exempt a hit. */
  allow?: (file: string, line: string) => boolean;
}

const TSX = ['.ts', '.tsx', '.js', '.jsx'];
const CSS = ['.css'];

/**
 * Paths that legitimately define what everything else may only reference.
 *
 * D-01 corrected two entries. `styles/theme.css` has never existed in this
 * repository — the exemption named a file, and the file was not there. And
 * `styles/themes/index.css` — which tokens.css itself says "owns these tokens
 * now" — was missing, so the actual semantic owner was being linted as if it
 * were a consumer.
 */
const TOKEN_FILES = [
  join(web, 'styles', 'tokens.css'),
  join(web, 'styles', 'themes', 'index.css'),
  join(web, 'app', 'globals.css'),
];
const isTokenFile = (f: string) => TOKEN_FILES.some((t) => f === t);

/**
 * Every custom-property prefix family that exists today (measured W1083:
 * seventy of them, several only visible once the sweep stopped being line-anchored — the de-islanding debt itself). LINT-13 freezes the
 * list: existing families keep working, and defining a token under a NEW
 * family is an error, because family #68 is how the 1,023-property collapse
 * (UX-02's census work) gets harder while nobody is looking. Do not add to
 * this set without a UX-02-scoped design review; the intended direction is
 * for it to SHRINK toward --vt-* plus the scoped islands.
 */
const KNOWN_TOKEN_PREFIXES = new Set([
  'accent', 'ag', 'ask', 'blur', 'card', 'chart', 'claim', 'clh', 'color',
  'container', 'control', 'destructive', 'divider', 'doc', 'dur', 'duration',
  'ease', 'eb', 'ebm', 'ezh', 'film', 'font', 'glass', 'hdr', 'hue', 'indigo',
  'infra', 'ink', 'ivory', 'leading', 'matcha', 'mdk', 'muted', 'mz', 'ok',
  'ops', 'outline', 'p0', 'palette', 'paper', 'popover', 'primary', 'pure',
  'r', 'radius', 'rst', 'rule', 'secondary', 'shadow', 'sidebar', 'space', 'spacing',
  'spotlight', 'state', 'stone', 'surface', 'text', 'trace', 'transition',
  'trust', 'type', 'unknown', 'vcv', 'vds', 'vital', 'vt', 'w1501', 'watch',
  'z', 'z1',
]);

/**
 * OKLCH hue + chroma of the first colour literal on a line, or null when there
 * isn't one (a `var()`, `color-mix()`, or bare keyword). Used by CD-3/4, which
 * has to make a NUMERIC judgement — "is this token green?" — that a regex
 * cannot make. Node built-ins only, in keeping with the rest of this script.
 */
function colorOf(line: string): { C: number; H: number } | null {
  const ok = /oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/.exec(line);
  if (ok) return { C: Number(ok[2]), H: Number(ok[3]) };

  const hex = /#([0-9a-fA-F]{6})\b/.exec(line);
  if (!hex) return null;
  const n = hex[1];
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(n.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const H = (Math.atan2(B, A) * 180) / Math.PI;
  return { C: Math.hypot(A, B), H: H < 0 ? H + 360 : H };
}

/**
 * The COMPETE composition rules (R1–R8) from
 * docs/strategy/competitive-mandate.md. These are NEW contract, scoped to the
 * homepage surfaces, so they are hard errors rather than ratchets.
 */
const FILM_ROOTS = [join(web, 'components', 'home', 'film')];

/**
 * The LIVE `/` has not adopted the composition contract yet — COMPETE-1 built
 * the film but deliberately did not switch production routing. So the same
 * rules apply here as RATCHETS: today's violations are recorded and may not
 * grow, and they go to zero when `/` switches to HorizontalCareerFilm.
 *
 * Current known debt: HomePageClient still mounts MetricStrip, which the C5
 * ruling retires (docs/design/homepage-composition-ownership.md).
 */
const LEGACY_HOME_ROOTS = [
  join(web, 'app', 'HomePageClient.tsx'),
  join(web, 'app', 'page.tsx'),
];

/**
 * UX-V1: the live `/` composition. Governed by the same COMPETE rules as the
 * film — the previous career-loop composition was never in a lint root, which
 * was a coverage gap, not a permission.
 */
const EASY_HOME_ROOTS = [join(web, 'components', 'home', 'easy')];
const HOMEPAGE_ROOTS = [...FILM_ROOTS, ...LEGACY_HOME_ROOTS, ...EASY_HOME_ROOTS];

const RULES: Rule[] = [
  {
    id: 'LINT-01',
    stripComments: true,
    mode: 'ratchet',
    what: 'Raw color outside token files',
    fix: 'Use a --vt-* token. Raw color belongs only in the token files or a brand asset.',
    roots: [join(web, 'styles')],
    exts: CSS,
    /*
     * D-01 widened this. The first alternative is the original: a raw colour
     * in a PROPERTY declaration (`color:`, `background:`, `border:` …).
     *
     * The second is new: a raw colour in a CUSTOM-PROPERTY DEFINITION
     * (`--ezh-work: #4ade97`). The rule could not see those, so the two
     * islands that paint `/` — easy-home.css with seventeen literals and
     * eyebrow.css with fourteen, eleven of them the same value declared twice
     * — did not appear in this census AT ALL. easy-home.css scored zero while
     * being the single largest concentration of unmanaged colour in the
     * repository. A token layer whose own definitions are exempt from the
     * token rule enforces nothing where it matters.
     *
     * `--vt-*` definitions are exempt wherever they appear: that prefix IS the
     * semantic layer, and a semantic token has to be a literal somewhere.
     * Every other prefix must reference, not declare.
     */
    pattern: new RegExp(
      '(?:' +
        // 1. property declaration with a raw colour
        '(?:color|background|border|fill|stroke|shadow|outline)[a-z-]*\\s*:[^;]*' +
        '(?:#[0-9a-fA-F]{3,8}\\b|\\b(?:oklch|rgba?|hsla?)\\()' +
        '|' +
        // 2. custom-property definition with a raw colour, --vt-* excepted
        '(?:^|[{;])\\s*--(?!vt-)[a-z0-9-]+\\s*:\\s*[^;]*' +
        '(?:#[0-9a-fA-F]{3,8}\\b|\\b(?:oklch|rgba?|hsla?)\\()' +
      ')',
    ),
    allow: (f) => isTokenFile(f),
  },
  {
    id: 'LINT-02',
    mode: 'ratchet',
    what: 'Raw lucide-react import outside the Icon wrapper',
    fix: 'Import through components/Icon — the glyph set is closed. TrustGlyph is the ONLY state iconography.',
    roots: [join(web, 'app'), join(web, 'components')],
    exts: TSX,
    stripComments: true,
    pattern: /from\s+['"]lucide-react['"]/,
    allow: (f) => f.endsWith(join('components', 'Icon.tsx')),
  },
  {
    id: 'LINT-03',
    stripComments: true,
    mode: 'ratchet',
    what: '@keyframes outside the house motion file',
    fix: 'Add it to styles/motion.css with a CHANGES.md entry, or reuse an existing house animation.',
    roots: [join(web, 'app'), join(web, 'components'), join(web, 'styles')],
    exts: [...CSS, ...TSX],
    pattern: /@keyframes\b/,
    allow: (f) => f === join(web, 'styles', 'motion.css'),
  },
  {
    id: 'LINT-04',
    mode: 'error',
    what: 'Dark/ops token on a public route',
    fix: 'Ops chrome belongs on ops surfaces. Public routes are paper.',
    roots: [join(web, 'app')],
    exts: [...TSX, ...CSS],
    stripComments: true,
    pattern: /data-theme=["']ops["']|--vt-surface-inverse|var\(--ink-950\)/,
    allow: (f) =>
      /[\\/](ops|admin|intelligence|operations-engine|mission-ops|system-health)[\\/]/.test(f) ||
      f.endsWith('publicSurfaceRoutes.ts'),
  },
  {
    id: 'LINT-05',
    stripComments: true,
    mode: 'ratchet',
    what: 'Literal z-index',
    fix: 'Use a --vt-z-* stop. A seventh stop requires a CHANGES.md entry.',
    roots: [join(web, 'styles')],
    exts: CSS,
    pattern: /z-index\s*:\s*-?\d/,
    allow: (f) => isTokenFile(f),
  },
  {
    id: 'LINT-06',
    stripComments: true,
    mode: 'ratchet',
    what: 'box-shadow that is not none or a token',
    fix: 'Use var(--vt-lift) or var(--vt-focus-ring).',
    roots: [join(web, 'styles')],
    exts: CSS,
    pattern: /box-shadow\s*:\s*(?!\s*(?:none|var\(|inherit|initial|unset))/,
    allow: (f) => isTokenFile(f),
  },
  {
    id: 'LINT-08',
    mode: 'error',
    what: 'Prohibited marketing copy',
    fix: 'Remove the claim. See docs/design/DESIGN_LINT.md LINT-08.',
    roots: [join(web, 'app'), join(web, 'components')],
    exts: TSX,
    pattern:
      /\b(cheapest|guaranteed\s+(?:roi|results)|as seen in|trusted by \d|100%\s+(?:secure|verified)|blockchain-verified|bank-level)\b/i,
    allow: (_f, line) => /\bno\b|\bnever\b|\bwithout\b|\bprohibit/i.test(line),
  },
  {
    id: 'LINT-09',
    stripComments: true,
    mode: 'ratchet',
    what: 'font-family literal',
    fix: 'Use var(--font-display | --font-body | --font-mono).',
    roots: [join(web, 'styles')],
    exts: CSS,
    pattern: /font-family\s*:\s*(?!\s*var\()/,
    allow: (f) => isTokenFile(f) || f.endsWith('fonts.css'),
  },
  // ── A-1: green reports, it never asks ─────────────────────────────────────
  // EC-20's interaction row, amended 2026-08-09 (A-1): work-green is the
  // completed/source-confirmed colour and is RETIRED as the primary action —
  // the primary action is the paper-inverse instrument. That amendment was
  // written because the shipped homepage had one hex doing both jobs in a
  // single viewport, and it was fixed by hand with nothing to keep it fixed.
  //
  // A rule stated in a document and enforced nowhere is how the collision
  // happened the first time. This is the enforcement. `error`, not `ratchet`:
  // the live tree was swept clean first (the only two hits were in the dead
  // EmployerDashboard, corrected in this change), so there is no debt to
  // grandfather and the first re-offence is the offence.
  //
  // Scope is deliberately FILLS on action-shaped elements. Green as TEXT or a
  // glyph is the whole point of the colour — `✓ Done by VitalCV` must keep
  // working — so `text-*` and `color:` are not matched. `_archive` is skipped
  // by EXCLUDED_DIRS, consistent with tsconfig excluding it from the build.
  {
    id: 'LINT-15',
    mode: 'error',
    what: 'Work-green used as an action fill (EC-20 interaction row, amended A-1)',
    fix: 'Primary actions are the paper-inverse instrument (--vt-action-primary-bg/-fg). Green means source-confirmed or completed work and may never fill, tint, or hover-fill a button, link, or submit control. Green TEXT and glyphs on a completed state are correct and unaffected.',
    roots: [join(web, 'styles'), join(web, 'components'), join(web, 'app')],
    exts: [...CSS, ...TSX],
    stripComments: true,
    // Two shapes: a Tailwind green/emerald BACKGROUND utility (including
    // hover:/group-hover:/focus: prefixes and /NN opacity suffixes), and a CSS
    // background declaration resolving to the work-green family.
    pattern:
      /(?:^|[\s"'`:])(?:(?:group-)?hover:|focus(?:-visible)?:|active:)?bg-(?:emerald|green)-\d{2,3}(?:\/\d{1,3})?\b|(?:background|background-color)\s*:[^;]*(?:#(?:4ade97|2e9e6b|047857|10b981|22c55e|16a34a)\b|--(?:vt-evidence|ezh-work|eb-work|vt-scene-state-source-confirmed)\b)/i,
    allow: (file, line) => {
      // A fill is only an ACTION fill when the line carries an action. State
      // surfaces (a completed row's background tint, a status panel) are a
      // different question, governed by EC-4, and are not this rule's business.
      const actionish =
        /<(?:button|a|Link|Button)\b|role=["']button["']|type=["']submit["']|\bbtnClasses\b|\.(?:[a-z0-9-]*(?:btn|cta|button|submit|action)[a-z0-9-]*)\b/i;
      return !actionish.test(line);
    },
  },
  // ── D-01: inspiration, not imitation ──────────────────────────────────────
  // The 2026 visual language studies Dimension, Linear and ElevenLabs and
  // takes none of their material (docs/design/VITALCV_2026_VISUAL_LANGUAGE.md
  // §1.1). Measured on 2026-08-08 the repository was clean of Dimension's
  // values, which is the only reason this can be an `error` instead of a
  // ratchet: the guard costs nothing today and a migration tomorrow.
  {
    id: 'LINT-14',
    mode: 'error',
    what: "Third-party reference token in production code (Dimension's palette or token names)",
    fix: 'Use a --vt-* token. Reference style reports are studied, named and left outside the build — see VITALCV_2026_VISUAL_LANGUAGE.md §1.1.',
    roots: [join(web, 'styles'), join(web, 'components'), join(web, 'app')],
    exts: [...CSS, ...TSX],
    stripComments: true,
    // The distinctive values only. #0a0a0a and #e5e5e5 are deliberately absent:
    // they are generic greys, they predate this rule in an OG image and a
    // dashboard, and attributing them to Dimension would be false precision.
    pattern:
      /#(?:161616|d4d4d4|ededed|c2c2c2|686868|b2b2b2|6b62f2)\b|--color-(?:void-canvas|graphite|frosted-glass|bone|ash|slate|smoke|dusk-violet|ink-black|snow-white|hairline)\b|--font-dm-sans\b/i,
  },
  // ── W1083 (UX-02C): the shell's global CSS surface is pinned ───────────────
  // EC-23: "no new stylesheet imports". The shell reached five global sheets by
  // accretion — antigravity.css served zero live consumers and glass-cursor.css
  // styled markup that never rendered, and nothing failed when either landed.
  // These two rules are `error`, not `ratchet`: the debt was removed first, so
  // the first new global sheet or token-prefix family is the offence itself.
  {
    id: 'LINT-12',
    stripComments: true,
    mode: 'error',
    what: 'New global stylesheet import in the shell',
    fix: 'The shell loads exactly globals.css + typography.css + page-density.css (W1083). New CSS belongs to the island component that owns it, or to the UX-02 token layer via an @import reviewed into globals.css.',
    roots: [join(web, 'app', 'layout.tsx')],
    exts: TSX,
    pattern: /^import\s+'[^']*\.css'/,
    allow: (_f, line) =>
      ["'./globals.css'", "'../styles/typography.css'", "'../styles/page-density.css'"].some((ok) =>
        line.includes(ok),
      ),
  },
  {
    id: 'LINT-13',
    stripComments: true,
    mode: 'error',
    what: 'New custom-property prefix family',
    fix: 'Define new tokens under --vt-* (the semantic layer) or inside an existing island prefix. 70 prefix families already compete — the answer to "none of these fit" is UX-02 token work, not family #71.',
    roots: [join(web, 'styles'), join(web, 'app')],
    exts: CSS,
    // A custom-property DEFINITION introduces a family; var() references don't.
    // Anchored to line start OR a preceding { or ; so a one-line
    // `:root { --x: y }` cannot slip past — which is exactly how the first
    // injection proof failed to fire and got this anchor widened.
    pattern: /(?:^|[{;])\s*--[a-z0-9]+(?:-[a-z0-9]+)*\s*:/,
    allow: (_f, line) => {
      const matches = [...line.matchAll(/(?:^|[{;])\s*--([a-z0-9]+)(-|\s*:)/g)];
      // Un-prefixed single-word tokens (--ring:, --radius:) are shadcn-style
      // theme slots owned by globals.css; the family rule is about prefixes.
      return matches.every(
        (m) => m[2] !== '-' || KNOWN_TOKEN_PREFIXES.has(m[1]),
      );
    },
  },
  // ── Token integrity: a custom property accepts anything ────────────────────
  // `--sm-line-height: 22pxx` and `--icon-size-9xl: 112` both parse. Custom
  // properties are validated at the point of USE, not declaration, so a typo'd
  // or unit-less value is silent: the declaration succeeds, `var()` substitutes
  // it, the consuming property becomes invalid-at-computed-value-time and
  // falls back to `unset`. Nothing warns. This is the class of defect the
  // antigravity.google teardown found in its token layer, and this repository
  // has had it too (--vt-state-stale unset; undeclared --vt-space-* at one
  // point). LINT-16 covers the malformed VALUE; LINT-17 (a project rule,
  // below the per-line rules) covers the reference with no declaration.
  //
  // Two shapes, one pattern:
  //   1. any declaration whose value contains a doubled/garbled unit
  //      (`22pxx`, `8pxpx`, `1remm`, `100vhh` …);
  //   2. a bare unit-less NON-ZERO number as the ENTIRE value of a
  //      length-named property (`--vt-gap-lg: 24`).
  //
  // Shape 2 is name-gated in both directions. It fires only when a segment of
  // the name is a length word (size, width, height, gap, radius, inset,
  // padding, margin, spacing, space, offset, blur, stroke, tracking) AND no
  // segment is a word where unit-less is legal CSS: z, weight, opacity, scale,
  // ratio, columns, count, order, index (so delay-index / stagger-index),
  // opsz / wght / wdth (font-variation axes) and line — `line-height: 1.5` is
  // the recommended unit-less form, so `--type-body-line-height: 1.5` must not
  // fire; `22pxx` on the same name is still caught by shape 1. Zero needs no
  // unit and never fires. `error`, not `ratchet`: measured 0 on origin/main.
  {
    id: 'LINT-16',
    mode: 'error',
    what: 'Malformed custom-property value (garbled unit, or unit-less length)',
    fix: 'Give the token a real unit (`24px`, `1.5rem`) or, for a genuine ratio, name it so (--x-scale, --x-ratio, --x-line). A custom property accepts anything at parse time, so this is the only place the typo can be caught.',
    roots: [join(web, 'styles'), join(web, 'app'), join(web, 'design-system')],
    exts: [...CSS, ...TSX],
    stripComments: true,
    pattern: /(?:^|[{;'"])\s*--(?:[a-z0-9-]+['"]?\s*:\s*['"]?[^;'"]*?\d(?:\.\d+)?(?:pxx|pxpx|ppx|remm|emm|vhh|vww)\b|(?!(?:[a-z0-9]+-)*(?:z|weight|opacity|scale|ratio|columns|count|order|index|opsz|wght|wdth|line)(?:-|['"\s:]))(?:[a-z0-9]+-)*(?:size|width|height|gap|radius|inset|padding|margin|spacing|space|offset|blur|stroke|tracking)(?:-[a-z0-9]+)*['"]?\s*:\s*['"]?-?(?:0*[1-9]\d*(?:\.\d+)?|0*\.\d*[1-9]\d*)\s*['"]?\s*(?:[;,}]|$))/,
  },
  // ── XS-1: the one scroll owner ──────────────────────────────────────────────
  // Added 2026-08-02 with the founder cinematic rulings. All three are `error`,
  // not `ratchet`: the tree was grepped first and carries ZERO violations, so
  // there is no debt to grandfather. A ratchet here would silently permit the
  // first offence, which is exactly the offence that is hardest to remove later.
  //
  // What these CANNOT check is "exactly one scroll owner" — that is a semantic
  // property of the component tree, not a token. It is asserted in
  // __tests__/experience-doctrine.test.ts instead. These rules cover the
  // mechanisms that are textually detectable.
  {
    id: 'XS-1a',
    mode: 'error',
    what: 'Scroll interception (preventDefault on wheel/touchmove)',
    fix: 'The browser scrolls; we observe. Use a passive listener + rAF, or one top-level useScroll owner. See VITALCV_EXPERIENCE_SYSTEM_2026.md XS-1.',
    roots: [join(web, 'app'), join(web, 'components')],
    exts: TSX,
    stripComments: true,
    // Matches a wheel/touchmove handler that calls preventDefault, and the
    // `{ passive: false }` opt-out that exists only to enable it.
    pattern:
      /(?:wheel|touchmove)[\s\S]{0,200}?preventDefault|preventDefault[\s\S]{0,200}?(?:wheel|touchmove)|passive\s*:\s*false/,
  },
  {
    id: 'XS-1b',
    mode: 'error',
    what: 'Third-party scroll or 3D engine',
    fix: 'XS-1 names the permitted implementations. Framer Motion already in the tree may be used; these may not.',
    roots: [join(web, 'app'), join(web, 'components'), join(web, 'lib')],
    exts: TSX,
    stripComments: true,
    pattern:
      /from\s+['"](?:lenis|@studio-freight\/lenis|locomotive-scroll|gsap(?:\/.*)?|swiper(?:\/.*)?|three(?:\/.*)?)['"]/,
  },
  {
    id: 'XS-1c',
    mode: 'error',
    what: 'scroll-snap as page progression',
    fix: 'Scroll snap is retired as progression (CD-13 amendment). A sticky stage plus native scroll achieves the same staging without seizing the scrollbar.',
    roots: [join(web, 'styles')],
    exts: CSS,
    // stripComments matters: homepage-motion.css documents "No scroll-snap" in
    // prose, and a rule that fails on its own prohibition is a false positive.
    stripComments: true,
    pattern: /scroll-snap-type\s*:\s*(?!\s*none)/,
  },
  {
    id: 'CD-3/4',
    mode: 'error',
    what: 'Cool ink/paper token, or an accent borrowed from a state hue',
    fix: 'Ink, paper and rule are WARM (CD-4). The accent is indigo and is never a state colour (CD-3) — green means one thing: a named source returned a match.',
    roots: [join(web, 'styles')],
    exts: CSS,
    stripComments: true,
    // Guard the settled local names and the actual global light-theme tokens.
    // Do not sweep every legacy `--vt-surface-*` island: ops/base/sunken tokens
    // intentionally live in other palettes and are separate consolidation debt.
    pattern:
      /--(?:(?:ink|paper|rule|accent)[a-z0-9-]*|vt-(?:cloud-dancer|bg|surface(?:-(?:subtle|dim))?|border(?:-subtle)?|accent(?:-(?:editorial|hover))?))\s*:[^;]*(?:#[0-9a-fA-F]{3,8}\b|oklch\()/,
    allow: (_f, line) => {
      const c = colorOf(line);
      if (!c) return true;
      // Every accent token is governed as an accent — including bare
      // `--vt-accent`.
      //
      // This previously read `--(?:accent[a-z0-9-]*|vt-accent-editorial)`, which
      // did NOT match `--vt-accent`. That token was therefore governed by the
      // INK arc (hue 30–110, warm), and the comment here recorded the reason:
      // "`--vt-accent` and `--vt-accent-hover` are the ink action pair in the
      // current system."
      //
      // That was the CD-2.5 failure in miniature. CD-4 says the accent is
      // indigo and carries links, primary action, focus ring and the accent
      // word. Shipping `--vt-accent: #1A1815` made every primary action ink,
      // put the real indigo behind `--vt-accent-editorial` and inside the `.mz`
      // island, and left the public surfaces monochrome — and this rule
      // enforced that, so correcting the token would have failed CI as an "ink"
      // violation. A gate defending retired doctrine makes the right fix look
      // like a broken build.
      const isAccent = /--(?:accent[a-z0-9-]*|vt-accent(?:-[a-z0-9-]+)?)\s*:/.test(line);
      if (c.C <= (isAccent ? 0.006 : 0.004)) return true;
      return isAccent ? c.H >= 255 && c.H <= 310 : c.H >= 30 && c.H <= 110;
    },
  },
  {
    id: 'R1',
    mode: 'error',
    what: 'Graph vocabulary or node/edge drawing on a homepage surface',
    fix: 'The homepage is not a public career graph. Evidence appears as fragments, receipts, and source light — never nodes, edges, or a constellation.',
    roots: HOMEPAGE_ROOTS,
    exts: TSX,
    stripComments: true,
    pattern: /\bconstellation\b|\bforceGraph\b|\.lineTo\(|\.moveTo\(|drag to rotate/i,
  },
  {
    id: 'R2',
    mode: 'error',
    what: 'Rolodex, carousel, or wide card queue on a homepage surface',
    fix: 'A card deck is a product tour, not a film. One continuous evidence-object rail IS permitted (CD-13 amendment 2026-08-02, FR-2) — the test is whether shuffling the panels loses anything. If it does not, it is a carousel.',
    roots: HOMEPAGE_ROOTS,
    exts: TSX,
    stripComments: true,
    // `HorizontalStoryRail` was removed from this pattern on 2026-08-02.
    //
    // It was banned by NAME, and FR-2 now permits exactly that mechanism: one
    // continuous evidence-object rail driven by native vertical scroll. Leaving
    // it here would have made the founder-approved implementation fail CI as a
    // "carousel" — a gate defending doctrine that had just been retired, which
    // is the failure mode where the correct fix looks like a broken build.
    //
    // What survives is the FORMAT ban, which FR-2 explicitly preserves: a
    // Rolodex, a Carousel, a JourneyCard deck, and scroll-snap progression.
    // Those are retired regardless of what the component is called.
    pattern: /\bRolodex\b|\bCarousel\b|scroll-snap-type|\bJourneyCard\b/i,
  },
  {
    id: 'R4',
    mode: 'error',
    what: 'Metric theatre in the film',
    fix: 'No counters, 01–06 step numbering, or percentage rings. Animate only returned personal state.',
    roots: FILM_ROOTS,
    exts: TSX,
    stripComments: true,
    pattern: /AnimatedMetricValue|\bReadinessRing\b|\bMetricStrip\b|role\s*[=:]\s*["']meter["']/,
  },
  {
    id: 'R4-legacy',
    mode: 'ratchet',
    what: 'Metric theatre on the un-migrated `/`',
    fix: 'Clears when `/` switches to HorizontalCareerFilm (C5 retires MetricStrip).',
    roots: LEGACY_HOME_ROOTS,
    exts: TSX,
    stripComments: true,
    pattern: /AnimatedMetricValue|\bReadinessRing\b|\bMetricStrip\b|role\s*[=:]\s*["']meter["']/,
  },
  {
    id: 'R7',
    mode: 'error',
    what: 'Retired legacy homepage copy',
    fix: 'Superseded by the outcome-first hero.',
    roots: HOMEPAGE_ROOTS,
    exts: TSX,
    stripComments: true,
    pattern: /Find the opportunity|VitalCV recognizes/i,
  },
  {
    // Renamed 2026-08-02. This rule matches `wheel`/`touchmove` handlers, which
    // is scroll INTERCEPTION — it never detected a second scroll *owner*, and a
    // second `addEventListener('scroll')` passes it cleanly. The old name
    // claimed a guarantee the pattern does not provide, so a reviewer citing
    // "R8 is green" would have been citing the wrong thing.
    //
    // Ownership is a property of the component tree, not a token, so it is
    // asserted in __tests__/experience-doctrine.test.ts instead — that test
    // counts the scroll owners and fails on two.
    id: 'R8',
    mode: 'error',
    what: 'Wheel/touch scroll interception on a homepage surface',
    fix: 'The browser scrolls; we observe (XS-1). Ownership itself is asserted by __tests__/experience-doctrine.test.ts.',
    roots: HOMEPAGE_ROOTS,
    exts: TSX,
    stripComments: true,
    pattern: /addEventListener\(\s*["'](?:wheel|touchmove)["']|onWheel=/,
  },
];

const EXCLUDED_DIRS = new Set([
  'node_modules', '.next', '.turbo', 'dist', 'build', 'coverage', '_archive', '__tests__', 'tests',
]);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '');
}

function walk(absPath: string, exts: string[], out: string[]): void {
  let st;
  try {
    st = statSync(absPath);
  } catch {
    return;
  }
  if (st.isFile()) {
    if (exts.some((e) => absPath.endsWith(e))) out.push(absPath);
    return;
  }
  if (!st.isDirectory()) return;
  for (const entry of readdirSync(absPath, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
    walk(join(absPath, entry.name), exts, out);
  }
}

// ── Project rules: cross-file checks ────────────────────────────────────────
// A per-line `Rule` sees one line of one file. LINT-17 has to know every
// declaration in the tree before it can judge a single reference, so it lives
// here as a PROJECT rule with its own collector pass. The per-line loop above
// is untouched; the two kinds share the reporter and the baseline file.
//
// The collectors are exported and PURE (strings in, findings out) so the
// self-test can inject a defect and watch the rule fire — a gate nobody has
// seen fail is not a gate. Importing this module does not run the gate: the
// `isMainModule()` guard at the bottom keeps the procedural tail off the
// import path.

export interface SourceFile {
  /** Repo-relative path, used in reports. */
  path: string;
  source: string;
}

export interface UndeclaredRef {
  file: string;
  line: number;
  name: string;
  text: string;
}

/**
 * Every custom-property NAME the tree declares, as `name` without the leading
 * `--`. Generous by design — a reference is only a finding when NOTHING in
 * apps/web could have declared it:
 *
 *   --name:            CSS declaration (also `@theme` blocks, `:root`, any rule)
 *   '--name':          TS/TSX object key: inline `style={{ '--x': … }}`,
 *                      design-system/styles/variables.ts, app/layout.tsx
 *   ['--name' as T]:   the same key written as a computed property
 *   setProperty('--name'   runtime declaration from a hook or effect
 *   variable: '--name'     next/font's CSS-variable option
 *   `--prefix-${…}`        a template-literal GENERATOR declares the whole
 *                          `prefix-*` family (variables.ts builds every
 *                          --vt-space-N and --ui-<theme>-* this way, and
 *                          layout.tsx mounts them on <html>). A generator
 *                          with no literal head (`--${…}`) declares nothing —
 *                          an empty prefix would declare everything.
 *
 * Comments are blanked first, so a name that survives only in prose
 * ("--vt-space-12 was retired") does not count as declared.
 *
 * What this cannot see: whether a generated family is actually MOUNTED. It
 * takes the generator's existence as the declaration. That is the generous
 * side of the trade, chosen so the ratchet holds a number made of real debt
 * rather than of things the gate could not resolve.
 */
export function collectDeclared(files: SourceFile[]): Set<string> {
  const declared = new Set<string>();
  for (const { source } of files) {
    const s = stripComments(source);
    for (const m of s.matchAll(/--([a-z0-9-]+)['"]?\s*:/g)) declared.add(m[1]!);
    // Computed key with a type assertion: `['--x' as string]: '120ms'` — five
    // of these exist (BandSystemReference, CareerLoopHome, TrustFlowFigure).
    for (const m of s.matchAll(/\[\s*['"`]--([a-z0-9-]+)['"`]\s*(?:as\s+[A-Za-z.]+\s*)?\]\s*:/g)) declared.add(m[1]!);
    for (const m of s.matchAll(/setProperty\(\s*['"`]--([a-z0-9-]+)['"`]/g)) declared.add(m[1]!);
    for (const m of s.matchAll(/variable\s*:\s*['"]--([a-z0-9-]+)['"]/g)) declared.add(m[1]!);
    for (const m of s.matchAll(/`--([a-z0-9-]+)\$\{/g)) declared.add(`${m[1]!}*`);
  }
  return declared;
}

/**
 * Every `var(--name)` reference WITHOUT a fallback whose name is neither
 * declared exactly nor covered by a generated family. A reference with a
 * fallback (`var(--x, 8px)`) is excluded on purpose: the author has said what
 * happens when the token is absent, so the failure is not silent.
 *
 * Matches the same text in CSS and in TSX class strings
 * (`px-[var(--vt-space-12)]`) — the regex does not care which.
 */
export function collectUndeclaredRefs(files: SourceFile[], declared: Set<string>): UndeclaredRef[] {
  const families = [...declared].filter((d) => d.endsWith('*')).map((d) => d.slice(0, -1));
  const out: UndeclaredRef[] = [];
  for (const { path, source } of files) {
    stripComments(source).split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/var\(\s*--([a-z0-9-]+)\s*\)/g)) {
        const name = m[1]!;
        if (declared.has(name)) continue;
        if (families.some((f) => name.startsWith(f))) continue;
        out.push({ file: path, line: i + 1, name, text: line.trim().slice(0, 140) });
      }
    });
  }
  return out;
}

/**
 * Names declared by an installed package rather than by this tree. Each entry
 * was MEASURED, not guessed, and cites where the declaration lives. This gate
 * runs in CI without `pnpm install` (see design-lint-gate.yml), so it cannot
 * scan node_modules itself — doing so locally would make the count differ
 * between a laptop and CI, which is a ratchet that cannot be trusted.
 *
 *   spacing   Tailwind v4 default theme: node_modules/tailwindcss/theme.css
 *             (`--spacing: 0.25rem`), consumed by components/ui/alert.tsx.
 *   radix-*   Radix UI sets its measurement properties at runtime via
 *             style.setProperty (e.g. "--radix-accordion-content-height" in
 *             @radix-ui/react-accordion/dist/index.mjs), consumed by
 *             app/globals.css.
 *
 * Adding an entry here requires the same citation. `--tw-*` is deliberately
 * absent: measured, no fallback-less `var(--tw-…)` reference exists.
 */
const VENDOR_DECLARED = ['spacing', 'radix-*'];

interface ProjectHit { file: string; line: number; text: string }

interface ProjectRule {
  id: string;
  mode: Mode;
  what: string;
  fix: string;
  run: () => ProjectHit[];
}

function readTree(roots: string[], exts: string[]): SourceFile[] {
  const files: string[] = [];
  for (const root of roots) walk(join(repoRoot, root), exts, files);
  const out: SourceFile[] = [];
  for (const abs of files) {
    try {
      out.push({ path: relative(repoRoot, abs).split(sep).join(sep), source: readFileSync(abs, 'utf8') });
    } catch {
      /* unreadable: skip, same as the per-line loop */
    }
  }
  return out;
}

const PROJECT_RULES: ProjectRule[] = [
  // The other half of the antigravity finding. A `var(--x)` whose `--x` is
  // declared nowhere is not an error to any tool in the pipeline: the property
  // computes to its initial value and the surface quietly loses its spacing,
  // colour or shadow. This repository shipped `--vt-state-stale` unset and, at
  // one point, `--vt-space-*` references before the generator that declares
  // them existed. `ratchet`: measured non-zero on origin/main — the debt is
  // listed in the PR that added this rule and in DESIGN_LINT.md.
  {
    id: 'LINT-17',
    mode: 'ratchet',
    what: 'var(--x) with no fallback, where --x is declared nowhere in apps/web',
    fix: 'Declare the token (usually in styles/tokens.css or themes/index.css), reference one that exists, or give the var() a fallback that states what happens without it.',
    run: () => {
      // Declarations: anywhere in apps/web (EXCLUDED_DIRS drops _archive, tests,
      // build output). Generous on purpose — see collectDeclared.
      const declared = collectDeclared(
        readTree([web], [...CSS, ...TSX, '.mjs']),
      );
      for (const v of VENDOR_DECLARED) declared.add(v);
      // References: the shipped surfaces only.
      const refs = collectUndeclaredRefs(
        readTree(
          [join(web, 'styles'), join(web, 'app'), join(web, 'components'), join(web, 'design-system')],
          [...CSS, '.ts', '.tsx'],
        ),
        declared,
      );
      return refs.map((r) => ({ file: r.file, line: r.line, text: `${r.text}  [--${r.name}]` }));
    },
  },
];

// ── The gate ─────────────────────────────────────────────────────────────────

interface Hit { rule: Rule; file: string; line: number; text: string }

/** One row of the report, whichever kind of rule produced it. */
interface Report {
  id: string;
  mode: Mode;
  what: string;
  fix: string;
  count: number;
  sample: ProjectHit[];
}

/**
 * True when this file is the process entry (`node … scripts/check-design-lint.ts`,
 * which is what `pnpm check:design` and CI run) and false when it is merely
 * imported (the self-test imports the collectors). Both sides are realpath'd:
 * on macOS `/tmp` is a symlink to `/private/tmp`, and comparing a symlinked
 * argv[1] against a resolved import.meta.url would silently turn the gate into
 * a no-op that exits 0. Any error resolves toward RUNNING the gate.
 */
function isMainModule(): boolean {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return realpathSync(resolve(arg)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return true;
  }
}

function main(): void {
  const hits: Hit[] = [];

  for (const rule of RULES) {
    const files: string[] = [];
    for (const root of rule.roots) walk(join(repoRoot, root), rule.exts, files);

    for (const abs of files) {
      const rel = relative(repoRoot, abs).split(sep).join(sep);
      let source: string;
      try {
        source = readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      if (rule.stripComments) source = stripComments(source);

      source.split('\n').forEach((line, i) => {
        if (!rule.pattern.test(line)) return;
        if (rule.allow?.(rel, line)) return;
        hits.push({ rule, file: rel, line: i + 1, text: line.trim().slice(0, 140) });
      });
    }
  }

  const counts = new Map<string, number>();
  for (const h of hits) counts.set(h.rule.id, (counts.get(h.rule.id) ?? 0) + 1);

  const reports: Report[] = RULES.map((rule) => ({
    id: rule.id,
    mode: rule.mode,
    what: rule.what,
    fix: rule.fix,
    count: counts.get(rule.id) ?? 0,
    sample: hits.filter((x) => x.rule.id === rule.id).slice(0, 8),
  }));
  for (const rule of PROJECT_RULES) {
    const found = rule.run();
    reports.push({
      id: rule.id,
      mode: rule.mode,
      what: rule.what,
      fix: rule.fix,
      count: found.length,
      sample: found.slice(0, 8),
    });
  }

  let baseline: Record<string, number> = {};
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    baseline = {};
  }

  if (UPDATE) {
    const next: Record<string, number> = {};
    for (const r of reports) {
      if (r.mode === 'ratchet') next[r.id] = r.count;
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log('design-lint — baselines written to scripts/design-lint-baseline.json');
    for (const [id, n] of Object.entries(next)) console.log(`  ${id}  ${n}`);
    process.exit(0);
  }

  console.log('check-design-lint — DG-18.4 + COMPETE composition rules\n');

  const failures: string[] = [];

  for (const r of reports) {
    const n = r.count;

    if (r.mode === 'error') {
      if (n === 0) {
        console.log(`  PASS   ${r.id}  ${r.what}`);
        continue;
      }
      failures.push(r.id);
      console.log(`  FAIL   ${r.id}  ${r.what} — ${n} violation${n === 1 ? '' : 's'}`);
      for (const h of r.sample.slice(0, 8)) {
        console.log(`         ${h.file}:${h.line}  ${h.text}`);
      }
      console.log(`         fix: ${r.fix}`);
      continue;
    }

    const base = baseline[r.id];
    if (base === undefined) {
      failures.push(r.id);
      console.log(`  FAIL   ${r.id}  no baseline recorded — run \`pnpm check:design --update\``);
      continue;
    }
    if (n > base) {
      failures.push(r.id);
      console.log(`  FAIL   ${r.id}  ${r.what} — ${n} now, baseline ${base} (+${n - base})`);
      for (const h of r.sample.slice(0, 6)) {
        console.log(`         ${h.file}:${h.line}  ${h.text}`);
      }
      console.log(`         fix: ${r.fix}`);
    } else if (n < base) {
      console.log(`  PASS   ${r.id}  ${n} (baseline ${base} — LOWER THE BASELINE: pnpm check:design --update)`);
    } else {
      console.log(`  HOLD   ${r.id}  ${n} at baseline — ${r.what}`);
    }
  }

  console.log();
  if (failures.length > 0) {
    console.error(`design-lint FAILED: ${failures.join(', ')}`);
    console.error('See docs/design/DESIGN_LINT.md for each rule and its exceptions.');
    process.exit(1);
  }
  console.log(`design-lint PASS — ${RULES.length + PROJECT_RULES.length} rules checked.`);
}

if (isMainModule()) main();
