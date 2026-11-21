// Skeptic check, settled version: wait for smooth scroll to finish after each Tab
// before measuring whether the still-open theme panel covers the focused element.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3100';
const OUT = 'qa/shots/theme-behaviour/verify-tabaway';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

const out = [];
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  await context.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await context.newPage();
  await page.goto(BASE + '/?mode=still', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.locator('button[aria-controls="theme-options"]').focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  for (let i = 1; i <= 24; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => {
      const p = document.getElementById('theme-options');
      const a = document.activeElement;
      const ar = a.getBoundingClientRect();
      const label = (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
      const vv = window.visualViewport;
      const res = { label, inPanel: !!(p && p.contains(a)), panelOpen: !!p, scrollY: Math.round(scrollY), vvTop: vv ? Math.round(vv.offsetTop) : null };
      if (!p) return res;
      const pr = p.getBoundingClientRect();
      const ix = Math.max(0, Math.min(ar.right, pr.right) - Math.max(ar.left, pr.left));
      const iy = Math.max(0, Math.min(ar.bottom, pr.bottom) - Math.max(ar.top, pr.top));
      res.frac = +((ix * iy) / (ar.width * ar.height || 1)).toFixed(3);
      res.panel = [pr.top, pr.bottom].map(Math.round);
      res.el = [ar.left, ar.top, ar.width, ar.height].map(Math.round);
      const top = document.elementFromPoint(ar.left + ar.width / 2, ar.top + ar.height / 2);
      res.centreCovered = !!(top && p.contains(top));
      // does the panel overlap any visible text of page content?
      return res;
    });
    r.step = i;
    out.push({ theme, ...r });
    if (r.frac > 0 && !r.inPanel) await page.screenshot({ path: `${OUT}/settled-pixel7-${theme}-step${i}.png` });
    if (i === 6) await page.screenshot({ path: `${OUT}/settled-pixel7-${theme}-step6.png` });
  }
  await context.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/settled-results.json`, JSON.stringify(out, null, 2));
for (const r of out) console.log(JSON.stringify(r));
