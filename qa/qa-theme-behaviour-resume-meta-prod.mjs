// QA (theme behaviour lens): theme-color meta on /resume/ in dark, production build.
import { chromium, devices } from 'playwright';
const base = process.argv[2] || 'http://localhost:4100';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
await ctx.addInitScript(() => localStorage.setItem('theme', 'dark'));
const page = await ctx.newPage();
await page.goto(base + '/resume/', { waitUntil: 'load' });
await page.waitForTimeout(5000);
console.log(await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, meta: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content + (m.media ? ' ' + m.media : '')), bg: getComputedStyle(document.querySelector('.resume-page')).backgroundColor })));
// navigate client-side back to / and forward again
await page.getByRole('link', { name: /Back to the city/ }).click();
await page.waitForURL(base + '/');
await page.waitForTimeout(1500);
const onHome = await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.content);
await page.getByLabel('Site').getByRole('link', { name: 'Résumé view' }).click();
await page.waitForURL('**/resume/');
await page.waitForTimeout(1500);
const back = await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.content);
console.log({ onHomeAfterClientNav: onHome, resumeAfterClientNav: back });
await browser.close();
