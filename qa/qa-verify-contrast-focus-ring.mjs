// Skeptic re-check (lens: contrast) of "focus ring over the city is below 3:1".
// Independent method: reach each control with REAL Tab presses, then sample the painted ring
// geometrically along the straight edges of the outline (corners skipped), and compare the ring
// pixel with the pixel just inside it (in the 3px offset gap) and just outside it.
// A sample "fails" when neither neighbour reaches 3:1 against the ring.
// Usage: node qa/qa-verify-contrast-focus-ring.mjs   (BASE env, default :4100)
import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4100';
const OUT = 'qa/shots/contrast/verify-focus';
mkdirSync(OUT, { recursive: true });

const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const r2 = (v) => Math.round(v * 100) / 100;

async function shot(page) {
  const buf = await page.screenshot();
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { buf, data, w: info.width, h: info.height };
}
const px = (img, x, y) => {
  x = Math.max(0, Math.min(img.w - 1, Math.round(x)));
  y = Math.max(0, Math.min(img.h - 1, Math.round(y)));
  const i = (y * img.w + x) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};

async function goStop(page, stop) {
  await page.evaluate(async (s) => {
    document.documentElement.classList.add('stops-laid-out');
    await new Promise((r) => setTimeout(r, 300));
    if (s === 'top') window.scrollTo({ top: 0, behavior: 'instant' });
    else document.querySelector(s).scrollIntoView({ behavior: 'instant', block: 'start' });
  }, stop);
}

// Reset the sequential-focus starting point to the top of <body> without scrolling.
async function resetFocusStart(page) {
  await page.evaluate(() => {
    let m = document.getElementById('qa-start');
    if (!m) {
      m = document.createElement('span');
      m.id = 'qa-start';
      m.tabIndex = -1;
      m.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;';
      document.body.prepend(m);
    }
    m.focus({ preventScroll: true });
  });
}

async function measure(page, dpr, tag, n) {
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const inHeader = !!el.closest('header');
    const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return {
      label, inHeader, cls: el.className.toString().slice(0, 40), tag: el.tagName.toLowerCase(),
      enter3d: el.classList.contains('enter-3d'), skip: el.getAttribute('href') === '#main',
      fv: el.matches(':focus-visible'), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom,
      ow: parseFloat(cs.outlineWidth), oo: parseFloat(cs.outlineOffset), oc: cs.outlineColor, os: cs.outlineStyle,
      rad: parseFloat(cs.borderTopLeftRadius), scrollY: window.scrollY,
    };
  });
  if (!(info.inHeader || info.enter3d) || info.skip) return { info, skipped: true };
  await page.waitForTimeout(80);
  const img = await shot(page);
  const { x0, y0, x1, y1, ow, oo } = info;
  const rad = Math.min(info.rad, (y1 - y0) / 2);
  const corner = rad + oo + ow + 1; // skip rounded corners
  const ringMid = oo + ow / 2, inner = oo / 2, outer = oo + ow + 1.5;
  const samples = [];
  const add = (fn, a0, a1) => { for (let a = a0; a <= a1; a += 1) samples.push(fn(a)); };
  // each sample: [ring point, inner neighbour, outer neighbour] in CSS px
  add((x) => [[x, y0 - ringMid], [x, y0 - inner], [x, y0 - outer]], x0 + corner, x1 - corner);
  add((x) => [[x, y1 + ringMid], [x, y1 + inner], [x, y1 + outer]], x0 + corner, x1 - corner);
  add((y) => [[x0 - ringMid, y], [x0 - inner, y], [x0 - outer, y]], y0 + corner, y1 - corner);
  add((y) => [[x1 + ringMid, y], [x1 + inner, y], [x1 + outer, y]], y0 + corner, y1 - corner);
  let fail = 0, onScreen = 0;
  const best = [], fails = [];
  let ringSum = [0, 0, 0];
  for (const [p, i, o] of samples) {
    if (o[0] < 0 || o[1] < 0 || o[0] * dpr >= img.w || o[1] * dpr >= img.h) continue;
    onScreen++;
    const R = px(img, p[0] * dpr, p[1] * dpr), I = px(img, i[0] * dpr, i[1] * dpr), O = px(img, o[0] * dpr, o[1] * dpr);
    ringSum = ringSum.map((s, k) => s + R[k]);
    const b = Math.max(cr(R, I), cr(R, O));
    best.push(b);
    if (b < 3) { fail++; fails.push({ ring: hex(R), inner: hex(I), outer: hex(O), ci: r2(cr(R, I)), co: r2(cr(R, O)) }); }
  }
  best.sort((a, b) => a - b);
  const crop = `${OUT}/${tag}-${n}.png`;
  const pad = 14;
  const L = Math.max(0, Math.floor((x0 - pad) * dpr)), T = Math.max(0, Math.floor((y0 - pad) * dpr));
  const W = Math.min(img.w, Math.ceil((x1 + pad) * dpr)) - L, H = Math.min(img.h, Math.ceil((y1 + pad) * dpr)) - T;
  await sharp(img.buf).extract({ left: L, top: T, width: W, height: H }).resize({ width: W * 4, kernel: 'nearest' }).toFile(crop);
  return {
    info, samples: onScreen, ringAvg: onScreen ? hex(ringSum.map((s) => s / onScreen)) : null,
    failShare: onScreen ? r2(fail / onScreen) : null, minBest: best.length ? r2(best[0]) : null,
    medianBest: best.length ? r2(best[Math.floor(best.length / 2)]) : null,
    exampleFails: fails.filter((_, k) => k % Math.max(1, Math.floor(fails.length / 4)) === 0).slice(0, 4), crop,
  };
}

