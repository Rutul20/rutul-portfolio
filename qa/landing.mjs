// QA helper: screenshots of the Earth → city landing at several scroll points.
// Usage: node qa/landing.mjs [baseUrl] [width] [height] [mode=live|still]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3100';
const width = +(process.argv[3] || 1440);
const height = +(process.argv[4] || 900);
const mode = process.argv[5] || 'live';
mkdirSync('qa/shots', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1 });
const problems = [];
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/THREE.Clock/.test(m.text()) && problems.push(m.text().slice(0, 200)));
page.on('pageerror', (e) => problems.push(e.message));
await page.goto(`${base}/?mode=${mode}`, { waitUntil: 'networkidle' });
if (mode === 'live') await page.waitForSelector('.live.is-shown', { timeout: 30000 });
await page.waitForTimeout(1500);
const range = await page.evaluate(() => document.getElementById('city').offsetHeight - innerHeight);
for (const f of [0, 0.2, 0.4, 0.55, 0.65, 0.72, 0.78, 0.84, 0.88, 0.92, 0.96, 1]) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(range * f));
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `qa/shots/landing-${mode}-${width}-${String(Math.round(f * 100)).padStart(3, '0')}.png` });
}
console.log('hero dive range px:', range);
console.log(problems.length ? [...new Set(problems)].join('\n') : 'no console errors');
await browser.close();
