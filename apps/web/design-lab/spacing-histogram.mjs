// UX-02A — measure every distinct spacing literal in the two public islands.
// Spacing properties only (EC-20 spacing row); colour/radius/shadow/motion are
// out of scope and never touched by this wave.
import { readFileSync } from 'node:fs';
const files = ['styles/eyebrow.css', 'styles/easy-home.css'];
const PROPS = /^(padding(-(top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?|margin(-(top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?|gap|row-gap|column-gap|inset(-(inline|block|inline-start|inline-end|block-start|block-end))?|top|right|bottom|left|scroll-margin(-top)?|scroll-padding(-top)?)$/;
const hist = new Map();
const perFile = {};
for (const f of files) {
  const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  let count = 0;
  for (const m of src.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)) {
    const [, prop, value] = m;
    if (!PROPS.test(prop)) continue;
    for (const px of value.matchAll(/(?<![\w.-])(-?\d*\.?\d+)px\b/g)) {
      const n = Number(px[1]);
      if (n === 0) continue;
      const k = Math.abs(n);
      hist.set(k, (hist.get(k) ?? 0) + 1);
      count++;
    }
  }
  perFile[f] = count;
}
const rows = [...hist.entries()].sort((a, b) => a[0] - b[0]);
console.log('px\tcount');
for (const [k, v] of rows) console.log(`${k}\t${v}`);
console.log('\nper-file spacing literals:', perFile);
console.log('distinct values:', rows.length, 'total literals:', rows.reduce((s, [, v]) => s + v, 0));
