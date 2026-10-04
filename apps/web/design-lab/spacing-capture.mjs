// UX-02A zero-pixel proof — capture /, /explore and the eyebrow takeover from a
// production server, plus every .ezh-* / .vcv-eb__* bounding box.
// usage: node design-lab/spacing-capture.mjs <label> [baseUrl]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const label = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:3077';
if (!label) throw new Error('label required');
const out = `../../design-lab/ux02a-spacing-scale/evidence/${label}`;
mkdirSync(out, { recursive: true });
const viewports = [[1440, 900], [768, 1024], [390, 844]];
const routes = ['/', '/explore'];
const browser = await chromium.launch();
const rects = {};
async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  // Reveal uses IntersectionObserver: walk the page so every band fires, then return to top.
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 400) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(40); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
}
async function boxes(page) {
  return page.evaluate(() => {
    const sel = '[class*="ezh-"], [class*="vcv-eb"]';
    return [...document.querySelectorAll(sel)].map((el) => {
      const r = el.getBoundingClientRect();
      return { cls: el.className.toString(), x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) };
    });
  });
}
for (const [w, h] of viewports) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  for (const route of routes) {
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await settle(page);
    const name = `${route === '/' ? 'home' : route.slice(1)}-${w}x${h}`;
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    rects[name] = await boxes(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    rects[`${name}:meta`] = { overflowPx: overflow, consoleErrors: errors.splice(0) };
  }
  await ctx.close();
}
// takeover open at 1280 and 390
for (const [w, h] of [[1280, 800], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  const trigger = page.locator('.vcv-eb__menu, [aria-controls][aria-expanded]').first();
  await trigger.click();
  await page.waitForTimeout(500);
  const name = `home-takeover-${w}`;
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  rects[name] = await boxes(page);
  await ctx.close();
}
writeFileSync(`${out}/rects.json`, JSON.stringify(rects, null, 1));
await browser.close();
console.log('captured', label, Object.keys(rects).filter((k) => !k.endsWith(':meta')));
for (const k of Object.keys(rects).filter((k) => k.endsWith(':meta'))) console.log(k, JSON.stringify(rects[k]));
