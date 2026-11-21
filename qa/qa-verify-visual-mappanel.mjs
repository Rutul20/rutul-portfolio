// QA skeptic verify (lens: visual) — does the phone header "Map" panel (#tour-map) open off the left edge?
// Usage: cd /d/rutul-portfolio && node qa/qa-verify-visual-mappanel.mjs [baseUrl]
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4100';
const browser = await chromium.launch({ headless: true });
const sizes = [
  ['Pixel7', devices['Pixel 7']],
  ['iPhone13', devices['iPhone 13']],
  ['360', { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['320', { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['768', { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }],
];
for (const theme of ['light', 'dark']) {
  for (const [name, dev] of sizes) {
    const ctx = await browser.newContext({ ...dev });
    await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
    const page = await ctx.newPage();
    await page.goto(BASE + '/?mode=still', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const btn = page.locator('button[aria-controls="tour-map"]');
    await btn.click();
    await page.waitForSelector('#tour-map');
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const nav = document.getElementById('tour-map').getBoundingClientRect();
      const b = document.querySelector('button[aria-controls="tour-map"]').getBoundingClientRect();
      const links = [...document.querySelectorAll('#tour-map a')].map((a) => {
        const r = a.getBoundingClientRect();
        // which text is actually visible: probe the hit target at x=4 (left edge of screen) and at link centre
        const cx = Math.min(Math.max((r.left + r.right) / 2, 0), vw - 1);
        const hit = document.elementFromPoint(cx, r.top + r.height / 2);
        return { text: a.textContent.trim(), left: Math.round(r.left), right: Math.round(r.right), hitInLink: !!(hit && a.contains(hit)) };
      });
      return { vw, nav: { left: Math.round(nav.left), right: Math.round(nav.right), width: Math.round(nav.width) }, btn: { left: Math.round(b.left), right: Math.round(b.right) }, links, scrollX: scrollX, docW: document.documentElement.scrollWidth };
    });
    const offLeft = Math.max(0, -info.nav.left);
    console.log(`${theme} ${name.padEnd(9)} vw=${info.vw} btn=${info.btn.left}-${info.btn.right} nav=${info.nav.left}..${info.nav.right} (w${info.nav.width}) offLeftPx=${offLeft} docW=${info.docW}`);
    console.log('   links:', info.links.map((l) => `${l.text}[${l.left}..${l.right}]`).join(' | '));
    await page.screenshot({ path: `qa/shots/qa-verify-visual-mappanel-${theme}-${name}.png` });
    await ctx.close();
  }
}
await browser.close();
