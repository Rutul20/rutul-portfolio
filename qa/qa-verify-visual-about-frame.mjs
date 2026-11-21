// QA verify (lens: visual) — does the #about photo's white frame ignore the theme and glare in dark?
// Usage: node qa/qa-verify-visual-about-frame.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:3100';
fs.mkdirSync('qa/shots', { recursive: true });
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const out = {};
const runs = [
  { name: 'desk', ctxOpts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, url: '/', live: true },
  { name: 'phone', ctxOpts: { ...devices['Pixel 7'] }, url: '/?mode=still', live: false },
];
for (const theme of ['dark', 'light']) {
  for (const run of runs) {
    const ctx = await browser.newContext(run.ctxOpts);
    await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
    const page = await ctx.newPage();
    await page.goto(base + run.url, { waitUntil: 'load' });
    if (run.live) {
      await page.waitForSelector('.live.is-shown', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1500);
    } else {
      await page.waitForTimeout(1500);
    }
    await page.evaluate(() => document.documentElement.classList.add('stops-laid-out'));
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('#about').scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(600);
    const img = page.locator('#about img').first();
    await img.evaluate((el) => (el.complete ? null : new Promise((r) => { el.onload = r; el.onerror = r; })));
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const im = document.querySelector('#about img');
      const card = im.closest('.card') || im.closest('section') || im.parentElement;
      const h2 = document.querySelector('#about h2');
      const cs = getComputedStyle(im);
      const b = im.getBoundingClientRect();
      return {
        theme: document.documentElement.dataset.theme,
        stage: document.documentElement.dataset.stage || null,
        imgRect: { x: b.x, y: b.y, w: b.width, h: b.height },
        borderColor: cs.borderTopColor, borderWidth: cs.borderTopWidth, transform: cs.transform,
        cardClass: card.className, cardBg: getComputedStyle(card).backgroundColor,
        h2Color: getComputedStyle(h2).color,
        surfaceToken: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim(),
        inkToken: getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim(),
        pageBg: getComputedStyle(document.documentElement).getPropertyValue('--page-bg').trim(),
      };
    });
    const tag = `${theme}-${run.name}`;
    const file = `qa/shots/qa-verify-visual-about-frame-${tag}.png`;
    await page.screenshot({ path: file });
    const meta = await sharp(file).metadata();
    const raw = await sharp(file).raw().toBuffer();
    const dpr = meta.width / page.viewportSize().width;
    const at = (x, y) => { x = Math.round(x * dpr); y = Math.round(y * dpr); const i = (y * meta.width + x) * meta.channels; return [raw[i], raw[i + 1], raw[i + 2]]; };
    // horizontal scan across the left edge at the image vertical middle
    const r = info.imgRect;
    const midY = r.y + r.h / 2;
    const scan = [];
    for (let dx = -8; dx <= 10; dx += 1) scan.push(`${dx}:${at(r.x + dx, midY).join(',')}`);
    // card sample a bit left of the photo
    const cardSample = at(r.x - 24, midY);
    // frame sample: rotated 2deg so sample a bit inside from edge
    const frameSamples = [];
    for (let dx = 1; dx <= 8; dx++) frameSamples.push(at(r.x + dx, midY));
    const brightest = frameSamples.reduce((a, c) => (lum(c) > lum(a) ? c : a));
    out[tag] = {
      info, dpr, scan, cardSample: cardSample.join(','), frameBrightest: brightest.join(','),
      frame_vs_card: ratio(brightest, cardSample).toFixed(2),
    };
    // crop around the photo
    const pad = 60;
    const left = Math.max(0, Math.round((r.x - pad) * dpr)), top = Math.max(0, Math.round((r.y - pad) * dpr));
    const w = Math.min(meta.width - left, Math.round((r.w + pad * 2) * dpr) + 300);
    const h = Math.min(meta.height - top, Math.round((r.h + pad * 2) * dpr));
    // wider crop including the H2 to the left
    const left2 = Math.max(0, Math.round((r.x - 520) * dpr));
    const w2 = Math.min(meta.width - left2, Math.round((r.w + 600) * dpr));
    await sharp(file).extract({ left: left2, top, width: w2, height: h }).toFile(`qa/shots/qa-verify-visual-about-frame-crop-${tag}.png`);
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync('qa/qa-verify-visual-about-frame.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
