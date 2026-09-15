/**
 * spacing.ts — the UX-02A spacing scale (EC-20 "Spacing rhythm", LOCKED 2026-09-15).
 *
 * ONE source of truth. `variables.ts` maps every entry to `--vt-space-<px>` and
 * `app/layout.tsx` mounts the family on <html>; `styles/tokens.css` carries the
 * static CSS mirror so the tokens exist for stylesheets, lints and readers.
 * `__tests__/spacing-scale-contract.test.ts` pins the two against each other.
 *
 * Convention: numeric, px-named, rem-valued (`--vt-space-16` = 1rem = 16px at
 * the 16px root the app never overrides). The name states the pixel the step
 * paints at default settings, which is what a reader of `padding: var(--vt-space-12)`
 * needs; the rem value lets the rhythm follow a user's font-size preference
 * (WCAG 1.4.4) instead of pinning it.
 *
 * Steps were DERIVED from the two public islands (`styles/eyebrow.css`,
 * `styles/easy-home.css`) — 236 spacing literals, 32 distinct values, measured
 * 2026-09-15 by `design-lab/spacing-histogram.mjs` — under the founder's
 * "zero pixel change" ruling: every step is a value the islands already paint.
 *   2px grain through 32 (the measured rhythm: 6/10/14/18/22/26 carry 15–21 hits each),
 *   4px grain to 48, 8px grain to 64, then the four section-band paddings 72/84/96/112.
 * Off-scale literals (1, 7, 9, 11, 76, 150) stay literal in the islands and are
 * listed as debt in the EC-20 row; they are NOT rounded onto the scale.
 */
export const spacingTokens = {
  2: '0.125rem',
  4: '0.25rem',
  6: '0.375rem',
  8: '0.5rem',
  10: '0.625rem',
  12: '0.75rem',
  14: '0.875rem',
  16: '1rem',
  18: '1.125rem',
  20: '1.25rem',
  22: '1.375rem',
  24: '1.5rem',
  26: '1.625rem',
  28: '1.75rem',
  30: '1.875rem',
  32: '2rem',
  36: '2.25rem',
  40: '2.5rem',
  44: '2.75rem',
  48: '3rem',
  56: '3.5rem',
  64: '4rem',
  72: '4.5rem',
  84: '5.25rem',
  96: '6rem',
  112: '7rem',
} as const;

export type SpacingToken = keyof typeof spacingTokens;
