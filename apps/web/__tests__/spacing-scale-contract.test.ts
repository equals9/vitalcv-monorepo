/**
 * spacing-scale-contract.test.ts — UX-02A spacing scale (EC-20 "Spacing rhythm",
 * LOCKED 2026-09-15 on founder ruling).
 *
 * `design-system/tokens/spacing.ts` is the ONE source of spacing truth. Two
 * consumers derive from it: `variables.ts` maps it to `--vt-space-<px>` and
 * app/layout.tsx mounts that on <html> (inline style — it outranks any :root
 * block); `styles/tokens.css` carries the static CSS mirror so stylesheets,
 * LINT-17 and readers see the family declared. Before this wave the CSS side
 * had ZERO declarations while the TS side emitted eleven: nothing compared
 * them, so a `var(--vt-space-*)` in a stylesheet was resolved only by the
 * runtime mount. This suite is that comparison, plus the scale's own shape.
 *
 * The islands this wave migrated (`styles/eyebrow.css`, `styles/easy-home.css`)
 * must reference only declared steps, and must actually reference them — the
 * founder visual gate bans a design-system token with no mounted consumer.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { themeCssVariables } from '@/design-system/styles/variables';

const WEB = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(WEB, p), 'utf-8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

const tokensCss = stripComments(read('styles/tokens.css'));
const ISLANDS = ['styles/eyebrow.css', 'styles/easy-home.css'];

/** `--vt-space-N: V` pairs declared in tokens.css, in source order. */
function cssScale(): Array<[number, string]> {
  return [...tokensCss.matchAll(/--vt-space-(\d+)\s*:\s*([^;]+);/g)].map(([, n, v]) => [Number(n), v.trim()]);
}

const ROOT_PX = 16; // app/layout.tsx and globals.css never set html { font-size }

describe('the scale itself (spacing.ts)', () => {
  const steps = Object.keys(spacingTokens).map(Number);

  it('every step is a positive rem value whose px name states what it paints at the 16px root', () => {
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      const value = spacingTokens[step as keyof typeof spacingTokens];
      expect(value, `--vt-space-${step}`).toMatch(/^\d+(\.\d+)?rem$/);
      const px = Number.parseFloat(value) * ROOT_PX;
      expect(px, `--vt-space-${step} = ${value} paints ${px}px, not ${step}px`).toBe(step);
      expect(px).toBeGreaterThan(0);
    }
  });

  it('steps are strictly ascending', () => {
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i], `step ${steps[i]} after ${steps[i - 1]}`).toBeGreaterThan(steps[i - 1]!);
    }
  });
});

describe('the CSS mirror agrees with the source of truth', () => {
  it('tokens.css declares exactly the spacing.ts steps, with identical values, in ascending order', () => {
    const css = cssScale();
    expect(css.length).toBeGreaterThan(0);
    expect(css.map(([n]) => n)).toEqual(Object.keys(spacingTokens).map(Number));
    for (const [n, v] of css) {
      expect(v, `--vt-space-${n} in tokens.css`).toBe(spacingTokens[n as keyof typeof spacingTokens]);
    }
  });

  it('the runtime <html> mount (variables.ts) derives from spacing.ts, not its own literals', () => {
    for (const [n, v] of Object.entries(spacingTokens)) {
      expect(themeCssVariables[`--vt-space-${n}` as keyof typeof themeCssVariables]).toBe(v);
    }
    const mounted = Object.keys(themeCssVariables).filter((k) => k.startsWith('--vt-space-'));
    expect(mounted.sort()).toEqual(Object.keys(spacingTokens).map((n) => `--vt-space-${n}`).sort());
  });
});

describe('the two public islands consume the scale', () => {
  const declared = new Set(Object.keys(spacingTokens).map((n) => `--vt-space-${n}`));

  it('every var(--vt-space-*) they reference is a declared step', () => {
    for (const island of ISLANDS) {
      const refs = [...stripComments(read(island)).matchAll(/var\(\s*(--vt-space-[0-9a-z-]+)\s*\)/g)].map((m) => m[1]!);
      expect(refs.length, `${island} references the scale`).toBeGreaterThan(0);
      const undeclared = refs.filter((r) => !declared.has(r));
      expect(undeclared, `${island} references undeclared steps`).toEqual([]);
    }
  });

  /**
   * Values that sit on a step but are NOT rhythm — geometry inside a drawn,
   * fixed-px artefact — stay literal and are pinned here by exact declaration
   * so the list can only grow deliberately. The menu glyph's bar gap is the
   * one case: on the rem scale it doubles at a 200% user font-size and the
   * three bars collapse to 0px (measured 2026-09-15, EC-20 spacing row).
   */
  const GLYPH_GEOMETRY: Record<string, string[]> = {
    'styles/eyebrow.css': ['gap: 4px'],
  };

  it('no spacing declaration in the islands still carries an on-scale px literal (the migration is complete)', () => {
    const PROP = '(?:padding|margin)(?:-[a-z-]+)?|gap|row-gap|column-gap|inset(?:-[a-z-]+)?|top|right|bottom|left';
    const decl = new RegExp(`(?:^|[{;])\\s*(?:${PROP})\\s*:([^;{}]*)`, 'gm');
    for (const island of ISLANDS) {
      const src = stripComments(read(island));
      const onScale: string[] = [];
      for (const m of src.matchAll(decl)) {
        for (const px of m[1]!.matchAll(/(?<![\w.-])(\d+)px\b/g)) {
          if (declared.has(`--vt-space-${px[1]}`)) onScale.push(m[0].replace(/^[{;]?\s*/, "").trim());
        }
      }
      expect(onScale, `${island} has on-scale literals`).toEqual(GLYPH_GEOMETRY[island] ?? []);
    }
  });
});
