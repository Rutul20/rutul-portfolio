// Skeptic check: does meta[name=theme-color] match the active theme on /resume/ (and '/')?
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const OUT = 'qa/shots/theme-behaviour-verify';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const log = (o) => { results.push(o); console.log(JSON.stringify(o)); };

const browser = await chromium.launch({ headless: true });

async function probe(page) {
  return page.evaluate(() => ({
    dataTheme: document.documentElement.dataset.theme,
    pref: document.documentElement.dataset.themePref,
    metas: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content')),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    resumeBg: document.querySelector('.resume-page') ? getComputedStyle(document.querySelector('.resume-page')).backgroundColor : null,
    hasThemeBtn: !!document.querySelector('button[aria-label^="Theme:"]'),
  }));
}

const cases = [
  { name: 'dev-desktop-dark', base: 'http://localhost:3100', dev: null, theme: 'dark', scheme: 'light' },
  { name: 'prod-desktop-dark', base: 'http://localhost:4100', dev: null, theme: 'dark', scheme: 'light' },
  { name: 'prod-pixel7-dark', base: 'http://localhost:4100', dev: 'Pixel 7', theme: 'dark', scheme: 'light' },
  { name: 'prod-pixel7-system-osdark', base: 'http://localhost:4100', dev: 'Pixel 7', theme: 'system', scheme: 'dark' },
  { name: 'prod-pixel7-light', base: 'http://localhost:4100', dev: 'Pixel 7', theme: 'light', scheme: 'light' },
];

for (const c of cases) {
  const ctx = await browser.newContext({ ...(c.dev ? devices[c.dev] : { viewport: { width: 1280, height: 800 } }), colorScheme: c.scheme });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), c.theme);
  const page = await ctx.newPage();
  await page.goto(c.base + '/resume/', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const r = await probe(page);
  await page.screenshot({ path: `${OUT}/${c.name}-resume.png` });
  log({ case: c.name, route: '/resume/', ...r });
  await ctx.close();
}

// Client navigation: '/' (dark) -> /resume/ via the in-page link, on prod
{
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), 'dark');
  const page = await ctx.newPage();
  await page.goto('http://localhost:4100/?mode=still', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  log({ case: 'prod-pixel7-dark-home', route: '/?mode=still', ...(await probe(page)) });
  const href = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href]')].find((x) => /\/resume\/?$/.test(x.getAttribute('href')));
    return a ? a.getAttribute('href') : null;
  });
  if (href) {
    await page.evaluate(() => {
      const a = [...document.querySelectorAll('a[href]')].find((x) => /\/resume\/?$/.test(x.getAttribute('href')));
      a.click();
    });
    await page.waitForURL(/\/resume\/?$/, { timeout: 15000 });
    await page.waitForTimeout(3000);
    log({ case: 'prod-pixel7-dark-clientnav', route: 'home->' + href, ...(await probe(page)) });
    await page.screenshot({ path: `${OUT}/prod-pixel7-dark-clientnav-resume.png` });
  } else log({ case: 'prod-pixel7-dark-clientnav', error: 'no resume link found' });
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/resume-meta-results.json`, JSON.stringify(results, null, 2));
