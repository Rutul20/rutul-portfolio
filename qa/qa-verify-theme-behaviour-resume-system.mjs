// Skeptic check: with theme='system', does /resume/ follow an OS light->dark change live (like '/' does)?
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'qa/shots/theme-behaviour';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4100';

const state = (page) =>
  page.evaluate(() => {
    const r = document.documentElement;
    const rp = document.querySelector('.resume-page');
    return {
      theme: r.dataset.theme,
      pref: r.dataset.themePref,
      osDark: matchMedia('(prefers-color-scheme: dark)').matches,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      resumeBg: rp ? getComputedStyle(rp).backgroundColor : null,
      meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
      path: location.pathname,
    };
  });

const browser = await chromium.launch({ headless: true });
const results = {};

async function run(name, startUrl, navigate) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  await ctx.addInitScript(() => localStorage.setItem('theme', 'system'));
  const page = await ctx.newPage();
  await page.goto(BASE + startUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  if (navigate) await navigate(page);
  const before = await state(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(700);
  const afterDark = await state(page);
  await page.screenshot({ path: `${OUT}/qa-verify-${name}-after-os-dark.png` });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(500);
  const afterLight = await state(page);
  results[name] = { before, afterDark, afterLight };
  await ctx.close();
}

await run('home', '/');
await run('resume-direct', '/resume/');
await run('resume-clientnav', '/', async (page) => {
  const link = page.locator('a[href^="/resume"]').first();
  await link.evaluate((a) => a.click());
  await page.waitForURL('**/resume/**', { timeout: 10000 });
  await page.waitForTimeout(1000);
});
// sanity: does reload on /resume/ after OS change pick up dark? (boot script)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  await ctx.addInitScript(() => localStorage.setItem('theme', 'system'));
  const page = await ctx.newPage();
  await page.goto(BASE + '/resume/', { waitUntil: 'networkidle' });
  results['resume-load-os-dark'] = await state(page);
  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
