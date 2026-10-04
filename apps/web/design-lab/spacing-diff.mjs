// Pixel + bounding-box diff between two spacing-capture labels.
import { PNG } from 'pngjs';
import { readFileSync, readdirSync } from 'node:fs';
const [a, b] = process.argv.slice(2);
const dir = (l) => `../../design-lab/ux02a-spacing-scale/evidence/${l}`;
let fail = 0;
for (const f of readdirSync(dir(a)).filter((f) => f.endsWith('.png')).sort()) {
  const A = PNG.sync.read(readFileSync(`${dir(a)}/${f}`));
  const B = PNG.sync.read(readFileSync(`${dir(b)}/${f}`));
  if (A.width !== B.width || A.height !== B.height) { console.log(`${f}: SIZE ${A.width}x${A.height} vs ${B.width}x${B.height}`); fail++; continue; }
  let diff = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2] || A.data[i + 3] !== B.data[i + 3]) diff++;
  }
  console.log(`${f}: ${A.width}x${A.height} differing pixels = ${diff}`);
  if (diff) fail++;
}
const RA = JSON.parse(readFileSync(`${dir(a)}/rects.json`, 'utf8'));
const RB = JSON.parse(readFileSync(`${dir(b)}/rects.json`, 'utf8'));
for (const k of Object.keys(RA).filter((k) => !k.endsWith(':meta'))) {
  const ra = RA[k], rb = RB[k];
  let moved = 0;
  if (ra.length !== rb.length) { console.log(`${k}: element count ${ra.length} vs ${rb.length}`); fail++; continue; }
  for (let i = 0; i < ra.length; i++) {
    const p = ra[i], q = rb[i];
    if (p.x !== q.x || p.y !== q.y || p.w !== q.w || p.h !== q.h) { moved++; if (moved <= 5) console.log(`  moved: ${p.cls.slice(0, 60)} ${JSON.stringify(p)} -> ${JSON.stringify(q)}`); }
  }
  console.log(`${k}: ${ra.length} boxes, moved = ${moved}`);
  if (moved) fail++;
}
console.log(fail ? `RESULT: ${fail} artefact(s) differ` : 'RESULT: zero differing pixels, zero moved boxes');
process.exit(fail ? 1 : 0);
