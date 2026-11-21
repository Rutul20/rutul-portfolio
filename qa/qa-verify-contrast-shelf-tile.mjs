// Independent check of the shelf monogram tile contrast finding.
// For each span.shelf-tile: screenshot with the letter (fg) and with color:transparent (bg),
// find the glyph pixels from the difference, and measure white vs the background under each glyph pixel.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';

const BASE = 'http://localhost:4100/';
const OUT = 'qa/shots/contrast';
fs.mkdirSync(OUT, { recursive: true });

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];

async function raw(buf) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

const results = [];
for (const theme of ['light', 'dark']) {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  let live = true;
  try { await page.waitForSelector('.live.is-shown', { timeout: 30000 }); } catch { live = false; }
  await page.waitForTimeout(1500);
  const htmlAttrs = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, stage: document.documentElement.dataset.stage ?? null }));
  await page.evaluate(() => document.documentElement.classList.add('stops-laid-out'));
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#workshop').scrollIntoView({ behavior: 'instant', block: 'start' }));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/verify-shelf-tile-${theme}-viewport.png` });

  const tiles = await page.$$('span.shelf-tile');
  for (const [i, el] of tiles.entries()) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const info = await el.evaluate((n) => {
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      return { letter: n.textContent, ariaHidden: n.getAttribute('aria-hidden'), fontSize: cs.fontSize, fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, color: cs.color, bg: cs.backgroundColor, bgImage: cs.backgroundImage, w: r.width, h: r.height, x: r.x, y: r.y, inViewport: r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight, nextText: n.parentElement?.innerText.split('\n').slice(0, 2).join(' | ') };
    });
    const fgBuf = await el.screenshot({ path: `${OUT}/verify-shelf-tile-${theme}-${info.letter}-fg.png` });
    await el.evaluate((n) => { n.style.color = 'transparent'; });
    await page.waitForTimeout(100);
    const bgBuf = await el.screenshot({ path: `${OUT}/verify-shelf-tile-${theme}-${info.letter}-bg.png` });
    await el.evaluate((n) => { n.style.color = ''; });

    const fg = await raw(fgBuf); const bg = await raw(bgBuf);
    const core = []; const any = []; let worstPx = null; let fgCoreSample = null;
    for (let p = 0; p < fg.w * fg.h; p++) {
      const o = p * 3;
      const B = [bg.data[o], bg.data[o + 1], bg.data[o + 2]];
      const A = [fg.data[o], fg.data[o + 1], fg.data[o + 2]];
      const cov = [0, 1, 2].map((k) => (255 - B[k] > 4 ? (A[k] - B[k]) / (255 - B[k]) : 0)).reduce((s, v) => s + v, 0) / 3;
      if (cov < 0.5) continue;
      const cr = ratio(1, lum(...B));
      any.push(cr);
      if (cov >= 0.9) {
        core.push(cr);
        if (!worstPx || cr < worstPx.cr) worstPx = { cr, bg: hex(...B), x: p % fg.w, y: Math.floor(p / fg.w) };
        if (!fgCoreSample) fgCoreSample = hex(...A);
      }
    }
    core.sort((a, b) => a - b); any.sort((a, b) => a - b);
    const m = info.bg.match(/\d+/g).map(Number);
    const flat = ratio(1, lum(m[0], m[1], m[2]));
    const r = {
      theme, live, htmlAttrs, ...info, flatTintRatio: +flat.toFixed(2),
      corePixels: core.length, coreMin: +core[0]?.toFixed(2), coreP5: +pct(core, 0.05)?.toFixed(2), coreMedian: +pct(core, 0.5)?.toFixed(2),
      coreShareBelow3: +(core.filter((v) => v < 3).length / core.length).toFixed(3),
      anyPixels: any.length, anyMin: +any[0]?.toFixed(2), anyShareBelow3: +(any.filter((v) => v < 3).length / any.length).toFixed(3),
      worstPx, fgCoreSample,
    };
    results.push(r);
    console.log(JSON.stringify(r));
  }
  await browser.close();
}
fs.writeFileSync('qa/qa-verify-contrast-shelf-tile.json', JSON.stringify(results, null, 2));
