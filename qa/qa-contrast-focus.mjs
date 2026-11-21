// QA lens "contrast": the REAL keyboard focus ring, measured from pixels.
// For each focusable on screen: screenshot it unfocused and keyboard-focused, find the ring pixels
// (changed pixels outside the element box that match the accent), then compare the ring with the
// unchanged pixels right next to it. A ring pixel with no neighbour at >= 3:1 is effectively invisible.
// Usage: node qa/qa-contrast-focus.mjs [light,dark] [desktop,phone]   (BASE env, default :4100)
import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4100';
const THEMES = (process.argv[2] || 'light,dark').split(',');
const TARGETS = (process.argv[3] || 'desktop,phone').split(',');
const OUT = 'qa/shots/contrast/focus';
mkdirSync(OUT, { recursive: true });

const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const r2 = (v) => Math.round(v * 100) / 100;
const parseHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

async function raw(buf) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

async function listTargets(page) {
  return page.evaluate(() => {
    const out = [];
    const W = innerWidth, H = innerHeight;
    const describe = (el) => {
      const parts = [];
      for (let e = el; e && e !== document.body && parts.length < 3; e = e.parentElement) {
        let s = e.tagName.toLowerCase();
        if (e.id) { parts.unshift(`${s}#${e.id}`); break; }
        const cls = [...e.classList].filter((c) => /^[a-z][\w-]*$/i.test(c) && c.length < 22).slice(0, 3);
        if (cls.length) s += '.' + cls.join('.');
        parts.unshift(s);
      }
      return parts.join(' > ');
    };
    document.querySelectorAll('a[href], button, [tabindex]').forEach((el, i) => {
      if (el.tabIndex < 0) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.top < 0 || r.left < 0 || r.bottom > H || r.right > W) return;
      const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      if (!hit || !(hit === el || el.contains(hit))) return;
      el.dataset.qaFocus = String(i);
      out.push({ id: String(i), sel: describe(el), label: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, header: !!el.closest('header') });
    });
    return { list: out, accent: getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() };
  });
}

async function measureRing(page, t, accentHex, dpr, tag) {
  const pad = 12;
  const vp = page.viewportSize();
  const clip = {
    x: Math.max(0, Math.floor(t.x0 - pad)), y: Math.max(0, Math.floor(t.y0 - pad)),
  };
  clip.width = Math.min(vp.width, Math.ceil(t.x1 + pad)) - clip.x;
  clip.height = Math.min(vp.height, Math.ceil(t.y1 + pad)) - clip.y;
  await page.evaluate(() => document.activeElement && document.activeElement !== document.body && document.activeElement.blur());
  await page.waitForTimeout(60);
  const U = await raw(await page.screenshot({ clip }));
  await page.keyboard.press('Shift');
  const fv = await page.evaluate((id) => {
    const el = document.querySelector(`[data-qa-focus="${id}"]`);
    el.focus({ preventScroll: true });
    return el.matches(':focus-visible');
  }, t.id);
  await page.waitForTimeout(60);
  const Fbuf = await page.screenshot({ clip });
  const F = await raw(Fbuf);
  await page.evaluate(() => document.activeElement?.blur());

  const accent = parseHex(accentHex);
  const La = lum(accent);
  const W = F.w, H = F.h;
  // element box in clip device pixels
  const ex0 = (t.x0 - clip.x) * dpr, ey0 = (t.y0 - clip.y) * dpr, ex1 = (t.x1 - clip.x) * dpr, ey1 = (t.y1 - clip.y) * dpr;
  const inside = (x, y) => x + 0.5 >= ex0 && x + 0.5 <= ex1 && y + 0.5 >= ey0 && y + 0.5 <= ey1;
  const at = (img, x, y) => { const i = (y * W + x) * 3; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
  const cls = new Uint8Array(W * H); // 0 = ignore, 1 = ring core, 2 = unchanged background
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (inside(x, y)) continue;
      const f = at(F, x, y), u = at(U, x, y);
      const diff = Math.abs(f[0] - u[0]) + Math.abs(f[1] - u[1]) + Math.abs(f[2] - u[2]);
      const nearAccent = Math.abs(f[0] - accent[0]) + Math.abs(f[1] - accent[1]) + Math.abs(f[2] - accent[2]) < 36;
      if (diff > 40 && nearAccent) cls[y * W + x] = 1;
      else if (diff < 12) cls[y * W + x] = 2;
    }
  const k = Math.ceil(2 * dpr);
  let core = 0, unsupported = 0;
  const adjVals = [];
  const seenAdj = new Uint8Array(W * H);
  const failing = [];
  let ringSum = [0, 0, 0];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (cls[y * W + x] !== 1) continue;
      core++;
      const f = at(F, x, y);
      ringSum = ringSum.map((s, i) => s + f[i]);
      let best = 0, any = false;
      for (let yy = Math.max(0, y - k); yy <= Math.min(H - 1, y + k); yy++)
        for (let xx = Math.max(0, x - k); xx <= Math.min(W - 1, x + k); xx++) {
          if (cls[yy * W + xx] !== 2) continue;
          any = true;
          const v = ratio(La, lum(at(F, xx, yy)));
          if (v > best) best = v;
          if (!seenAdj[yy * W + xx]) {
            seenAdj[yy * W + xx] = 1;
            adjVals.push(v);
            if (v < 3) failing.push(at(F, xx, yy));
          }
        }
      if (any && best < 3) unsupported++;
    }
  adjVals.sort((a, b) => a - b);
  const med = (arr) => arr.length ? [0, 1, 2].map((i) => arr.map((c) => c[i]).sort((a, b) => a - b)[Math.floor(arr.length / 2)]) : null;
  const res = {
    view: tag, label: t.label, sel: t.sel, header: t.header, focusVisible: fv,
    ringPx: core, ringColor: core ? hex(ringSum.map((s) => s / core)) : null,
    adjMin: adjVals.length ? r2(adjVals[0]) : null,
    adjBelow3: adjVals.length ? r2(adjVals.filter((v) => v < 3).length / adjVals.length) : null,
    invisibleShare: core ? r2(unsupported / core) : null,
    typicalFailingBg: failing.length ? hex(med(failing)) : null,
    shot: null,
  };
  if (core && (res.adjBelow3 > 0.1 || res.invisibleShare > 0.05)) {
    res.shot = `${OUT}/${tag}-${t.id}.png`;
    await sharp(Fbuf).resize({ width: Math.round(clip.width * 3), kernel: 'nearest' }).toFile(res.shot);
  }
  return res;
}

