// UX-02A — rewrite on-scale px literals on SPACING declarations only to var(--vt-space-N).
// Colour, radius, shadow, motion, size declarations are never touched (line-disjoint with #1484).
// Declarations are matched anywhere in a line (one-line rules included); block comments are skipped.
import { readFileSync, writeFileSync } from 'node:fs';
const STEPS = new Set([2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,36,40,44,48,56,64,72,84,96,112]);
const PROP = '(?:padding|margin)(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?|gap|row-gap|column-gap|inset(?:-(?:inline|block|inline-start|inline-end|block-start|block-end))?|top|right|bottom|left|scroll-margin(?:-top)?|scroll-padding(?:-top)?|--eb-rail-top|--eb-rail-inset';
const DECL = new RegExp(`(^|[{;])(\\s*)(${PROP})(\\s*:)([^;{}]*)`, 'g');
for (const f of process.argv.slice(2)) {
  const lines = readFileSync(f, 'utf8').split('\n');
  let inComment = false, changed = 0;
  const out = lines.map((line) => {
    if (inComment) { if (line.includes('*/')) inComment = false; return line; }
    if (line.trim().startsWith('/*') && !line.includes('*/')) { inComment = true; return line; }
    const ci = line.indexOf('/*');
    const comment = ci >= 0 ? line.slice(ci) : '';
    const code = ci >= 0 ? line.slice(0, ci) : line;
    const next = code.replace(DECL, (all, a, ws, prop, colon, value) =>
      a + ws + prop + colon + value.replace(/(?<![\w.-])(\d+)px\b/g, (px, n) => (STEPS.has(Number(n)) ? `var(--vt-space-${n})` : px)));
    if (next !== code) changed++;
    return next + comment;
  });
  writeFileSync(f, out.join('\n'));
  console.log(`${f}: ${changed} lines migrated`);
}
