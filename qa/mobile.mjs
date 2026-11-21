// QA helper: the phone experience (pictures, no WebGL download), every stop.
// Usage: node qa/mobile.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3100';
mkdirSync('qa/shots', { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
const problems = [];
const scripts = [];
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`${m.type()}: ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const ids = await page.$$eval('[data-stop]', (els) => els.map((e) => e.id));
for (const [i, id] of ids.entries()) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: 'instant', block: 'start' }), id);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `qa/shots/mobile-${i}-${id}.png` });
}
const live = await page.$('.live');
console.log('live canvas on phone:', !!live);
console.log('3D chunks requested:', scripts.filter((s) => /three|fiber|LiveCity/i.test(s)).map((s) => s.split('/').pop()));
console.log('enter-3d button:', !!(await page.$('.enter-3d')));
console.log(problems.length ? [...new Set(problems)].join('\n') : 'no console errors');
await browser.close();
