/**
 * D-01A — the scene register's token contract.
 *
 * The public scene tokens in styles/themes/index.css carry three founder
 * decisions (2026-08-08) and two accessibility corrections (D-00 A-1/A-2).
 * This test recomputes the WCAG ratios from the FILE, not from a copy of the
 * values, so quietly darkening a token is a red test, not a design-review
 * archaeology project.
 *
 * It also pins the bridge: the two public islands (easy-home.css, eyebrow.css)
 * may not re-introduce literal colours — every colour they use must resolve
 * through a var(). LINT-01 enforces this repo-wide as a ratchet; here it is an
 * absolute for the two files D-01A cleaned, so the debt cannot creep back into
 * exactly the files that were paid off.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesDir = join(__dirname, '..', 'styles');
const themes = readFileSync(join(stylesDir, 'themes', 'index.css'), 'utf8');

function token(name: string): string {
  const m = themes.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!m) throw new Error(`token ${name} not found as a hex literal in themes/index.css`);
  return m[1];
}

/** The raw right-hand side of a declaration, first occurrence. */
function raw(name: string): string {
  const m = themes.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`token ${name} is not declared in themes/index.css`);
  return m[1].replace(/\s+/g, ' ').trim();
}

function declared(name: string): boolean {
  return new RegExp(`(?:^|[{;\\n])\\s*${name}\\s*:`).test(themes);
}

