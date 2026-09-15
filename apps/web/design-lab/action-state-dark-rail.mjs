// Find a route whose rail is genuinely dark (data-eb-theme follows the band
// beneath) and sample rendered pixels of the CTA and a quiet link there.
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
const base = process.argv[2] ?? 'http://localhost:3077';
const OUT = new URL('../../../design-lab/action-state-layer/evidence/', import.meta.url).pathname;
const lum = (h) => { const c = i => { let v = parseInt(h.slice(1+i*2,3+i*2),16)/255; return v<=0.03928? v/12.92 : ((v+0.055)/1.055)**2.4; }; return 0.2126*c(0)+0.7152*c(1)+0.0722*c(2); };
const cr = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return ((x+0.05)/(y+0.05)).toFixed(2); };
const hex = (r,g,b) => '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const themes = {};
for (const r of ['/employers', '/verify', '/jobs', '/pilot', '/for-employers', '/onboarding', '/explore']) {
  const res = await page.goto(base + r, { waitUntil: 'networkidle' }).catch(() => null);
  await page.waitForTimeout(500);
  themes[r] = res ? `${res.status()} ${await page.evaluate(() => document.querySelector('.vcv-eb')?.getAttribute('data-eb-theme'))}` : 'nav-failed';
}
console.log(themes);
// No public route rests on a dark band today; the dark register is painted
// when the takeover is open (the rail flips to data-eb-theme=dark over the
// dark takeover panel). Open it on `/` and sample there — a real composition.
const dark = '/';
await page.goto(base + dark, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('.vcv-eb__menu-btn').click();
await page.waitForTimeout(600);
console.log('rail theme with takeover open:', await page.evaluate(() => document.querySelector('.vcv-eb')?.getAttribute('data-eb-theme')));
await page.evaluate(() => document.addEventListener('click', e => e.preventDefault(), true));
await page.screenshot({ path: `${OUT}dark-rail-${'takeover-open'}-1280.png` });
const fgHex = async (sel) => page.evaluate((s) => { const c = getComputedStyle(document.querySelector(s)).color; const cv = document.createElement('canvas'); cv.width=cv.height=1; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0,0,1,1); const d = x.getImageData(0,0,1,1).data; return '#' + [d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join(''); }, sel);
const sample = async (sel, state) => {
  const box = await page.locator(sel).first().boundingBox();
  const buf = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  const png = PNG.sync.read(buf);
  const at = (x, y) => { const i = (y * png.width + x) * 4; return hex(png.data[i], png.data[i+1], png.data[i+2]); };
  const bg = at(4, Math.round(box.height / 2));
  const fg = await fgHex(sel);
  await page.screenshot({ path: `${OUT}dark-rail-${sel.replace(/\W/g,'')}-${state}-1280.png`, clip: { x: box.x - 24, y: Math.max(0, box.y - 24), width: box.width + 48, height: box.height + 48 } });
  return { sel, state, bg, fg, contrast: cr(fg, bg) };
};
const out = [];
for (const sel of ['.vcv-eb__cta', '.vcv-eb__link']) {
  await page.mouse.move(2,2); await page.waitForTimeout(300);
  out.push(await sample(sel, 'rest'));
  await page.locator(sel).first().hover(); await page.waitForTimeout(300);
  out.push(await sample(sel, 'hover'));
  await page.mouse.down(); await page.waitForTimeout(300);
  out.push(await sample(sel, 'active'));
  await page.mouse.up(); await page.mouse.move(2,2);
  await page.evaluate((s) => document.querySelector(s).focus({ focusVisible: true }), sel); await page.keyboard.press('Shift'); await page.waitForTimeout(300);
  out.push(await sample(sel, 'focus'));
  await page.evaluate(() => document.activeElement.blur());
  await page.evaluate((s) => document.querySelector(s).setAttribute('aria-disabled','true'), sel); await page.waitForTimeout(300);
  out.push(await sample(sel, 'disabled'));
  await page.evaluate((s) => document.querySelector(s).removeAttribute('aria-disabled'), sel);
}
await browser.close();
console.log('route', dark);
console.table(out);
