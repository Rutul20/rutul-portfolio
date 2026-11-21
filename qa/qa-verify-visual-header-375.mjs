// QA verify (lens: visual) — true 375px width (iPhone X/11 Pro/12 mini) header measurement, both themes.
import { chromium, devices } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:4100';
const browser = await chromium.launch({ headless: true });
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...devices['iPhone 12 Mini'] });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  await page.goto(BASE + '/?mode=still', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const nav = document.querySelector('header nav').getBoundingClientRect();
    const res = [...document.querySelectorAll('header nav a')].find((a) => /sum/.test(a.textContent)).getBoundingClientRect();
    const en = document.querySelector('.enter-3d').getBoundingClientRect();
    return { vw: innerWidth, navH: nav.height, navRight: nav.right, navBottom: nav.bottom, resumeH: res.height, enterTop: en.top, overlap: nav.bottom - en.top };
  });
  console.log(theme, JSON.stringify(r));
  await page.screenshot({ path: `qa/shots/qa-verify-visual-header-${theme}-375.png`, clip: { x: 0, y: 0, width: 375, height: 150 } });
  await ctx.close();
}
await browser.close();
