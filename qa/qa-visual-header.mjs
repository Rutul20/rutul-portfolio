// QA (lens: visual review) — does the phone header (brand pill + nav pill) fit at narrow widths?
// Usage: cd /d/rutul-portfolio && node qa/qa-visual-header.mjs [baseUrl]
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:4100';
const browser = await chromium.launch({ headless: true });
for (const w of [320, 360, 375, 390, 412]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?mode=still', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const nav = document.querySelector('header nav').getBoundingClientRect();
    const items = [...document.querySelectorAll('header nav > *')].map((el) => {
      const b = el.getBoundingClientRect();
      return `${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 12) || el.tagName}:${Math.round(b.left)}-${Math.round(b.right)}h${Math.round(b.height)}`;
    });
    return { vw: innerWidth, docW: document.documentElement.scrollWidth, navLeft: Math.round(nav.left), navRight: Math.round(nav.right), navH: Math.round(nav.height), items };
  });
  console.log(w, JSON.stringify(r));
  if (w === 360 || w === 320) await page.screenshot({ path: `qa/shots/qa-visual-light-header-${w}.png`, clip: { x: 0, y: 0, width: w, height: 120 } });
  await ctx.close();
}
await browser.close();
