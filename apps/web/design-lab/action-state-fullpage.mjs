import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:3077';
const OUT = new URL('../../../design-lab/action-state-layer/evidence/', import.meta.url).pathname;
const browser = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844], [768, 1024]]) {
  for (const route of ['/', '/explore']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(base + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const name = route === '/' ? 'home' : 'explore';
    await page.screenshot({ path: `${OUT}final-${name}-${w}x${h}.png` });
    // keyboard path: Tab to the rail CTA and shoot the ring
    if (route === '/') {
      await page.keyboard.press('Tab');
      for (let i = 0; i < 8; i++) { const cls = await page.evaluate(() => document.activeElement?.className || ''); if (cls.includes('vcv-eb__cta')) break; await page.keyboard.press('Tab'); }
      const cls = await page.evaluate(() => document.activeElement?.className || '');
      await page.screenshot({ path: `${OUT}final-home-keyboard-focus-${w}x${h}.png` });
      console.log(w, h, name, 'overflow', overflow, 'focused', cls);
    } else console.log(w, h, name, 'overflow', overflow);
    await ctx.close();
  }
}
await browser.close();
