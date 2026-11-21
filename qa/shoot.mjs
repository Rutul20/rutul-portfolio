// QA helper: screenshots every stop of the live 3D tour on the real GPU.
// Usage: node qa/shoot.mjs [baseUrl] [width] [height] [mode=live|still]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3100';
const width = +(process.argv[3] || 1440);
const height = +(process.argv[4] || 900);
const mode = process.argv[5] || 'live';
const out = 'qa/shots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height } });
const problems = [];
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`${m.type()}: ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

await page.goto(`${base}/?mode=${mode}`, { waitUntil: 'networkidle' });
if (mode === 'live') {
  try {
    await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  } catch (e) {
    console.log([...new Set(problems)].join('\n'));
    throw e;
  }
}
await page.waitForTimeout(1200);

const ids = await page.$$eval('[data-stop]', (els) => els.map((e) => e.id));
for (const [i, id] of ids.entries()) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: 'instant', block: 'start' }), id);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/${mode}-${width}x${height}-${i}-${id}.png` });
}
console.log('stops:', ids.join(', '));
console.log(problems.length ? [...new Set(problems)].join('\n') : 'no console errors');
await browser.close();
