// QA helper: the project shelf + details dialog, desktop and phone, mouse and keyboard.
// Usage: node qa/shelf.mjs [baseUrl]
import { chromium, devices } from 'playwright';

const base = process.argv[2] || 'http://localhost:3100';
const browser = await chromium.launch({ headless: true });
const problems = [];

async function run(label, ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${label}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && problems.push(`${label}: ${m.text().slice(0, 160)}`));
  await page.goto(`${base}/?mode=still`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.documentElement.classList.add('stops-laid-out'));
  await page.waitForTimeout(400);
  for (const id of ['client-work', 'workshop']) {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: 'instant', block: 'start' }), id);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `qa/shots/${label}-${id}.png` });
  }
  const card = await page.evaluate(() => {
    const el = document.querySelector('#workshop .card');
    return { cardHeight: Math.round(el.getBoundingClientRect().height), viewport: innerHeight };
  });
  // keyboard: focus the 3rd Details button, open with Enter, close with Escape
  const btn = page.locator('.shelf-card button').nth(2);
  await btn.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const open = await page.evaluate(() => ({
    open: document.querySelector('.project-dialog').open,
    title: document.getElementById('project-dialog-title')?.textContent,
    focusInside: document.querySelector('.project-dialog').contains(document.activeElement),
    pageLocked: document.documentElement.classList.contains('dialog-open'),
  }));
  await page.screenshot({ path: `qa/shots/${label}-dialog.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    open: document.querySelector('.project-dialog').open,
    focusBack: document.activeElement?.textContent?.trim(),
  }));
  // mouse: open the first one, close by clicking the backdrop corner
  await page.evaluate(() => {
    document.querySelector('.shelf').scrollTo({ left: 0 });
    document.querySelector('.shelf').scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(300);
  await page.locator('.shelf-card button').first().click();
  await page.waitForTimeout(300);
  await page.mouse.click(5, (ctxOpts.viewport?.height ?? 800) - 5);
  await page.waitForTimeout(300);
  const backdropClosed = await page.evaluate(() => !document.querySelector('.project-dialog').open);
  console.log(label, JSON.stringify({ ...card, dialog: open, afterEscape: after, backdropClosed }));
  await ctx.close();
}

// reduced motion = instant scrolling, so Playwright's own scroll-into-view isn't animated
await run('desktop', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await run('phone', { ...devices['Pixel 7'], reducedMotion: 'reduce' });
console.log(problems.length ? problems.join('\n') : 'no errors');
await browser.close();
