// QA (lens: visual review) — where the header "Map" panel (#tour-map) and the theme panel (#theme-options)
// land at phone/tablet widths: are they inside the viewport?
// Usage: cd /d/rutul-portfolio && node qa/qa-visual-mappanel.mjs [baseUrl]
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4100';
const browser = await chromium.launch({ headless: true });
const sizes = [
  ['Pixel 7', devices['Pixel 7']],
  ['iPhone 13', devices['iPhone 13']],
  ['Galaxy S9+', devices['Galaxy S9+']],
  ['360x740', { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
  ['tablet 768', { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['laptop 1024', { viewport: { width: 1024, height: 768 } }],
];
for (const [name, dev] of sizes) {
  const ctx = await browser.newContext({ ...dev });
  await ctx.addInitScript(() => localStorage.setItem('theme', 'dark'));
  const page = await ctx.newPage();
  await page.goto(BASE + '/?mode=still', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const vw = await page.evaluate(() => innerWidth);
  const map = page.locator('header nav button', { hasText: 'Map' });
  let mapRect = null;
  if (await map.isVisible()) {
    await map.click();
    await page.waitForTimeout(400);
    mapRect = await page.evaluate(() => {
      const r = document.getElementById('tour-map')?.getBoundingClientRect();
      const btn = [...document.querySelectorAll('header nav button')].find((b) => b.textContent.trim() === 'Map').getBoundingClientRect();
      const links = [...document.querySelectorAll('#tour-map a')].map((a) => Math.round(a.getBoundingClientRect().left));
      return r && { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), btnLeft: Math.round(btn.left), btnRight: Math.round(btn.right), firstLinkLeft: links[0] };
    });
    if (name === 'Pixel 7' || name === '360x740') await page.screenshot({ path: `qa/shots/qa-visual-dark-mappanel-${name.replace(/\W+/g, '')}.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  await page.click('button[aria-label^="Theme"]');
  await page.waitForTimeout(300);
  const themeRect = await page.evaluate(() => {
    const r = document.getElementById('theme-options')?.getBoundingClientRect();
    return r && { left: Math.round(r.left), right: Math.round(r.right) };
  });
  const offMap = mapRect ? Math.max(0, -mapRect.left) + Math.max(0, mapRect.right - vw) : 0;
  console.log(`${name.padEnd(12)} vw=${vw} map=${JSON.stringify(mapRect)} mapOffscreenPx=${offMap} theme=${JSON.stringify(themeRect)}`);
  await ctx.close();
}
await browser.close();