const results = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
async function run(theme, kind) {
  const isPhone = kind === 'phone';
  const ctx = await browser.newContext(isPhone ? { ...devices['Pixel 7'] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${isPhone ? '?mode=still' : ''}`, { waitUntil: 'networkidle' });
  if (!isPhone) { await page.waitForSelector('.live.is-shown', { timeout: 30000 }); await page.waitForTimeout(1500); }
  else await page.waitForTimeout(2000);
  const dpr = isPhone ? devices['Pixel 7'].deviceScaleFactor : 1;
  const stops = isPhone ? ['top', '#experience', '#workshop', '#contact'] : ['top', '#about', '#epost', '#client-work', '#workshop', '#contact'];
  for (const stop of stops) {
    await goStop(page, stop);
    await page.waitForTimeout(isPhone ? 1500 : 2500);
    if (!isPhone) await page.mouse.move(700, 600);
    const tag = `${kind[0]}-${theme}-${stop === 'top' ? 'hero' : stop.slice(1)}`;
    await page.screenshot({ path: `${OUT}/${tag}-view.png` });
    await resetFocusStart(page);
    let leftHeader = false;
    for (let n = 1; n <= 9 && !leftHeader; n++) {
      await page.keyboard.press('Tab');
      const r = await measure(page, dpr, tag, n);
      if (r.skipped) {
        if (!r.info.inHeader && !r.info.enter3d && !r.info.skip && r.info.tag !== 'body' && n > 1) leftHeader = true;
        continue;
      }
      results.push({ tag, n, ...r });
      const i = r.info;
      console.log(`${tag.padEnd(20)} #${n} ${i.label.padEnd(28)} fv=${i.fv} outline=${i.os} ${i.ow}px@${i.oo} ring~${r.ringAvg} samples=${r.samples} FAIL=${r.failShare} min=${r.minBest} med=${r.medianBest} ${r.exampleFails.map((f) => `[${f.inner}/${f.outer} ${f.ci}/${f.co}]`).join(' ')}`);
    }
  }
  await ctx.close();
}
for (const theme of ['light', 'dark']) for (const kind of ['desktop', 'phone']) await run(theme, kind);
await browser.close();
writeFileSync('qa/qa-verify-contrast-focus-ring.json', JSON.stringify(results, null, 1));
