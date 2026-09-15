import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectDeclared,
  collectUndeclaredRefs,
  type SourceFile,
} from '../../../scripts/check-design-lint.ts';

/**
 * LINT-17 — `var(--x)` where `--x` is declared nowhere.
 *
 * The rule is cross-file, so unlike the per-line regexes it cannot be pinned
 * by `patternFor()`. Its two collectors are exported as pure functions and
 * exercised here on fixture strings. The memory rule is "inject the bug to
 * prove any gate": every declaration SHAPE the collector claims to honour is
 * pinned on the accepting side, and the undeclared reference is pinned on the
 * rejecting side, so a future edit cannot quietly stop seeing one of them —
 * which is how a ratchet inflates its own baseline.
 */

const file = (path: string, source: string): SourceFile => ({ path, source });

describe('collectDeclared — every declaration shape the tree actually uses', () => {
  it.each([
    ['CSS declaration', ':root {\n  --vt-gap-lg: 24px;\n}', 'vt-gap-lg'],
    ['one-line CSS block', ':root { --clh-page: #F4F2ED }', 'clh-page'],
    ['@theme block', '@theme inline {\n  --color-white: #F7F5F1;\n}', 'color-white'],
    ['TS quoted key', "const v = {\n  '--vt-font-body': sansStack,\n};", 'vt-font-body'],
    ['TS double-quoted key', 'const v = { "--vt-x": "1px" };', 'vt-x'],
    ['inline style object', "<div style={{ '--ezh-tx': '78px' }} />", 'ezh-tx'],
    ['computed key with assertion', "style={{ ['--vt-bs-delay' as string]: '120ms' }}", 'vt-bs-delay'],
    ['computed key as never', "style={{ ['--ezh-tx' as never]: '26px' }}", 'ezh-tx'],
    ['setProperty at runtime', "el.style.setProperty('--film-progress', String(p));", 'film-progress'],
    ['next/font variable', "const geist = Geist({ variable: '--font-geist-loaded' });", 'font-geist-loaded'],
  ])('%s declares --%s', (_label, source, name) => {
    expect(collectDeclared([file('x', source)]).has(name)).toBe(true);
  });

  it('a template-literal generator declares its whole family', () => {
    const src = 'Object.entries(spacingTokens).map(([t, v]) => [`--vt-space-${t}`, v])';
    const declared = collectDeclared([file('variables.ts', src)]);
    expect(declared.has('vt-space-*')).toBe(true);
    // and the family satisfies a concrete reference
    const refs = collectUndeclaredRefs([file('a.tsx', "'px-[var(--vt-space-12)]'")], declared);
    expect(refs).toEqual([]);
  });

  it('a generator with no literal head declares nothing', () => {
    const declared = collectDeclared([file('v.ts', '[`--${prefix}-${theme}-${token}`, value]')]);
    expect([...declared]).toEqual([]);
  });

  it('a name that survives only in a comment is NOT declared', () => {
    const declared = collectDeclared([
      file('a.css', '/* --vt-space-12: 0.75rem was retired */\n// --old-token: 1px\n'),
    ]);
    expect(declared.has('vt-space-12')).toBe(false);
    expect(declared.has('old-token')).toBe(false);
  });
});

describe('collectUndeclaredRefs — the rule fires, and only where it should', () => {
  const declared = collectDeclared([
    file('tokens.css', ':root { --vt-gap-lg: 24px; --vt-surface: #fff; }'),
  ]);

  it('injected defect: a fallback-less var() to a name nobody declares is reported with file:line', () => {
    const refs = collectUndeclaredRefs(
      [file('apps/web/styles/x.css', '.a {\n  color: red;\n  gap: var(--vt-never-declared);\n}')],
      declared,
    );
    expect(refs).toEqual([
      expect.objectContaining({
        file: 'apps/web/styles/x.css',
        line: 3,
        name: 'vt-never-declared',
      }),
    ]);
  });

  it('fires in a TSX class string too', () => {
    const refs = collectUndeclaredRefs(
      [file('a.tsx', "className='px-[var(--vt-space-999)]'")],
      declared,
    );
    expect(refs.map((r) => r.name)).toEqual(['vt-space-999']);
  });

  it('counts every occurrence, one per reference', () => {
    const refs = collectUndeclaredRefs(
      [file('a.css', 'a { color: var(--nope); background: var(--nope) }\nb { x: var(--nope) }')],
      declared,
    );
    expect(refs).toHaveLength(3);
    expect(refs.map((r) => r.line)).toEqual([1, 1, 2]);
  });

  it.each([
    ['a declared name', 'gap: var(--vt-gap-lg);'],
    ['a reference WITH a fallback', 'gap: var(--vt-unknown, 8px);'],
    ['a fallback that is itself a var()', 'gap: var(--vt-unknown, var(--vt-gap-lg));'],
    ['whitespace inside var()', 'gap: var( --vt-gap-lg );'],
    ['a reference inside a comment', '/* gap: var(--vt-unknown); */'],
    ['a line-start // comment', '// var(--vt-unknown)'],
  ])('does not fire on %s', (_label, source) => {
    expect(collectUndeclaredRefs([file('a.css', source)], declared)).toEqual([]);
  });
});

/**
 * The gate exports its collectors, so `scripts/check-design-lint.ts` is now
 * both a module and an entry point. That split is guarded by a realpath
 * comparison — and a wrong guard fails SILENTLY: the script imports fine,
 * prints nothing, exits 0, and CI turns green over a gate that never ran.
 * This proves the entry path still executes the gate, invoked the way CI does.
 */
describe('the gate still runs as an entry point', () => {
  it('prints its report when executed directly', () => {
    const script = resolve(process.cwd(), '..', '..', 'scripts', 'check-design-lint.ts');
    const r = spawnSync(
      process.execPath,
      ['--experimental-strip-types', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script],
      { encoding: 'utf8', cwd: resolve(process.cwd(), '..', '..') },
    );
    expect(r.stdout).toContain('check-design-lint — DG-18.4');
    expect(r.stdout).toContain('LINT-17');
    expect(r.stdout).toContain('LINT-16');
  }, 60_000);
});
