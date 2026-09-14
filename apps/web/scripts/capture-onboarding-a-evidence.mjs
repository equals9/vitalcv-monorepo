/**
 * capture-onboarding-a-evidence.mjs — founder-visual-gate evidence for the
 * /onboarding Direction A register pass.
 *
 * Usage:  node scripts/capture-onboarding-a-evidence.mjs <label> <baseURL> <outDir>
 *         label = before | after
 *
 * Runs against a LOCAL PRODUCTION `next start` server. Every network read the
 * flow makes is stubbed in the browser context with SYNTHETIC fixtures.
 *
 * FIXTURE NPI: 1558395518 — CHECK-DIGIT-INVALID BY DESIGN (the sanctioned
 * 15583955xx synthetic family; NPPES result_count 0, verified 2026-08-16).
 * Real-format NPIs name real people, and committed pixels/video cannot be
 * re-verified by grep, so committed artifacts may never carry a
 * checksum-valid NPI — every checksum-valid member of the sanctioned family
 * is a REAL registrant (each probed result_count 1, 2026-08-16). Ruling
 * 2026-08-16: the guest-resolve scenario is therefore captured at its
 * CHECKSUM-ERROR state — the client Luhn gate (lib/vital/npi.ts) rejecting
 * the invalid number, a real register state the evidence set should carry
 * anyway — and the resolved-record composition is deliberately NOT committed;
 * it is reviewed live against the local production build. "Ada Rivers" is a
 * fabricated name bound only to this invalid number.
 *
 * Captures, per scenario: 1440x900 · 1280x800 · 390x844 (+ 768x1024,
 * reduced-motion, 200%-zoom-equivalent and focus shots on the "after" run),
 * a runtime report (console errors, page errors, horizontal-overflow
 * measurement incl. the per-element right-edge sweep for the 1fr/min-content
 * trap, action target sizes, and canvas-measured contrast of the key painted
 * pairs), and desktop/mobile/reduced-motion recordings of the entry →
 * checksum-error interaction.
 */

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , label, baseURL, outDir] = process.argv;
if (!label || !baseURL || !outDir) {
  console.error('usage: node scripts/capture-onboarding-a-evidence.mjs <label> <baseURL> <outDir>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

// Check-digit-INVALID by design (sanctioned 15583955xx synthetic family) —
// it can never name a real person. See the header note; do not "fix" it to a
// checksum-valid value: those are real registrants.
const NPI = '1558395518';
const BOOTSTRAP_FIXTURE = {
  npi: NPI,
  npiType: 'TYPE_1',
  identitySource: 'NPPES_API',
  firstName: 'Ada',
  lastName: 'Rivers',
  specialty: 'Family Medicine',
  state: 'OR',
  inferredPersona: 'CLINICIAN',
  alreadyRegistered: false,
};

const report = {
  label,
  baseURL,
  capturedAt: new Date().toISOString(),
  fixtures:
    'synthetic only — NPI 1558395518 (check-digit-invalid by design, sanctioned synthetic family) / fabricated name Ada Rivers; all network stubbed',
  consoleErrors: [],
  pageErrors: [],
  scenarios: {},
};

/** Stub every API the flow touches. */
async function stubRoutes(context, { activateDelayMs = 0, activateStatus = 200 } = {}) {
  await context.route('**/api/me/workspaces**', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await context.route(`**/api/identity/bootstrap/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(BOOTSTRAP_FIXTURE),
    }),
  );
  await context.route('**/api/trust-state/**', (route) => route.fulfill({ status: 503, body: '' }));
  await context.route('**/api/credentials/ingest-npi**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await context.route('**/api/clinician/activate**', async (route) => {
    if (activateDelayMs) await new Promise((r) => setTimeout(r, activateDelayMs));
    route.fulfill({
      status: activateStatus,
      contentType: 'application/json',
      body:
        activateStatus === 200
          ? JSON.stringify({ readinessScore: 62, readinessLevel: 'L2', readinessStatus: 'in_progress' })
          : JSON.stringify({ error: 'Synthetic activation failure for the error-state capture.' }),
    });
  });
  await context.route('**/api/pilot-ops/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await context.route('**/api/analytics/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await context.route('**/api/opportunities**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ opportunities: [], total: 0 }),
    }),
  );
}

function watchPage(page, scenario) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push({ scenario, text: msg.text().slice(0, 400) });
  });
  page.on('pageerror', (err) => report.pageErrors.push({ scenario, text: String(err).slice(0, 400) }));
}

/** In-page: overflow + target + contrast measurement. */
async function measure(page) {
  return page.evaluate(() => {
    // canvas-normalise any CSS colour (Chromium returns oklch(...) from
    // getComputedStyle) into [r,g,b,a] by actually painting a pixel.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const toRgb = (css) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css; // invalid values keep previous — acceptable for a report
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const lum = ([r, g, b]) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const over = ([r, g, b, a], [br, bg, bb]) => {
      const k = a / 255;
      return [r * k + br * (1 - k), g * k + bg * (1 - k), b * k + bb * (1 - k)];
    };
    const bgOf = (el) => {
      let node = el;
      let acc = [255, 255, 255];
      const chain = [];
      while (node && node !== document.documentElement) {
        chain.push(node);
        node = node.parentElement;
      }
      for (const n of chain.reverse ? chain.slice().reverse() : chain) {
        const c = toRgb(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) acc = over(c, acc);
      }
      return acc;
    };
    const ratio = (fgCss, bgRgb) => {
      const fg = over(toRgb(fgCss), bgRgb);
      const l1 = lum(fg);
      const l2 = lum(bgRgb);
      const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };

    const probe = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const bg = bgOf(el);
      const r = el.getBoundingClientRect();
      return {
        selector: sel,
        color: cs.color,
        contrast: ratio(cs.color, bg),
        rect: { w: Math.round(r.width), h: Math.round(r.height) },
      };
    };

    // per-element right-edge sweep: the 1fr/min-content trap hides behind
    // ancestors that clip overflow-x, so measure element edges directly.
    let maxRight = 0;
    let worst = null;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > maxRight) {
        maxRight = r.right;
        worst = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}`;
      }
    }

    const targets = [];
    for (const el of document.querySelectorAll('a, button, input, [role="button"]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      targets.push({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || el.getAttribute('aria-label') || el.id || '').trim().slice(0, 40),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }

    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      maxElementRight: Math.round(maxRight),
      widestElement: worst,
      probes: [
        probe('h1'),
        probe('.oba-lede'),
        probe('.oba-k'),
        probe('.oba-data'),
        probe('.oba-action'),
        probe('.oba-ghost'),
        probe('.oba-quiet'),
        probe('.oba-err'),
        probe('main h1'),
        probe('p'),
      ].filter(Boolean),
      subFloorTargets: targets.filter((t) => t.h < 44 || t.w < 44),
      targetCount: targets.length,
    };
  });
}

async function shot(page, file, { fullPage = true } = {}) {
  await page.screenshot({ path: join(outDir, file), fullPage });
}

const browser = await chromium.launch();

async function scenarioPage(opts = {}, routeOpts = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...opts,
  });
  await stubRoutes(context, routeOpts);
  const page = await context.newPage();
  return { context, page };
}

