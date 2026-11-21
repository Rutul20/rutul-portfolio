// QA (lens: visual review) — screenshots of the Gallery Plinth theme in BOTH themes.
// Desktop live 3D 1440x900 + phone Pixel 7 pictures mode. Also dumps a few geometry facts.
// Usage: cd /d/rutul-portfolio && node qa/qa-visual-shoot.mjs [baseUrl] [only=desktop|phone]
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:4100';
const ONLY = process.argv[3] || '';
const OUT = 'qa/shots';
mkdirSync(OUT, { recursive: true });
const facts = {};
const problems = [];

const SECTIONS = ['about', 'experience', 'epost', 'client-work', 'workshop', 'education', 'contact'];

async function scrollToY(page, y) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
}
async function jump(page, id) {
  await page.evaluate(() => document.documentElement.classList.add('stops-laid-out'));
  await page.waitForTimeout(300);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: 'instant', block: 'start' }), id);
}
const heroRange = (page) => page.evaluate(() => document.getElementById('city').offsetHeight - innerHeight);

async function desktop(theme) {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/THREE.Clock/.test(m.text()) && problems.push(`desktop ${theme} ${m.type()}: ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => problems.push(`desktop ${theme} pageerror: ${e.message}`));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const p = `${OUT}/qa-visual-${theme}-desk`;

  facts[`desk-${theme}`] = await page.evaluate(() => ({
    dataTheme: document.documentElement.dataset.theme,
    stage: document.documentElement.dataset.stage,
    themeColor: document.querySelector('meta[name="theme-color"]')?.content,
    ticketMainBg: getComputedStyle(document.querySelector('.ticket-main')).backgroundColor,
    ticketFilter: getComputedStyle(document.querySelector('.ticket-main')).backdropFilter,
    main: document.querySelector('.ticket-main').getBoundingClientRect().toJSON(),
    stub: document.querySelector('.ticket-stub').getBoundingClientRect().toJSON(),
  }));

  await page.screenshot({ path: `${p}-hero.png` });
  // close-up of the ticket at the seam (divider + notches)
  const stub = facts[`desk-${theme}`].stub;
  await page.screenshot({ path: `${p}-ticket-seam.png`, clip: { x: stub.x - 20, y: stub.y - 60, width: stub.width + 40, height: 140 } });

  // theme menu open
  await page.click('button[aria-label^="Theme"]');
  await page.waitForTimeout(400);
  const menu = await page.evaluate(() => {
    const el = document.getElementById('theme-options');
    return el && { rect: el.getBoundingClientRect().toJSON(), vw: innerWidth };
  });
  facts[`desk-${theme}`].menu = menu;
  await page.screenshot({ path: `${p}-theme-menu.png` });
  await page.screenshot({ path: `${p}-theme-menu-zoom.png`, clip: { x: 900, y: 0, width: 540, height: 320 } });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // landing frames
  const range = await heroRange(page);
  facts[`desk-${theme}`].heroRange = range;
  for (const f of [0.6, 0.8, 0.88, 0.95, 1]) {
    await scrollToY(page, Math.round(range * f));
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${p}-landing-${String(Math.round(f * 100)).padStart(3, '0')}.png` });
  }

  for (const id of SECTIONS) {
    await jump(page, id);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${p}-${id}.png` });
  }

  // Details dialog
  await jump(page, 'workshop');
  await page.waitForTimeout(1500);
  const btn = page.locator('#workshop button', { hasText: 'Details' }).first();
  await btn.click();
  await page.waitForSelector('.project-dialog[open]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${p}-dialog.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // résumé
  await page.goto(BASE + '/resume/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${p}-resume.png` });
  await page.screenshot({ path: `${p}-resume-full.png`, fullPage: true });
  await browser.close();
}

async function phone(theme) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`phone ${theme} ${m.type()}: ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => problems.push(`phone ${theme} pageerror: ${e.message}`));
  await page.goto(BASE + '/?mode=still', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const p = `${OUT}/qa-visual-${theme}-phone`;
  facts[`phone-${theme}`] = await page.evaluate(() => ({
    dataTheme: document.documentElement.dataset.theme,
    stage: document.documentElement.dataset.stage,
    header: document.querySelector('header > div').getBoundingClientRect().toJSON(),
    nav: document.querySelector('header nav').getBoundingClientRect().toJSON(),
    vw: innerWidth,
    docW: document.documentElement.scrollWidth,
  }));
  await page.screenshot({ path: `${p}-hero.png` });
  await page.click('button[aria-label^="Theme"]');
  await page.waitForTimeout(400);
  facts[`phone-${theme}`].menu = await page.evaluate(() => document.getElementById('theme-options')?.getBoundingClientRect().toJSON());
  await page.screenshot({ path: `${p}-theme-menu.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const range = await heroRange(page);
  facts[`phone-${theme}`].heroRange = range;
  // scroll a little first so the remaining pictures start loading
  await scrollToY(page, 40);
  await page.waitForTimeout(1500);
  for (const f of [0.8, 0.95]) {
    await scrollToY(page, Math.round(range * f));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${p}-landing-${String(Math.round(f * 100)).padStart(3, '0')}.png` });
  }
  for (const id of ['client-work', 'workshop', 'contact']) {
    await jump(page, id);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${p}-${id}.png` });
  }
  await browser.close();
}

for (const theme of ['light', 'dark']) {
  if (ONLY !== 'phone') await desktop(theme);
  if (ONLY !== 'desktop') await phone(theme);
}
writeFileSync(`${OUT}/qa-visual-facts${ONLY ? '-' + ONLY : ''}.json`, JSON.stringify(facts, null, 2));
console.log(JSON.stringify(facts, null, 2));
console.log(problems.length ? [...new Set(problems)].join('\n') : 'no console errors');
