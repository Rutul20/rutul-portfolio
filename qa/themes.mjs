// QA helper: screenshots of key stops in light and dark (desktop live, or phone pictures).
// Usage: node qa/themes.mjs [baseUrl] [desktop|phone]
import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3100';
const kind = process.argv[3] || 'desktop';
mkdirSync('qa/shots', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const problems = [];
const tiles = [];
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext(
    kind === 'phone' ? { ...devices['Pixel 7'], reducedMotion: 'reduce' } : { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' },
  );
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${theme}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && problems.push(`${theme}: ${m.text().slice(0, 160)}`));
  await page.goto(base + (kind === 'phone' ? '/?mode=still' : '/'), { waitUntil: 'load' });
  if (kind !== 'phone') await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const shots = [];
  shots.push(await page.screenshot());
  // theme menu open
  await page.getByRole('button', { name: /^Theme:/ }).click();
  await page.waitForTimeout(250);
  shots.push(await page.screenshot());
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.documentElement.classList.add('stops-laid-out'));
  for (const id of ['experience', 'client-work', 'workshop', 'contact']) {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: 'instant', block: 'start' }), id);
    await page.waitForTimeout(kind === 'phone' ? 700 : 1600);
    shots.push(await page.screenshot());
  }
  const info = await page.evaluate(() => {
    const card = document.querySelector('#contact .card');
    const cs = getComputedStyle(card);
    return { theme: document.documentElement.dataset.theme, stage: document.documentElement.dataset.stage, cardBg: cs.backgroundColor, blur: cs.backdropFilter, metaTheme: document.querySelector('meta[name="theme-color"]')?.content };
  });
  console.log(kind, theme, JSON.stringify(info));
  const w = kind === 'phone' ? 206 : 480, h = kind === 'phone' ? 458 : 300;
  for (const s of shots) tiles.push(await sharp(s).resize(w, h, { fit: 'cover', position: 'top' }).toBuffer());
  await ctx.close();
}
const W = kind === 'phone' ? 206 : 480, H = kind === 'phone' ? 458 : 300, cols = 6;
await sharp({ create: { width: W * cols, height: H * 2, channels: 3, background: '#000' } })
  .composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * W, top: Math.floor(i / cols) * H })))
  .jpeg({ quality: 80 })
  .toFile(`qa/shots/themes-${kind}.jpg`);
console.log(problems.length ? [...new Set(problems)].join('\n') : 'no errors');
await browser.close();
