// QA helper: keyboard order, reduced motion, no-WebGL fallback and the résumé page.
// Usage: node qa/fallbacks.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4100';
const gpu = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const errorsOf = (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
  return errs;
};

// 1. Keyboard: first 12 tab stops on desktop
{
  const b = await chromium.launch({ headless: true, args: gpu });
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base, { waitUntil: 'load' });
  const stops = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        const ring = getComputedStyle(el).outlineStyle !== 'none';
        return `${el.tagName.toLowerCase()}:${(el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 28)}${ring ? '' : ' (NO RING)'}`;
      }),
    );
  }
  console.log('Tab order:', stops.join(' → '));
  // Activating a legend link moves the page to that stop
  await page.locator('.legend-rail a[href="#epost"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const where = await page.evaluate(() => Math.round(document.getElementById('epost').getBoundingClientRect().top));
  console.log('Enter on "ePost" in the map → section top at', where, 'px', where >= -2 && where <= 2 ? 'OK' : 'CHECK');
  await b.close();
}

// 2. Reduced motion: camera cuts (no damping), page still works
{
  const b = await chromium.launch({ headless: true, args: gpu });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errs = errorsOf(page);
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  const smooth = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  await page.evaluate(() => document.getElementById('experience').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(120);
  await page.screenshot({ path: 'qa/shots/reduced-motion-experience.png' });
  console.log('Reduced motion: scroll-behavior =', smooth, '· errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close();
}

// 3. No WebGL at all: pictures, no "Enter the 3D city" button, no crash
{
  const b = await chromium.launch({ headless: true, args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] });
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = errorsOf(page);
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const state = await page.evaluate(() => ({
    live: !!document.querySelector('.live'),
    stills: document.querySelectorAll('.still img').length,
    button: !!document.querySelector('.enter-3d'),
  }));
  await page.screenshot({ path: 'qa/shots/no-webgl-hero.png' });
  console.log('No WebGL:', JSON.stringify(state), '· errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close();
}

// 4. Phone taps "Enter the 3D city" (real GPU): live city appears, page keeps working
{
  const b = await chromium.launch({ headless: true, args: gpu });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = errorsOf(page);
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.locator('.enter-3d').tap();
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/shots/phone-entered-3d.png' });
  console.log('Phone "Enter the 3D city": live shown · errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close();
}

// 5. Résumé page
{
  const b = await chromium.launch({ headless: true });
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = errorsOf(page);
  await page.goto(`${base}/resume/`, { waitUntil: 'load' });
  const h = await page.evaluate(() => [...document.querySelectorAll('h1,h2')].map((e) => e.textContent).join(' / '));
  await page.screenshot({ path: 'qa/shots/resume.png', fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: 'qa/shots/resume.pdf', format: 'A4', printBackground: true });
  console.log('Résumé headings:', h, '· errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close();
}
