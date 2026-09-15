// Evidence harness for the action state ladder. Run from apps/web:
//   node design-lab/action-state-evidence.mjs http://localhost:3077
// Captures the eyebrow CTA, a quiet nav link and the homepage primary action
// in every ladder state at 1280 and 390, over the dark rail and a light band,
// measures painted colours via a canvas pixel (getComputedStyle returns
// oklch() in Chromium — never trust it as RGB), and reads the rest colours of
// https://vitalcv.com read-only to prove rest is unchanged.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:3077';
const OUT = new URL('../../../design-lab/action-state-layer/evidence/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const toHex = async (page, sel, prop) =>
  page.evaluate(([sel, prop]) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = getComputedStyle(el)[prop];
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0,0,1,1);
    ctx.fillStyle = c; ctx.fillRect(0,0,1,1);
    const [r,g,b,a] = ctx.getImageData(0,0,1,1).data;
    return { raw: c, hex: '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join(''), alpha: a };
  }, [sel, prop]);

const lum = (hex) => { const ch = i => { let v = parseInt(hex.slice(1+i*2,3+i*2),16)/255; return v<=0.03928? v/12.92 : ((v+0.055)/1.055)**2.4; }; return 0.2126*ch(0)+0.7152*ch(1)+0.0722*ch(2); };
const contrast = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return ((x+0.05)/(y+0.05)).toFixed(2); };

const results = [];
const browser = await chromium.launch();

async function capture(page, tag, sel, state, w) {
  const el = page.locator(sel).first();
  const box = await el.boundingBox();
  const bg = await toHex(page, sel, 'backgroundColor');
  const fg = await toHex(page, sel, 'color');
  const outline = await page.evaluate((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineWidth : null; }, sel);
  const file = `${tag}-${state}-${w}.png`;
  if (box) {
    await page.screenshot({ path: OUT + file, clip: { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 24), width: Math.min(box.width + 48, w), height: box.height + 48 } });
  }
  results.push({ tag, state, w, sel, bg: bg?.hex, bgAlpha: bg?.alpha, fg: fg?.hex, contrast: bg && fg && bg.alpha === 255 ? contrast(fg.hex, bg.hex) : 'wash', outline, box: box && { w: Math.round(box.width), h: Math.round(box.height) }, file });
}

async function states(page, tag, sel, w) {
  // The active-state capture ends in mouse.up, which completes a click. Keep
  // the page where it is: the evidence is the paint, not the navigation.
  await page.evaluate(() => { if (!window.__noNav) { window.__noNav = true; document.addEventListener('click', (e) => e.preventDefault(), true); document.addEventListener('submit', (e) => e.preventDefault(), true); } });
  await page.mouse.move(2, 2);
  await capture(page, tag, sel, 'rest', w);
  await page.locator(sel).first().hover();
  await page.waitForTimeout(300);
  await capture(page, tag, sel, 'hover', w);
  await page.mouse.move(2, 2);
  await page.mouse.down(); await page.mouse.up();
  // keyboard focus-visible
  await page.evaluate((s) => { document.querySelector(s)?.focus({ focusVisible: true }); }, sel);
  await page.keyboard.press('Shift'); // a key event keeps :focus-visible honest
  await page.waitForTimeout(300);
  await capture(page, tag, sel, 'focus', w);
  await page.evaluate(() => document.activeElement?.blur());
  const box = await page.locator(sel).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await capture(page, tag, sel, 'active', w);
  await page.mouse.up();
  await page.mouse.move(2, 2);
  // disabled
  await page.evaluate((s) => { const e = document.querySelector(s); if (e.tagName === 'BUTTON') e.disabled = true; else e.setAttribute('aria-disabled', 'true'); }, sel);
  await page.waitForTimeout(300);
  await capture(page, tag, sel, 'disabled', w);
  await page.evaluate((s) => { const e = document.querySelector(s); if (e.tagName === 'BUTTON') e.disabled = false; else e.removeAttribute('aria-disabled'); }, sel);
}

for (const w of [1280, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => { if (/\.(js|css)(\?|$)/.test(r.url())) errors.push('chunk failed: ' + r.url()); });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}home-full-${w}.png` });
  const theme = await page.evaluate(() => document.querySelector('.vcv-eb')?.getAttribute('data-eb-theme'));
  results.push({ tag: 'home', w, ebTheme: theme });
  await states(page, `home-eb-cta-${theme}`, '.vcv-eb__cta', w);
  if (w >= 1280) await states(page, `home-eb-link-${theme}`, '.vcv-eb__link', w);
  await states(page, 'home-ezh-action', '.ezh-action', w);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  results.push({ tag: 'home-runtime', w, overflow, consoleErrors: errors.filter(e => !/127\.0\.0\.1:1|ECONNREFUSED|fetch/i.test(e)) });

  // /explore — the rail over a different register
  await page.goto(base + '/explore', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}explore-full-${w}.png` });
  const theme2 = await page.evaluate(() => document.querySelector('.vcv-eb')?.getAttribute('data-eb-theme'));
  results.push({ tag: 'explore', w, ebTheme: theme2 });
  await states(page, `explore-eb-cta-${theme2}`, '.vcv-eb__cta', w);
  // force the opposite register on the rail so both ladders are painted
  const forced = theme2 === 'light' ? 'dark' : 'light';
  await page.evaluate((t) => document.querySelector('.vcv-eb')?.setAttribute('data-eb-theme', t), forced);
  await page.waitForTimeout(400);
  await states(page, `explore-eb-cta-${forced}-forced`, '.vcv-eb__cta', w);
  if (w >= 1280) await states(page, `explore-eb-link-${forced}-forced`, '.vcv-eb__link', w);
  await ctx.close();
}

// reduced motion frame
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}home-reduced-motion-1280.png` });
  await ctx.close();
}

// production rest values, read-only
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto('https://vitalcv.com/', { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(800);
    await page.mouse.move(2, 2);
    const theme = await page.evaluate(() => document.querySelector('.vcv-eb')?.getAttribute('data-eb-theme'));
    results.push({ tag: 'PROD-rest', theme, cta: { bg: (await toHex(page, '.vcv-eb__cta', 'backgroundColor'))?.hex, fg: (await toHex(page, '.vcv-eb__cta', 'color'))?.hex }, link: { fg: (await toHex(page, '.vcv-eb__link', 'color'))?.hex }, ezh: { bg: (await toHex(page, '.ezh-action', 'backgroundColor'))?.hex, fg: (await toHex(page, '.ezh-action', 'color'))?.hex } });
    await page.screenshot({ path: `${OUT}PROD-home-rest-1280.png` });
  } catch (e) { results.push({ tag: 'PROD-rest', error: String(e).slice(0, 200) }); }
  await ctx.close();
}

await browser.close();
writeFileSync(OUT + 'measurements.json', JSON.stringify(results, null, 2));
console.table(results.filter(r => r.state).map(({ tag, state, w, bg, fg, contrast, outline, box }) => ({ tag, state, w, bg, fg, contrast, outline, box: box ? `${box.w}x${box.h}` : '' })));
console.log(JSON.stringify(results.filter(r => !r.state), null, 1));