const VIEWPORTS = [
  ['1440x900', { width: 1440, height: 900 }],
  ['1280x800', { width: 1280, height: 800 }],
  ['390x844', { width: 390, height: 844 }],
];

/* ── 1. /onboarding — guest entry ──────────────────────────────────────── */
{
  const { context, page } = await scenarioPage();
  watchPage(page, 'entry');
  await page.goto(`${baseURL}/onboarding`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#guest-npi-input', { timeout: 15000 });
  for (const [name, vp] of VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(350);
    await shot(page, `${label}-entry-${name}.png`);
    report.scenarios[`entry-${name}`] = await measure(page);
  }
  if (label === 'after') {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(350);
    await shot(page, `${label}-entry-768x1024.png`);
    report.scenarios['entry-768x1024'] = await measure(page);
    // 200% zoom equivalent: 720 logical px of a 1440 canvas.
    await page.setViewportSize({ width: 720, height: 450 });
    await page.waitForTimeout(350);
    await shot(page, `${label}-entry-200pct-zoom-of-1440.png`);
    // focus-visible on the primary action
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(350);
    await page.focus('#guest-npi-input');
    await page.keyboard.press('Tab'); // to the submit action
    await shot(page, `${label}-entry-1440-focus-action.png`, { fullPage: false });
  }
  await context.close();
}

/* ── 1b. reduced motion (entry) ────────────────────────────────────────── */
{
  const { context, page } = await scenarioPage({ reducedMotion: 'reduce' });
  watchPage(page, 'entry-reduced');
  await page.goto(`${baseURL}/onboarding`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#guest-npi-input', { timeout: 15000 });
  await shot(page, `${label}-entry-1440x900-reduced-motion.png`);
  report.scenarios['entry-reduced'] = await measure(page);
  await context.close();
}

/* ── 2. /onboarding?npi= — the checksum-error state ────────────────────────
 * The ?npi= carrier shape-passes ten digits; resolveGuest then rejects the
 * check-digit-invalid fixture at the client Luhn gate BEFORE any network
 * call. That rejection is the state under capture — Direction A rendering an
 * input error honestly (glyph-free, word-carried, role=alert). The resolved
 * record is deliberately not captured: it would require a checksum-valid
 * NPI, and committed artifacts may not carry one. */
{
  const { context, page } = await scenarioPage();
  watchPage(page, 'checksum-error');
  await page.goto(`${baseURL}/onboarding?npi=${NPI}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#guest-npi-error', { timeout: 15000 });
  for (const [name, vp] of VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(350);
    await shot(page, `${label}-checksum-error-${name}.png`);
    report.scenarios[`checksum-error-${name}`] = await measure(page);
  }
  await context.close();
}

/* ── 3. /onboarding/fetching — the hand-off beat ───────────────────────── */
{
  const { context, page } = await scenarioPage();
  watchPage(page, 'fetching');
  await context.addInitScript(([npi]) => {
    window.sessionStorage.setItem('onboarding_npi', npi);
  }, [NPI]);
  await page.goto(`${baseURL}/onboarding/fetching`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(650); // inside the paced sequence, before auto-advance
  for (const [name, vp] of [['1440x900', { width: 1440, height: 900 }], ['390x844', { width: 390, height: 844 }]]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(120);
    await shot(page, `${label}-fetching-${name}.png`);
    report.scenarios[`fetching-${name}`] = await measure(page);
  }
  await context.close();
}

if (label === 'after') {
  const { context, page } = await scenarioPage({ reducedMotion: 'reduce' });
  watchPage(page, 'fetching-reduced');
  await context.addInitScript(([npi]) => {
    window.sessionStorage.setItem('onboarding_npi', npi);
  }, [NPI]);
  await page.goto(`${baseURL}/onboarding/fetching`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(650);
  await shot(page, `${label}-fetching-1440x900-reduced-motion.png`);
  await context.close();
}

/* ── 4. /onboarding/identity — resolved provider review ────────────────── */
{
  const { context, page } = await scenarioPage();
  watchPage(page, 'identity');
  await context.addInitScript(([npi, boot]) => {
    window.sessionStorage.setItem('onboarding_npi', npi);
    window.sessionStorage.setItem('onboarding_bootstrap', boot);
  }, [NPI, JSON.stringify(BOOTSTRAP_FIXTURE)]);
  await page.goto(`${baseURL}/onboarding/identity`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Resolved provider', { timeout: 15000 });
  for (const [name, vp] of VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(350);
    await shot(page, `${label}-identity-${name}.png`);
    report.scenarios[`identity-${name}`] = await measure(page);
  }
  await context.close();
}

/* ── 5. /onboarding/readiness — the paced activation + completed state ─── */
{
  const { context, page } = await scenarioPage({}, { activateDelayMs: 2500 });
  watchPage(page, 'readiness');
  await context.addInitScript(([npi, boot]) => {
    window.sessionStorage.setItem('onboarding_npi', npi);
    window.sessionStorage.setItem('onboarding_bootstrap', boot);
  }, [NPI, JSON.stringify(BOOTSTRAP_FIXTURE)]);
  await page.goto(`${baseURL}/onboarding/readiness`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700); // the paced resolver is on screen
  for (const [name, vp] of [['1440x900', { width: 1440, height: 900 }], ['390x844', { width: 390, height: 844 }]]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(120);
    await shot(page, `${label}-readiness-${name}.png`);
    report.scenarios[`readiness-${name}`] = await measure(page);
  }
  // completed state (900ms window before the router replaces)
  await page.setViewportSize({ width: 1440, height: 900 });
  try {
    await page.waitForSelector('text=ready to keep going', { timeout: 10000 });
    await shot(page, `${label}-readiness-completed-1440x900.png`);
    report.scenarios['readiness-completed'] = await measure(page);
  } catch {
    report.scenarios['readiness-completed'] = 'not captured (redirect won the race)';
  }
  await context.close();
}

/* ── 5b. readiness error state (after only) ────────────────────────────── */
if (label === 'after') {
  const { context, page } = await scenarioPage({}, { activateStatus: 500 });
  watchPage(page, 'readiness-error');
  await context.addInitScript(([npi, boot]) => {
    window.sessionStorage.setItem('onboarding_npi', npi);
    window.sessionStorage.setItem('onboarding_bootstrap', boot);
  }, [NPI, JSON.stringify(BOOTSTRAP_FIXTURE)]);
  await page.goto(`${baseURL}/onboarding/readiness`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Activation paused', { timeout: 15000 });
  await shot(page, `${label}-readiness-error-1440x900.png`);
  report.scenarios['readiness-error'] = await measure(page);
  await context.close();
}

/* ── 6. motion recordings: entry → checksum-error (after only) ─────────────
 * The choreography types the invalid fixture and submits; the recording ends
 * on the Luhn gate's rejection. No checksum-valid NPI is ever typed on
 * camera — the resolved-record motion is reviewed live instead. */
if (label === 'after') {
  for (const [name, opts] of [
    ['desktop', { viewport: { width: 1440, height: 900 } }],
    ['mobile', { viewport: { width: 390, height: 844 } }],
    ['reduced', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }],
  ]) {
    const context = await browser.newContext({
      ...opts,
      recordVideo: { dir: outDir, size: opts.viewport },
    });
    await stubRoutes(context);
    const page = await context.newPage();
    await page.goto(`${baseURL}/onboarding`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#guest-npi-input', { timeout: 15000 });
    await page.click('#guest-npi-input');
    await page.keyboard.type(NPI, { delay: 90 });
    await page.click('button[type="submit"]');
    await page.waitForSelector('#guest-npi-error', { timeout: 15000 });
    await page.waitForTimeout(1200);
    const video = page.video();
    await context.close();
    if (video) {
      const p = await video.path();
      const { renameSync } = await import('node:fs');
      renameSync(p, join(outDir, `${label}-motion-${name}.webm`));
    }
  }
}

await browser.close();
writeFileSync(join(outDir, `${label}-runtime-report.json`), JSON.stringify(report, null, 2));
console.log(`done — ${label} evidence in ${outDir}`);
console.log(`console errors: ${report.consoleErrors.length}, page errors: ${report.pageErrors.length}`);