/** Follow var() aliases to a hex literal (the file now aliases two deep). */
function resolve(name: string, depth = 0): string {
  if (depth > 6) throw new Error(`alias chain too deep at ${name}`);
  const value = raw(name);
  const alias = value.match(/^var\((--[a-z0-9-]+)\)$/);
  if (alias) return resolve(alias[1], depth + 1);
  const hex = value.match(/^#[0-9a-fA-F]{6}$/);
  if (!hex) throw new Error(`token ${name} resolves to a non-hex value: ${value}`);
  return hex[0];
}

/**
 * What a bg token PAINTS over a solid surface. `transparent` paints the
 * surface; `color-mix(in oklab, var(X) N%, transparent)` is approximated as
 * an N% sRGB blend of X into the surface. oklab and sRGB mixing differ by a
 * few units per channel; the 4.5 floor below is checked with that slack in
 * mind, and the rendered value is measured in the browser evidence.
 */
function terminal(name: string, depth = 0): string {
  if (depth > 6) throw new Error(`alias chain too deep at ${name}`);
  const value = raw(name);
  const alias = value.match(/^var\((--[a-z0-9-]+)\)$/);
  return alias ? terminal(alias[1], depth + 1) : value;
}

function paint(name: string, surface?: string): string {
  const value = terminal(name);
  if (value === 'transparent') {
    if (!surface) throw new Error(`${name} is transparent; pass the surface it sits on`);
    return resolve(surface);
  }
  const mix = value.match(/^color-mix\(in oklab, var\((--[a-z0-9-]+)\) (\d+)%, transparent\)$/);
  if (mix) {
    if (!surface) throw new Error(`${name} is a wash; pass the surface it sits on`);
    const tint = resolve(mix[1]);
    const base = resolve(surface);
    const p = Number(mix[2]) / 100;
    const ch = (hexColor: string, i: number) => parseInt(hexColor.slice(1 + i * 2, 3 + i * 2), 16);
    const blended = [0, 1, 2].map((i) => Math.round(ch(tint, i) * p + ch(base, i) * (1 - p)));
    return `#${blended.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
  return resolve(name);
}

function luminance(hexColor: string): number {
  const channel = (i: number) => {
    const c = parseInt(hexColor.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('scene register token contract (D-01A)', () => {
  it('A-1 — tertiary scene text clears AA on every scene surface', () => {
    const text3 = token('--vt-scene-text-tertiary');
    for (const surface of ['--vt-scene-canvas', '--vt-scene-panel', '--vt-scene-panel-raised']) {
      expect(
        contrast(text3, token(surface)),
        `tertiary text on ${surface} — this colour carries the truth boundary and source attributions`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('A-2 — every primary-action state clears AA (the four legacy names still resolve)', () => {
    const pairs: Array<[string, string, string]> = [
      ['--vt-action-primary-fg', '--vt-action-primary-bg', 'rest'],
      ['--vt-action-primary-fg-press', '--vt-action-primary-bg-press', 'press'],
      ['--vt-action-primary-inverse-fg', '--vt-action-primary-inverse-bg', 'inverse rest'],
      ['--vt-action-primary-inverse-fg-press', '--vt-action-primary-inverse-bg-press', 'inverse press'],
    ];
    for (const [fg, bg, state] of pairs) {
      expect(
        contrast(resolve(fg), resolve(bg)),
        `primary action at ${state} — the old green treatment was 2.99:1 here`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  describe('component-state ladder — rest / hover / focus / press / disabled (2026-09-15)', () => {
    const STATES = ['rest', 'hover', 'focus', 'press', 'disabled'] as const;
    const FAMILIES = [
      '--vt-action-primary',
      '--vt-action-primary-inverse',
      '--vt-action-quiet',
      '--vt-action-quiet-inverse',
    ] as const;

    /** The solid surface a transparent / washed quiet action sits on. */
    const SURFACE: Record<string, string> = {
      '--vt-action-quiet': '--vt-scene-panel',
      '--vt-action-quiet-inverse': '--vt-scene-paper',
    };

    it('every family declares all five states for both fg and bg', () => {
      for (const family of FAMILIES) {
        for (const state of STATES) {
          for (const side of ['bg', 'fg']) {
            expect(declared(`${family}-${side}-${state}`), `${family}-${side}-${state} is not declared`).toBe(true);
          }
        }
      }
    });

    it('the legacy un-suffixed names alias -rest byte-for-byte', () => {
      for (const family of ['--vt-action-primary', '--vt-action-primary-inverse']) {
        for (const side of ['bg', 'fg']) {
          expect(resolve(`${family}-${side}`)).toBe(resolve(`${family}-${side}-rest`));
        }
      }
    });

    it('every (fg, bg) pair in every state clears WCAG 4.5:1 — disabled included', () => {
      for (const family of FAMILIES) {
        for (const state of STATES) {
          const fg = resolve(`${family}-fg-${state}`);
          const bg = paint(`${family}-bg-${state}`, SURFACE[family]);
          expect(
            contrast(fg, bg),
            `${family} at ${state}: ${fg} on ${bg}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it('hover sits strictly between rest and press in luminance — it may not collapse back onto press', () => {
      for (const family of ['--vt-action-primary', '--vt-action-primary-inverse', '--vt-home-f-action']) {
        const [rest, hover, press] =
          family === '--vt-home-f-action'
            ? [resolve(family), resolve(`${family}-hover`), resolve(`${family}-press`)]
            : [resolve(`${family}-bg-rest`), resolve(`${family}-bg-hover`), resolve(`${family}-bg-press`)];
        const [lr, lh, lp] = [rest, hover, press].map(luminance);
        expect(lh, `${family}: hover ${hover} equals rest ${rest}`).not.toBe(lr);
        expect(lh, `${family}: hover ${hover} equals press ${press}`).not.toBe(lp);
        expect(
          (lh - lr) * (lh - lp),
          `${family}: hover ${hover} (L ${lh.toFixed(3)}) is not between rest ${rest} (L ${lr.toFixed(3)}) and press ${press} (L ${lp.toFixed(3)})`,
        ).toBeLessThan(0);
      }
    });

    it('the focus fill equals rest — focus is carried by the indigo ring (EC-5), never a fill', () => {
      for (const family of FAMILIES) {
        expect(raw(`${family}-bg-focus`)).toBe(`var(${family}-bg-rest)`);
      }
      expect(raw('--vt-home-f-action-focus')).toBe('var(--vt-home-f-action)');
    });

    it('no state resolves to a state hue, the reserved severity red, or the indigo accent', () => {
      const reserved = [
        '--vt-scene-state-source-confirmed',
        '--vt-scene-state-source-confirmed-deep',
        '--vt-scene-state-needs-person',
        '--vt-scene-state-waiting',
        '--vt-severity-critical',
        '--vt-accent-editorial-on-dark',
        '--vt-accent-editorial-on-paper',
        '--vt-state-source-confirmed',
        '--vt-state-pending',
        '--vt-home-f-snapshot',
      ].map((t) => token(t).toLowerCase());
      for (const family of FAMILIES) {
        for (const state of STATES) {
          for (const side of ['bg', 'fg']) {
            const name = `${family}-${side}-${state}`;
            if (terminal(name) === 'transparent') continue;
            const value = paint(name, SURFACE[family]).toLowerCase();
            expect(reserved, `${name} resolved to a reserved hue ${value}`).not.toContain(value);
          }
        }
      }
      for (const name of ['--vt-home-f-action-hover', '--vt-home-f-action-disabled', '--vt-home-f-action-label-disabled']) {
        expect(reserved, `${name} resolved to a reserved hue`).not.toContain(resolve(name).toLowerCase());
      }
    });

    it('the F action ladder (homepage) clears AA in every state', () => {
      const pairs: Array<[string, string]> = [
        ['--vt-home-f-action-label', '--vt-home-f-action'],
        ['--vt-home-f-action-label', '--vt-home-f-action-hover'],
        ['--vt-home-f-action-label', '--vt-home-f-action-focus'],
        ['--vt-home-f-action-label', '--vt-home-f-action-press'],
        ['--vt-home-f-action-label-disabled', '--vt-home-f-action-disabled'],
      ];
      for (const [fg, bg] of pairs) {
        expect(contrast(resolve(fg), resolve(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('every --vt-action-* / --vt-home-f-action* token a consumer references is declared', () => {
      const consumers = [
        join(__dirname, '..', 'components', 'vital', 'VitalAction.tsx'),
        join(__dirname, '..', 'components', 'employer', 'EmployerDecisionControls.tsx'),
        join(stylesDir, 'eyebrow.css'),
        join(stylesDir, 'easy-home.css'),
      ];
      for (const file of consumers) {
        const refs = new Set(
          [...readFileSync(file, 'utf8').matchAll(/var\((--vt-(?:action|home-f-action)[a-z0-9-]*)\)/g)].map((m) => m[1]),
        );
        expect(refs.size, `${file} references no ladder token — the consumer came unwired`).toBeGreaterThan(0);
        for (const ref of refs) {
          expect(declared(ref), `${file} references ${ref}, which themes/index.css does not declare`).toBe(true);
        }
      }
    });

    it('the eyebrow paints every state through the ladder, not through a borrowed press value', () => {
      const eyebrow = readFileSync(join(stylesDir, 'eyebrow.css'), 'utf8');
      // The defect this PR closes: `:hover, :focus-visible { background: …-press }`.
      expect(eyebrow).not.toMatch(/\.vcv-eb__cta:hover,\s*\n?\s*\.vcv-eb__cta:focus-visible/);
      for (const state of ['hover', 'focus', 'press', 'disabled']) {
        expect(eyebrow, `--eb-rail-action-bg-${state} is not mapped`).toContain(`--eb-rail-action-bg-${state}: var(--vt-action-primary-bg-${state})`);
        expect(eyebrow, `--eb-rail-action-bg-${state} (light) is not mapped`).toContain(`--eb-rail-action-bg-${state}: var(--vt-action-primary-inverse-bg-${state})`);
      }
    });
  });

  it('decision 3 — the focus ring is indigo and visible on its registers', () => {
    expect(contrast(token('--vt-accent-editorial-on-dark'), token('--vt-scene-canvas'))).toBeGreaterThanOrEqual(3);
    expect(contrast(token('--vt-accent-editorial-on-paper'), token('--vt-scene-paper'))).toBeGreaterThanOrEqual(3);
  });

  it('decision 2 — the action tokens are not the state hues', () => {
    const green = token('--vt-scene-state-source-confirmed').toLowerCase();
    const greenDeep = token('--vt-scene-state-source-confirmed-deep').toLowerCase();
    const actionValues = themes.match(/--vt-action-primary[a-z-]*:\s*(#[0-9a-fA-F]{6})/g) ?? [];
    for (const decl of actionValues) {
      const value = decl.split(':')[1].trim().toLowerCase();
      expect([green, greenDeep], `an action token resolved to a state green: ${decl}`).not.toContain(value);
    }
  });

  describe('E register — amendment E (2026-08-15)', () => {
    it('every E action state clears AA with its label', () => {
      const label = token('--vt-home-e-action-label');
      for (const bg of ['--vt-home-e-action', '--vt-home-e-action-hover', '--vt-home-e-action-press']) {
        expect(
          contrast(label, token(bg)),
          `E action label on ${bg} — the paper-coloured label was rejected at 4.73:1; the floor is 4.5`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('E text tokens clear AA on ground and panel', () => {
      for (const fg of ['--vt-home-e-ink', '--vt-home-e-dim']) {
        for (const bg of ['--vt-home-e-ground', '--vt-home-e-panel']) {
          expect(contrast(token(fg), token(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(
        contrast(token('--vt-home-e-band-text'), token('--vt-home-e-ink')),
        'band text on the dark band ground',
      ).toBeGreaterThanOrEqual(4.5);
    });

    it('the E action is an instrument, never a state — distinct from every state hue and the reserved severity red', () => {
      const action = token('--vt-home-e-action').toLowerCase();
      const reserved = [
        token('--vt-scene-state-source-confirmed'),
        token('--vt-scene-state-source-confirmed-deep'),
        token('--vt-scene-state-needs-person'),
        token('--vt-scene-state-waiting'),
      ].map((v) => v.toLowerCase());
      expect(reserved, 'the E action resolved to a state hue').not.toContain(action);
      // The reserved revoked-red. The E row says severity red never renders on
      // the `/` scene register; the palette-level guard is that the two values
      // never converge, because the rule cannot survive them becoming equal.
      const severityMatch = themes.match(/--vt-severity-critical:\s*(#[0-9a-fA-F]{6})/);
      if (severityMatch) {
        expect(action, 'the E action equals --vt-severity-critical').not.toBe(severityMatch[1].toLowerCase());
      }
    });
  });

  describe('F register — the founder Homepage v4 (amendment F, 2026-08-16)', () => {
    it('every F ink tier clears AA on ground, raised, and inset paper', () => {
      for (const fg of ['--vt-home-f-ink-strong', '--vt-home-f-ink', '--vt-home-f-ink-muted', '--vt-home-f-ink-subtle']) {
        for (const bg of ['--vt-home-f-ground', '--vt-home-f-raised', '--vt-home-f-inset']) {
          expect(contrast(token(fg), token(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it('the F action label clears AA at rest and press', () => {
      const label = token('--vt-home-f-action-label');
      for (const bg of ['--vt-home-f-action', '--vt-home-f-action-press']) {
        expect(contrast(label, token(bg)), `F action label on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('the F signal and the minted snapshot hue clear the graphics floor on paper', () => {
      for (const hue of ['--vt-home-f-signal', '--vt-home-f-snapshot']) {
        for (const bg of ['--vt-home-f-ground', '--vt-home-f-raised']) {
          expect(contrast(token(hue), token(bg)), `${hue} on ${bg}`).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it('the F action and signal are not state hues, and severity red stays reserved', () => {
      const action = token('--vt-home-f-action').toLowerCase();
      const signal = token('--vt-home-f-signal').toLowerCase();
      const states = [
        token('--vt-state-source-confirmed'),
        token('--vt-state-pending'),
        token('--vt-home-f-snapshot'),
        token('--vt-severity-critical'),
      ].map((v) => v.toLowerCase());
      expect(states, 'the F action resolved to a state hue').not.toContain(action);
      // The signal deliberately shares the CD-4 indigo with --vt-state-access
      // (access is indigo BY the A-1 focus/atmosphere decision); it may never
      // equal a green/amber/red state or the reserved severity red.
      expect(states, 'the F signal resolved to a non-indigo state hue').not.toContain(signal);
    });
  });

  it('the bridged islands declare no literal colours', () => {
    const colourish =
      /(?:color|background|border|fill|stroke|shadow|outline)[a-z-]*\s*:[^;]*(?:#[0-9a-fA-F]{3,8}\b|\b(?:oklch|rgba?|hsla?)\()|(?:^|[{;])\s*--(?!vt-)[a-z0-9-]+\s*:\s*[^;]*(?:#[0-9a-fA-F]{3,8}\b|\b(?:oklch|rgba?|hsla?)\()/;
    for (const island of ['easy-home.css', 'eyebrow.css']) {
      const lines = readFileSync(join(stylesDir, island), 'utf8')
        .split('\n')
        .filter((line) => colourish.test(line));
      expect(lines, `${island} re-introduced literal colour(s):\n${lines.join('\n')}`).toEqual([]);
    }
  });
});
