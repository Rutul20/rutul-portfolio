// Skeptic check: does the theme panel stay open after keyboard focus leaves it,
// and does it ever obscure the focused element while the user keeps tabbing?
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3100';
const OUT = 'qa/shots/theme-behaviour/verify-tabaway';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});

const cases = [
  { name: 'desktop-1440-light', theme: 'light', ctx: { viewport: { width: 1440, height: 900 } }, url: '/' , live: true },
  { name: 'desktop-1440-dark', theme: 'dark', ctx: { viewport: { width: 1440, height: 900 } }, url: '/', live: true },
  { name: 'pixel7-dark', theme: 'dark', ctx: { ...devices['Pixel 7'] }, url: '/?mode=still', live: false },
  { name: 'pixel7-light', theme: 'light', ctx: { ...devices['Pixel 7'] }, url: '/?mode=still', live: false },
];

const results = [];
for (const c of cases) {
  const context = await browser.newContext(c.ctx);
  await context.addInitScript((t) => localStorage.setItem('theme', t), c.theme);
  const page = await context.newPage();
  await page.goto(BASE + c.url, { waitUntil: 'load' });
  if (c.live) {
    await page.waitForSelector('.live.is-shown', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
  } else {
    await page.waitForTimeout(1500);
  }

  const btn = page.locator('button[aria-controls="theme-options"]');
  await btn.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  const afterOpen = await page.evaluate(() => ({
    open: !!document.getElementById('theme-options'),
    active: document.activeElement?.outerHTML.slice(0, 80),
  }));
  await page.screenshot({ path: `${OUT}/${c.name}-0-open.png` });

  // Tab once
  await page.keyboard.press('Tab');
  await page.waitForTimeout(250);
  const afterTab = await page.evaluate(() => {
    const p = document.getElementById('theme-options');
    const a = document.activeElement;
    return {
      open: !!p,
      activeInPanel: !!(p && p.contains(a)),
      active: (a?.textContent || a?.getAttribute('aria-label') || a?.tagName || '').trim().slice(0, 40),
      ariaExpanded: document.querySelector('button[aria-controls="theme-options"]')?.getAttribute('aria-expanded'),
      panelRect: p ? p.getBoundingClientRect().toJSON() : null,
    };
  });
  await page.screenshot({ path: `${OUT}/${c.name}-1-tabbed-away.png` });

  // Keep tabbing; for each focus stop check whether the panel covers it
  const obscured = [];
  let stops = 0;
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(120);
    const r = await page.evaluate(() => {
      const p = document.getElementById('theme-options');
      const a = document.activeElement;
      if (!a || a === document.body) return { none: true };
      const ar = a.getBoundingClientRect();
      const label = (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().replace(/\s+/g, ' ').slice(0, 50);
      if (!p) return { label, panelOpen: false };
      const pr = p.getBoundingClientRect();
      const ix = Math.max(0, Math.min(ar.right, pr.right) - Math.max(ar.left, pr.left));
      const iy = Math.max(0, Math.min(ar.bottom, pr.bottom) - Math.max(ar.top, pr.top));
      const area = ar.width * ar.height || 1;
      const frac = (ix * iy) / area;
      // is the centre of the focused element painted by the panel?
      const cx = ar.left + ar.width / 2, cy = ar.top + ar.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const centreCovered = !!(top && p.contains(top));
      return { label, panelOpen: true, frac: +frac.toFixed(3), centreCovered, rect: [ar.left, ar.top, ar.width, ar.height].map(Math.round) };
    });
    stops++;
    if (r.frac > 0) {
      obscured.push({ step: i + 2, ...r });
      if (obscured.length <= 3) await page.screenshot({ path: `${OUT}/${c.name}-obscured-step${i + 2}.png` });
    }
  }
  const stillOpenAtEnd = await page.evaluate(() => !!document.getElementById('theme-options'));
  await page.screenshot({ path: `${OUT}/${c.name}-2-after-${stops}-tabs.png` });

  results.push({ case: c.name, afterOpen, afterTab, stillOpenAtEnd, obscuredCount: obscured.length, obscured: obscured.slice(0, 10) });
  await context.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
