// QA (lens: visual review) — header crop on iPhone 13 (390px) in both themes, with the enter-3d button rect.
import { chromium, devices } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:4100';
const browser = await chromium.launch({ headless: true });
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  await page.goto(BASE + '/?mode=still', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({
    nav: document.querySelector('header nav').getBoundingClientRect().toJSON(),
    enter: document.querySelector('.enter-3d')?.getBoundingClientRect().toJSON(),
  }));
  console.log(theme, 'nav bottom', r.nav.bottom, 'enter-3d top', r.enter?.top, 'overlap px', r.enter ? (r.nav.bottom - r.enter.top).toFixed(1) : 'n/a');
  await page.screenshot({ path: `qa/shots/qa-visual-${theme}-header-390.png`, clip: { x: 0, y: 0, width: 390, height: 140 } });
  await ctx.close();
}
await browser.close();
