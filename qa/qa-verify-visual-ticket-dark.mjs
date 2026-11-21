// QA verify (lens: visual) — does the hero ticket blend into the wall in dark theme on desktop live 3D?
// Usage: node qa/qa-verify-visual-ticket-dark.mjs [baseUrl]
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:3100';
fs.mkdirSync('qa/shots', { recursive: true });
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const out = {};
for (const theme of ['dark', 'light']) {
  for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
    const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForSelector('.live.is-shown', { timeout: 30000 });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      const cs = (s, p) => getComputedStyle(document.querySelector(s))[p];
      return {
        theme: document.documentElement.dataset.theme,
        stage: document.documentElement.dataset.stage || null,
        wrap: r('.ticket-wrap'), main: r('.ticket-main'), stub: r('.ticket-stub'),
        mainBg: cs('.ticket-main', 'backgroundColor'), mainBorder: cs('.ticket-main', 'borderTopWidth'),
        mainShadow: cs('.ticket-main', 'boxShadow'), mainBackdrop: cs('.ticket-main', 'backdropFilter'),
        wrapShadow: cs('.ticket-wrap', 'boxShadow'),
        cardBorder: document.querySelector('.card') ? cs('.card', 'border') : null,
      };
    });
    const tag = `${theme}-${vp.width}`;
    const file = `qa/shots/qa-verify-visual-ticket-${tag}.png`;
    await page.screenshot({ path: file });
    const img = sharp(file);
    const { width, channels } = await img.metadata();
    const raw = await img.raw().toBuffer();
    const at = (x, y) => { x = Math.round(x); y = Math.round(y); const i = (y * width + x) * channels; return [raw[i], raw[i + 1], raw[i + 2]]; };
    const avg = (x, y) => { const s = [0, 0, 0]; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) at(x + dx, y + dy).forEach((v, k) => (s[k] += v)); return s.map((v) => Math.round(v / 9)); };
    const m = info.main, st = info.stub;
    const seamY = st.y; // boundary between main and stub (notch centres)
    const midY = m.y + m.h * 0.75;
    // pick spots without text: left padding of the card and just outside it
    const samples = {
      wallLeft: avg(m.x - 20, midY),
      wallAbove: avg(m.x + 40, m.y - 20),
      cardInsideLeft: avg(m.x + 8, midY),
      cardInsideTop: avg(m.x + 40, m.y + 8),
      notchCentreLeft: avg(m.x + 3, seamY),
      cardNearNotch: avg(m.x + 30, seamY + 30),
      stubInsideLeft: avg(st.x + 8, st.y + st.h * 0.6),
      wallBelowShadow: avg(st.x + st.w / 2, st.y + st.h + 10),
      wallFarBelow: avg(st.x + st.w / 2, Math.min(vp.height - 3, st.y + st.h + 80)),
      topSheen: at(m.x + 60, m.y + 0.5),
    };
    // left edge scan across the card boundary at midY
    const scan = [];
    for (let dx = -6; dx <= 6; dx += 2) scan.push(at(m.x + dx, midY).join(','));
    const ratios = {
      wall_vs_cardInside: ratio(samples.wallLeft, samples.cardInsideLeft).toFixed(3),
      notch_vs_card: ratio(samples.notchCentreLeft, samples.cardNearNotch).toFixed(3),
      wall_vs_stub: ratio(samples.wallLeft, samples.stubInsideLeft).toFixed(3),
      wall_vs_shadowBelow: ratio(samples.wallFarBelow, samples.wallBelowShadow).toFixed(3),
      wall_vs_topSheen: ratio(samples.wallAbove, samples.topSheen).toFixed(3),
    };
    // zoomed crop around the left notch + left edge
    const cx = Math.max(0, Math.round(m.x - 40)), cy = Math.max(0, Math.round(seamY - 80));
    await sharp(file).extract({ left: cx, top: cy, width: 160, height: 160 }).resize(640, 640, { kernel: 'nearest' }).toFile(`qa/shots/qa-verify-visual-ticket-notch-${tag}.png`);
    out[tag] = { info, samples: Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, hex(v) + ' ' + v.join(',')])), ratios, leftEdgeScan: scan };
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync('qa/qa-verify-visual-ticket-dark.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
