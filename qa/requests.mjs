// QA helper: what a phone downloads on first load (production build).
// Usage: node qa/requests.mjs [baseUrl] [desktop]
import { chromium, devices } from 'playwright';
import { statSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:4100';
const desktop = process.argv[3] === 'desktop';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(desktop ? { viewport: { width: 1440, height: 900 } } : { ...devices['Pixel 7'] });
const page = await ctx.newPage();
const rows = [];
page.on('response', (r) => {
  const path = new URL(r.url()).pathname;
  let size = 0;
  try { size = statSync('out' + (path.endsWith('/') ? path + 'index.html' : path)).size; } catch {}
  rows.push([r.status(), r.request().resourceType(), size, path]);
});
await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(6000);
let total = 0;
for (const [s, t, len, u] of rows) { total += len; console.log(s, t.padEnd(10), String(len).padStart(8), u); }
console.log('TOTAL bytes (uncompressed on disk)', total);
await browser.close();
