import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Self-test for the design-lint gate's regexes.
 *
 * A lint rule that silently matches the wrong thing is worse than no rule: it
 * inflates its own baseline with false positives, so the ratchet holds a
 * number that means nothing and real debt can hide underneath it.
 *
 * That happened. LINT-06 and LINT-09 were written as
 * `/font-family\s*:\s*(?!var\()/`, which flags CORRECTLY tokenised code:
 * the engine backtracks `\s*` to zero width, evaluates the lookahead against
 * the leading space, finds no `var(` there, and matches. Both baselines were
 * measured with that bug in place.
 *
 * These cases pin the behaviour of each rule against hand-written good and bad
 * lines, so the next edit to a pattern has to keep meaning what it says.
 */

const SOURCE = readFileSync(
  resolve(process.cwd(), '..', '..', 'scripts', 'check-design-lint.ts'),
  'utf8',
);

/** Pull a rule's live pattern out of the gate rather than restating it here. */
function patternFor(id: string): RegExp {
  // Rules are object literals: { id: 'LINT-06', ... pattern: /..../, ... }
  const block = SOURCE.split(`id: '${id}'`)[1];
  expect(block, `rule ${id} not found in check-design-lint.ts`).toBeTruthy();
  const match = /pattern:\s*(\/(?:[^/\\\n]|\\.)+\/[gimsuy]*)/.exec(block!);
  expect(match, `rule ${id} has no pattern`).toBeTruthy();
  const [, literal] = match!;
  const lastSlash = literal!.lastIndexOf('/');
  return new RegExp(literal!.slice(1, lastSlash), literal!.slice(lastSlash + 1));
}

describe('LINT-06 — box-shadow discipline', () => {
  const re = patternFor('LINT-06');

  it.each([
    'box-shadow: var(--vt-lift);',
    'box-shadow: var(--ag-shadow-1);',
    'box-shadow:var(--vt-focus-ring);',
    'box-shadow: none;',
    'box-shadow:   var(--vt-lift);',
  ])('accepts %s', (line) => {
    expect(re.test(line)).toBe(false);
  });

  it.each([
    'box-shadow: 0 16px 48px rgb(2 6 23 / 0.22);',
    'box-shadow: 0 1px 2px #000;',
  ])('rejects %s', (line) => {
    expect(re.test(line)).toBe(true);
  });
});

describe('LINT-09 — font-family discipline', () => {
  const re = patternFor('LINT-09');

  it.each([
    'font-family: var(--font-body);',
    'font-family: var(--ag-font-code);',
    'font-family:var(--font-mono);',
    'font-family:    var(--font-display);',
  ])('accepts %s', (line) => {
    expect(re.test(line)).toBe(false);
  });

  it.each([
    'font-family: Georgia, serif;',
    'font-family: -apple-system, sans-serif;',
  ])('rejects %s', (line) => {
    expect(re.test(line)).toBe(true);
  });
});

