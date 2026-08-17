// Cursor-field wave capture — two subjects:
//  1. the design-lab exhibit (static, file:// URL)
//  2. the homepage read-settle beat (needs the worktree dev server on :3105)
// Run from the repo root: node design-lab/cursor-field/capture.mjs
// Evidence lands in design-lab/cursor-field/evidence/ and IS committed on this
// branch (deviating from the register board's untracked convention on purpose:
// the founder visual gate wants the PR to carry its own rendered evidence).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(HERE, '../../apps/web/package.json'));
const { chromium } = require('@playwright/test');

const EXHIBIT = pathToFileURL(join(HERE, 'index.html')).href;
const HOME = process.env.BEAT_URL || 'http://localhost:3105/';
const OUT = join(HERE, 'evidence');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shoot(name, ctxOpts, run) {
  const ctx = await browser.newContext({ deviceScaleFactor: 2, ...ctxOpts });
  const page = await ctx.newPage();
  await run(page);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  await ctx.close();
  console.log('wrote', name);
}

/* ── 1 · the exhibit ────────────────────────────────────────────────────── */

async function exhibit(page, { mode = 'scene', settle = 2500, ring } = {}) {
  await page.goto(EXHIBIT);
  await page.evaluate(() => document.fonts.ready);
  if (mode !== 'scene') await page.click(`[data-mode-btn="${mode}"]`);
  if (ring) await page.mouse.move(ring[0], ring[1]);
  await page.waitForTimeout(settle); // let the sim excite and settle
}

await shoot('exhibit-scene-1440', { viewport: { width: 1440, height: 900 } }, (p) =>
  exhibit(p, { ring: [640, 520] }));
await shoot('exhibit-paper-1440', { viewport: { width: 1440, height: 900 } }, (p) =>
  exhibit(p, { mode: 'paper', ring: [820, 430] }));
await shoot('exhibit-scene-390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, (p) =>
  exhibit(p, {}));
await shoot('exhibit-reduced-motion-1440', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, (p) =>
  exhibit(p, { settle: 1200 }));

/* ── 2 · the homepage read-settle beat ──────────────────────────────────── */

async function driveSubmit(page) {
  await page.goto(HOME);
  await page.evaluate(() => document.fonts.ready);
  await page.fill('#ezh-npi', '1234567893'); // NPPES documentation example NPI
  await page.click('.ezh-npi-submit');
  await page.waitForSelector('.ezh-rv-step', { timeout: 8000 });
}

// mid-flight: freeze the newest read-settle at its indigo peak so the 220ms
// beat is capturable; this pauses the REAL animation the class change started.
await shoot('home-beat-midflight-1440', { viewport: { width: 1440, height: 900 } }, async (p) => {
  await driveSubmit(p);
  await p.waitForSelector('.ezh-rv-step.is-read', { timeout: 8000 });
  await p.evaluate(() => {
    const reads = [...document.querySelectorAll('.ezh-rv-step.is-read')];
    const newest = reads[reads.length - 1];
    for (const a of document.getAnimations()) {
      if (!a.animationName?.startsWith('ezh-read-settle')) continue;
      const el = a.effect.target;
      if (newest === el || newest.contains(el)) { a.pause(); a.currentTime = 30; }
    }
    document.querySelector('.ezh-rv-narration')?.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await p.waitForTimeout(120);
});

await shoot('home-beat-midflight-390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async (p) => {
  await driveSubmit(p);
  await p.waitForSelector('.ezh-rv-step.is-read', { timeout: 8000 });
  await p.evaluate(() => {
    const reads = [...document.querySelectorAll('.ezh-rv-step.is-read')];
    const newest = reads[reads.length - 1];
    for (const a of document.getAnimations()) {
      if (!a.animationName?.startsWith('ezh-read-settle')) continue;
      const el = a.effect.target;
      if (newest === el || newest.contains(el)) { a.pause(); a.currentTime = 30; }
    }
    document.querySelector('.ezh-rv-narration')?.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await p.waitForTimeout(120);
});

// reduced motion: the route kill switch means the narration settles with zero
// animation — the "before"-equivalent resting frame, which is also the after.
await shoot('home-beat-reduced-motion-1440', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, async (p) => {
  await driveSubmit(p);
  await p.waitForTimeout(600);
  await p.evaluate(() =>
    document.querySelector('.ezh-rv-narration, .ezh-result')?.scrollIntoView({ behavior: 'instant', block: 'center' }));
  await p.waitForTimeout(120);
});

await browser.close();
console.log('done');
