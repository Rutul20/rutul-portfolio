// QA verify (lens: visual) — does the VADODARA station board read mirrored from the #client-work camera?
// Usage: node qa/qa-verify-visual-station-sign.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:3100';
fs.mkdirSync('qa/shots', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sections = ['client-work', 'workshop', 'education', 'contact'];
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  const shown = await page.waitForSelector('.live.is-shown', { timeout: 30000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(1500);
  console.log(theme, 'live shown:', shown, 'stage:', await page.evaluate(() => document.documentElement.dataset.stage || null));
  await page.evaluate(() => document.documentElement.classList.add('stops-laid-out'));
  await page.waitForTimeout(300);
  for (const id of sections) {
    await page.evaluate((s) => document.getElementById(s).scrollIntoView({ behavior: 'instant', block: 'start' }), id);
    await page.waitForTimeout(3500); // let the camera fly and settle
    const file = `qa/shots/qa-verify-visual-station-sign-${theme}-${id}.png`;
    await page.screenshot({ path: file });
    console.log('saved', file);
  }
  await ctx.close();
}
await browser.close();