describe('the backtracking trap itself', () => {
  /**
   * The generic form of the bug. Any rule written as `:\s*(?!token)` is
   * broken; the `\s*` has to sit INSIDE the lookahead. This asserts the shape
   * of every negative-lookahead pattern in the gate, so a new rule cannot
   * reintroduce it.
   */
  it('no rule places \\s* outside a negative lookahead', () => {
    const offenders = [...SOURCE.matchAll(/pattern:\s*\/(.+?)\/[gimsuy]*,?\s*$/gm)]
      .map(([, body]) => body!)
      .filter((body) => /\\s\*\(\?!(?!\\s\*)/.test(body));
    expect(offenders).toEqual([]);
  });
});

describe('LINT-12 — the shell stylesheet set is pinned (W1083)', () => {
  const re = patternFor('LINT-12');

  it.each([
    "import Providers from './providers';",
    "import { Toaster } from '@/components/ui/sonner';",
  ])('ignores non-CSS imports: %s', (line) => {
    expect(re.test(line)).toBe(false);
  });

  it.each([
    "import './globals.css';",
    "import '../styles/antigravity.css';",
    "import '../styles/anything-new.css';",
  ])('matches every CSS import (the allow-list decides): %s', (line) => {
    // The pattern deliberately matches ALL stylesheet imports; the rule's
    // allow() then admits exactly the three pinned sheets. Testing the split
    // this way keeps the regex simple and the policy in one visible list.
    expect(re.test(line)).toBe(true);
  });
});

describe('LINT-13 — custom-property family freeze (W1083)', () => {
  const re = patternFor('LINT-13');

  it.each([
    'color: var(--vt-text-primary);',
    '  background: var(--brand-new-family-ref);', // var() REFERENCE, not a definition
    'grid-template-columns: 1fr 1fr;',
  ])('ignores references and non-token lines: %s', (line) => {
    expect(re.test(line)).toBe(false);
  });

  it.each([
    '  --vt-surface: #fff;',
    ':root { --w83-x: red; }', // the one-line form the first anchor missed
    'body:has(.clh){--clh-page:#F4F2ED}',
  ])('matches definitions wherever they sit on the line: %s', (line) => {
    expect(re.test(line)).toBe(true);
  });
});

/**
 * Content rules must not fire on their own documentation.
 *
 * Found on #1323: the last five design-lint violations on that branch were all
 * PROSE — a comment explaining why a `z-index` was removed, a comment quoting a
 * rejected reference shadow, and (the tell) the sentence "LINT-03 allows
 * keyframes". The gate punished exactly the comments most worth writing: the
 * ones recording what was rejected and why.
 *
 * `stripComments` already existed and 14 of 22 rules set it; the false-positive
 * rules simply did not. This pins the flag so it cannot be dropped again.
 *
 * LINT-08 is a DELIBERATE exception. It is the prohibited-marketing-copy rule —
 * a truth-contract gate — and a false positive there costs one reword, while
 * loosening it is a truth-surface risk. Strict on purpose.
 */
describe('comment stripping is enabled on the content rules', () => {
  const source = SOURCE;

  /** The rule object for `id`, up to the start of the next rule. */
  function ruleBody(id: string): string {
    const start = source.indexOf(`id: '${id}'`);
    expect(start, `rule ${id} must exist`).toBeGreaterThan(-1);
    const next = source.slice(start + 1).search(/id: '[^']+',/);
    return next === -1 ? source.slice(start) : source.slice(start, start + 1 + next);
  }

  it.each(['LINT-01', 'LINT-03', 'LINT-05', 'LINT-06', 'LINT-09', 'LINT-12', 'LINT-13', 'LINT-16'])(
    '%s strips comments before scanning',
    (id) => {
      expect(ruleBody(id)).toContain('stripComments: true');
    },
  );

  it('LINT-08 stays strict — a truth-contract gate, exception is deliberate', () => {
    expect(ruleBody('LINT-08')).not.toContain('stripComments: true');
  });

  it('stripComments preserves line numbers so reports stay accurate', () => {
    // The implementation blanks comment bodies rather than deleting them.
    const impl = source.slice(source.indexOf('function stripComments'));
    expect(impl.slice(0, 220)).toMatch(/replace\(\/\[\^\\n\]\/g, ' '\)/);
  });
});

/**
 * LINT-16 — a custom property accepts ANY value at parse time, so a garbled
 * unit (`22pxx`) or a unit-less length (`--icon-size-9xl: 112`) declares
 * fine and only fails, silently, where it is used. Both sides are pinned:
 * the rule must fire on the malformed shapes and must NOT fire where a bare
 * number is legal CSS (z-index stops, font weights, unit-less line-height,
 * ratios, counts) or where the value carries a unit.
 */
describe('LINT-16 — malformed custom-property value', () => {
  const re = patternFor('LINT-16');

  it.each([
    '--x: 0;',
    '--vt-z-raised: 10;',
    '--font-weight-mid: 450;',
    '--type-body-line: 1.6;',
    '--type-body-line-height: 1.5;', // unit-less line-height is the recommended form
    '--vt-shape-control: 10px;',
    '--icon-size-md: 24px;',
    '--vt-space-scale: 1.25;',
    '--vt-stagger-index: 3;',
    '--vt-opacity-muted: 0.6;',
    '--vt-aspect-ratio: 1.5;',
    '--type-body-tracking: 0;',
    '--vt-size-count: 3;',
    "  '--icon-size-md': '24px',", // TS object form with a unit
    ':root { --vt-gap-lg: 24px; }',
    'padding: var(--vt-gap-lg);', // a REFERENCE, never a declaration
  ])('accepts %s', (line) => {
    expect(re.test(line)).toBe(false);
  });

  it.each([
    '--sm-line-height: 22pxx;',
    '--icon-size-9xl: 112;',
    '--vt-gap-lg: 24;',
    '--x-radius: 8pxpx;',
    '--vt-blur-card: 12;',
    '--vt-inset-hero: 1.5remm;',
    '--type-caption-tracking: 0.02;', // unit-less letter-spacing is invalid
    '--vt-gap-lg: 24', // last line of a block, no semicolon
    ':root { --vt-gap-lg: 24 }', // the one-line form
    "  '--icon-size-9xl': '112',", // TS object form
    "  '--icon-size-9xl': 112,",
  ])('rejects %s', (line) => {
    expect(re.test(line)).toBe(true);
  });
});
