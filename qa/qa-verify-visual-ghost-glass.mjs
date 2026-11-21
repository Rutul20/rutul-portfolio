// Skeptic check: does the 0.97-alpha, unblurred "solid glass" on phones show a visible ghost
// of what is behind it? Compares each panel as shipped vs. the same panel forced fully opaque
// (override injected in the test browser only), inside the panel's own rectangle.
import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4100';
const OUT = 'qa/shots';
fs.mkdirSync(OUT, { recursive: true });

const OPAQUE = `
:root[data-theme='dark'] { --glass-solid: rgb(31 30 28) !important; }
:root[data-theme='light'] { --glass-solid: rgb(250 248 244) !important; }
:root { --glass: var(--glass-solid) !important; }
`;

function lum([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

async function raw(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

async function measure(page, sel, tag, dpr) {
  const box = await page.locator(sel).first().boundingBox();
  if (!box) return { tag, error: 'no box for ' + sel };
  const a = await page.screenshot();
  await page.addStyleTag({ content: OPAQUE, }).then((h) => h.evaluate((n) => n.setAttribute('id', 'qa-opaque')));
  await page.waitForTimeout(250);
  const b = await page.screenshot();
  await page.evaluate(() => document.getElementById('qa-opaque')?.remove());
  await page.waitForTimeout(150);

  const A = await raw(a);
  const B = await raw(b);
  // inset 4 css px so borders/shadows are excluded
  const x0 = Math.max(0, Math.ceil((box.x + 4) * dpr)), y0 = Math.max(0, Math.ceil((box.y + 4) * dpr));
  const x1 = Math.min(A.w, Math.floor((box.x + box.width - 4) * dpr));
  const y1 = Math.min(A.h, Math.floor((box.y + box.height - 4) * dpr));
  let n = 0, changed = 0, gt3 = 0, gt5 = 0, maxd = 0, sum = 0;
  let brightest = null, bMax = -1;
  const hist = {};
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * A.w + x) * 4;
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    n++;
    sum += d;
    if (d > 0) changed++;
    if (d > 3) gt3++;
    if (d > 5) gt5++;
    if (d > maxd) maxd = d;
    // brightest background-coloured (non-text) pixel: opaque version equals the flat bg there
    const bg = [B.data[i], B.data[i + 1], B.data[i + 2]];
    const isBg = Math.abs(bg[0] - B.data[(y0 * A.w + x0) * 4]) <= 1 && Math.abs(bg[1] - B.data[(y0 * A.w + x0) * 4 + 1]) <= 1;
    if (isBg && d > bMax) { bMax = d; brightest = { at: [x, y], shipped: [A.data[i], A.data[i + 1], A.data[i + 2]], opaque: bg }; }
  }
  const flatBg = [B.data[(y0 * A.w + x0) * 4], B.data[(y0 * A.w + x0) * 4 + 1], B.data[(y0 * A.w + x0) * 4 + 2]];

  // amplified diff image (x20) + shipped crop + contrast-stretched shipped crop
  const cw = x1 - x0, ch = y1 - y0;
  console.error(tag, JSON.stringify(box), A.w, A.h, x0, y0, x1, y1);
  if (cw <= 0 || ch <= 0) return { tag, error: "off-screen", box };
  const diff = Buffer.alloc(cw * ch * 3);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = ((y + y0) * A.w + (x + x0)) * 4, o = (y * cw + x) * 3;
    for (let c = 0; c < 3; c++) diff[o + c] = Math.min(255, Math.abs(A.data[i + c] - B.data[i + c]) * 20);
  }
  await sharp(diff, { raw: { width: cw, height: ch, channels: 3 } }).png().toFile(`${OUT}/qa-verify-visual-ghost-${tag}-diff20x.png`);
  await sharp(a).extract({ left: x0, top: y0, width: cw, height: ch }).png().toFile(`${OUT}/qa-verify-visual-ghost-${tag}-shipped.png`);
  await sharp(b).extract({ left: x0, top: y0, width: cw, height: ch }).png().toFile(`${OUT}/qa-verify-visual-ghost-${tag}-opaque.png`);
  await sharp(a).png().toFile(`${OUT}/qa-verify-visual-ghost-${tag}-full.png`);

  return {
    tag, sel,
    box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) },
    pixels: n,
    pctChanged: +(100 * changed / n).toFixed(1),
    pctDiffOver3: +(100 * gt3 / n).toFixed(1),
    pctDiffOver5: +(100 * gt5 / n).toFixed(1),
    meanDiff: +(sum / n).toFixed(2),
    maxDiff: maxd,
    flatBg,
    brightestGhostOnBg: brightest,
    ghostVsFlatContrast: brightest ? +ratio(brightest.shipped, flatBg).toFixed(3) : null,
  };
}

const cases = [
  { theme: 'dark', dev: 'Pixel 7' },
  { theme: 'light', dev: 'Pixel 7' },
  { theme: 'dark', vp: { width: 360, height: 740 } },
];

const browser = await chromium.launch({ headless: true });
const results = [];
for (const c of cases) {
  const ctxOpts = c.dev ? { ...devices[c.dev] } : { viewport: c.vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const ctx = await browser.newContext({ ...ctxOpts, colorScheme: c.theme });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), c.theme);
  const page = await ctx.newPage();
  const dpr = ctxOpts.deviceScaleFactor || 1;
  const id = `${c.theme}-${c.dev ? c.dev.replace(/\s/g, '') : c.vp.width + 'x' + c.vp.height}`;
  await page.goto(`${BASE}/?mode=still`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    stage: document.documentElement.dataset.stage,
    ticketBg: getComputedStyle(document.querySelector('.ticket-main')).backgroundColor,
    ticketFilter: getComputedStyle(document.querySelector('.ticket-main')).backdropFilter,
    stillOpacity: [...document.querySelectorAll('.still')].map((e) => e.style.opacity),
  }));
  const r = await measure(page, '.ticket-main', `${id}-ticket`, dpr);
  results.push({ ...info, ...r });
  // stub too
  results.push(await measure(page, '.ticket-stub', `${id}-stub`, dpr));
  // map panel over the ticket
  const mapBtn = page.locator('button[aria-controls="tour-map"]');
  if (await mapBtn.isVisible()) {
    await mapBtn.click();
    await page.waitForSelector('#tour-map');
    await page.waitForTimeout(400);
    const mbg = await page.evaluate(() => getComputedStyle(document.querySelector('#tour-map')).backgroundColor);
    results.push({ mapBg: mbg, ...(await measure(page, '#tour-map', `${id}-map`, dpr)) });
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
