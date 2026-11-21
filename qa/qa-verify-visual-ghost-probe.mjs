import { chromium, devices } from 'playwright';
const browser = await chromium.launch({ headless: true });
for (const opts of [{ ...devices['Pixel 7'] }, { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]) {
const ctx = await browser.newContext({ ...opts, colorScheme: 'dark' });
await ctx.addInitScript((t) => localStorage.setItem('theme', t), 'dark');
const page = await ctx.newPage();
await page.goto('http://localhost:4100/?mode=still', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
console.log(await page.locator('button[aria-controls="tour-map"]').count());
await page.locator('button[aria-controls="tour-map"]').click();
await page.waitForTimeout(500);
console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#tour-map')].map(e => ({r: e.getBoundingClientRect().toJSON(), bg: getComputedStyle(e).backgroundColor})))));
await ctx.close();
}
await browser.close();
