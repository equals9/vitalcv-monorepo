// Samples RENDERED pixels of the quiet nav link in each state — the wash is
// an alpha color-mix, so getComputedStyle cannot say what it paints over the
// frosted rail. Run from apps/web with the production server up.
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
const base = process.argv[2] ?? 'http://localhost:3077';
const lum = (h) => { const c = i => { let v = parseInt(h.slice(1+i*2,3+i*2),16)/255; return v<=0.03928? v/12.92 : ((v+0.055)/1.055)**2.4; }; return 0.2126*c(0)+0.7152*c(1)+0.0722*c(2); };
const cr = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return ((x+0.05)/(y+0.05)).toFixed(2); };
const hex = (r,g,b) => '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => document.addEventListener('click', e => e.preventDefault(), true));
const sel = '.vcv-eb__link';
const fgHex = async () => page.evaluate((s) => { const c = getComputedStyle(document.querySelector(s)).color; const cv = document.createElement('canvas'); cv.width=cv.height=1; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0,0,1,1); const d = x.getImageData(0,0,1,1).data; return '#' + [d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join(''); }, sel);
const sample = async (state) => {
  const box = await page.locator(sel).first().boundingBox();
  const buf = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  const png = PNG.sync.read(buf);
  const at = (x, y) => { const i = (y * png.width + x) * 4; return hex(png.data[i], png.data[i+1], png.data[i+2]); };
  const bg = at(4, Math.round(box.height / 2)); // inside the left padding, no glyph
  const fg = await fgHex();
  return { state, bg, fg, contrast: cr(fg, bg) };
};
const out = [];
for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => document.querySelector('.vcv-eb').setAttribute('data-eb-theme', t), theme);
  await page.waitForTimeout(400);
  await page.mouse.move(2,2); await page.waitForTimeout(300);
  out.push({ theme, ...(await sample('rest')) });
  await page.locator(sel).first().hover(); await page.waitForTimeout(300);
  out.push({ theme, ...(await sample('hover')) });
  await page.mouse.down(); await page.waitForTimeout(300);
  out.push({ theme, ...(await sample('active')) });
  await page.mouse.up(); await page.mouse.move(2,2);
  await page.evaluate((s) => document.querySelector(s).focus({ focusVisible: true }), sel); await page.keyboard.press('Shift'); await page.waitForTimeout(300);
  out.push({ theme, ...(await sample('focus')) });
  await page.evaluate(() => document.activeElement.blur());
  await page.evaluate((s) => document.querySelector(s).setAttribute('aria-disabled','true'), sel); await page.waitForTimeout(300);
  out.push({ theme, ...(await sample('disabled')) });
  await page.evaluate((s) => document.querySelector(s).removeAttribute('aria-disabled'), sel);
}
await browser.close();
console.table(out);