const results = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
async function runViews(page, prefix, views, dpr, wait) {
  for (const v of views) {
    await page.evaluate(async (s) => {
      document.documentElement.classList.add('stops-laid-out');
      await new Promise((r) => setTimeout(r, 300));
      if (s === 'top') window.scrollTo({ top: 0, behavior: 'instant' });
      else document.querySelector(s).scrollIntoView({ behavior: 'instant', block: 'start' });
    }, v);
    await page.waitForTimeout(wait);
    await page.mouse.move(2, 300).catch(() => {});
    const { list, accent } = await listTargets(page);
    const tag = `${prefix}-${v === 'top' ? 'hero' : v.slice(1)}`;
    await page.screenshot({ path: `${OUT}/${tag}-view.png` });
    for (const t of list) {
      const r = await measureRing(page, t, accent, dpr, tag);
      results.push(r);
      const flag = r.invisibleShare > 0.05 || r.adjBelow3 > 0.25 ? '  <-- LOW' : '';
      console.log(`${tag.padEnd(22)} ${r.label.padEnd(30)} fv=${r.focusVisible} ring=${r.ringColor} px=${r.ringPx} adjMin=${r.adjMin} adj<3=${r.adjBelow3} invisible=${r.invisibleShare} bg~${r.typicalFailingBg}${flag}`);
    }
  }
}

for (const theme of THEMES) {
  if (TARGETS.includes('desktop')) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.live.is-shown', { timeout: 30000 });
    await page.waitForTimeout(1500);
    await runViews(page, `d-${theme}`, ['top', '#about', '#epost', '#client-work', '#workshop', '#contact'], 1, 2500);
    await ctx.close();
  }
  if (TARGETS.includes('phone')) {
    const dev = devices['Pixel 7'];
    const ctx = await browser.newContext({ ...dev });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?mode=still`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await runViews(page, `p-${theme}`, ['top', '#experience', '#workshop', '#contact'], dev.deviceScaleFactor, 1800);
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`qa/qa-contrast-focus-results-${THEMES.join('-')}_${TARGETS.join('-')}.json`, JSON.stringify(results, null, 1));
