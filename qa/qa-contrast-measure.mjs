// QA lens "contrast": WCAG contrast measured from rendered pixels, in both themes.
// For every visible text fragment: text colour (computed) vs the WORST background pixel inside its box,
// taken from a second screenshot with every glyph made transparent. Also UI components: focus ring
// (accent outline) vs the pixels next to it, legend dots, theme-button icon, ghost-button borders, chips.
// Usage: node qa/qa-contrast-measure.mjs [light,dark] [desktop,phone,resume]   (BASE env, default :4100)
import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4100';
const THEMES = (process.argv[2] || 'light,dark').split(',');
const TARGETS = (process.argv[3] || 'desktop,phone,resume').split(',');
const SHOTS = 'qa/shots/contrast';
mkdirSync(SHOTS, { recursive: true });

/* ── WCAG maths ─────────────────────────────────────────────────────────── */
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const r2 = (v) => Math.round(v * 100) / 100;

/* glyphs, icons, underlines and ::before/::after markers off; backgrounds untouched */
const HIDE = `*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important;
  text-decoration-color: transparent !important; text-shadow: none !important; caret-color: transparent !important;
  transition: none !important; }
*::before, *::after { opacity: 0 !important; }
*::marker { color: transparent !important; }`;

/* ── Page-side collector ───────────────────────────────────────────────── */
function collect() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = 'rgba(0,0,0,0)';
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], Math.round((d[3] / 255) * 1000) / 1000];
  };
  const W = innerWidth;
  const H = innerHeight;
  const modal = document.querySelector('dialog[open]');
  const inScope = (el) => !modal || modal.contains(el);
  const opacityChain = (el) => {
    let op = 1;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      op *= +cs.opacity;
    }
    return op;
  };
  const clipOf = (el) => {
    let x0 = 0, y0 = 0, x1 = W, y1 = H;
    for (let e = el; e && e !== document.documentElement && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || (cs.clipPath && cs.clipPath !== 'none')) {
        const r = e.getBoundingClientRect();
        x0 = Math.max(x0, r.left); y0 = Math.max(y0, r.top); x1 = Math.min(x1, r.right); y1 = Math.min(y1, r.bottom);
      }
    }
    return { x0, y0, x1, y1 };
  };
  const describe = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { parts.unshift(`${s}#${e.id}`); break; }
      const cls = [...e.classList].filter((c) => /^[a-z][\w-]*$/i.test(c) && c.length < 22).slice(0, 3);
      if (cls.length) s += '.' + cls.join('.');
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  const onTop = (el, x, y) => {
    const hit = document.elementFromPoint(x, y);
    return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
  };

  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      /\S/.test(n.textContent) && !n.parentElement.closest('script,style,noscript,template,title') ? 1 : 2,
  });
  for (let n; (n = walker.nextNode()); ) {
    const el = n.parentElement;
    if (!inScope(el)) continue;
    const op = opacityChain(el);
    if (op <= 0.02) continue;
    const cs = getComputedStyle(el);
    const color = rgba(cs.webkitTextFillColor || cs.color);
    const clip = clipOf(el);
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      const x0 = Math.max(r.left, clip.x0), y0 = Math.max(r.top, clip.y0);
      const x1 = Math.min(r.right, clip.x1), y1 = Math.min(r.bottom, clip.y1);
      if (x1 - x0 < 4 || y1 - y0 < 6) continue;
      // keep only the columns of this line that nothing (fixed header, floating button) covers
      const ys = [y0 + 2, (y0 + y1) / 2, y1 - 2];
      const spans = [];
      let start = null;
      for (let x = x0 + 1; x <= x1 - 1; x += 3) {
        const vis = ys.every((y) => onTop(el, x, y));
        if (vis && start === null) start = x;
        if (!vis && start !== null) { spans.push([start, x - 2]); start = null; }
      }
      if (start !== null) spans.push([start, x1]);
      const size = parseFloat(cs.fontSize);
      const weight = +cs.fontWeight;
      for (const [sx0, sx1] of spans) {
        if (sx1 - sx0 < 4) continue;
        texts.push({
          t: n.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
          sel: describe(el),
          color, op: Math.round(op * 1000) / 1000, size, weight,
          large: size >= 24 || (size >= 18.66 && weight >= 700),
          x0: sx0, y0, x1: sx1, y1, partial: sx0 > x0 + 2 || sx1 < x1 - 2,
        });
      }
    }
  }

  /* focus rings: the outline each focusable would draw (read while it is keyboard-focused) */
  const prev = document.activeElement;
  const rings = [];
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')) {
    if (el.tabIndex < 0 || el.disabled || !inScope(el)) continue;
    if (opacityChain(el) <= 0.02) continue;
    // sr-only radios draw their ring on the label (has-[:focus-visible])
    const ringEl = el.matches('input.sr-only') ? el.closest('label') : el;
    if (!ringEl) continue;
    const rects = [...ringEl.getClientRects()].filter((r) => r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W);
    if (!rects.length) continue;
    const vis = rects.filter((r) => onTop(ringEl, (r.left + r.right) / 2, (r.top + r.bottom) / 2) || onTop(el, (r.left + r.right) / 2, (r.top + r.bottom) / 2));
    if (!vis.length) continue;
    el.focus({ preventScroll: true });
    const fv = el.matches(':focus-visible');
    const rcs = getComputedStyle(ringEl);
    const ring = {
      sel: describe(ringEl),
      label: (el.getAttribute('aria-label') || ringEl.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      focusVisible: fv,
      style: rcs.outlineStyle,
      width: parseFloat(rcs.outlineWidth) || 0,
      offset: parseFloat(rcs.outlineOffset) || 0,
      color: rgba(rcs.outlineColor),
      rects: vis.map((r) => ({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom })),
    };
    el.blur();
    rings.push(ring);
  }
  if (prev && prev !== document.body) prev.focus?.({ preventScroll: true });

  /* other UI components */
  const comps = [];
  const pushComp = (kind, el, color, band) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) return;
    if (opacityChain(el) <= 0.02 || !inScope(el)) return;
    if (!onTop(el, (r.left + r.right) / 2, (r.top + r.bottom) / 2) && !onTop(el.parentElement, (r.left + r.right) / 2, (r.top + r.bottom) / 2)) return;
    comps.push({ kind, sel: describe(el), color, band, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
  };
  document.querySelectorAll('.legend-dot').forEach((el) => {
    const active = !!el.closest('[aria-current]');
    const cs = getComputedStyle(el);
    pushComp(active ? 'legend dot (current stop)' : 'legend dot', el, rgba(active ? cs.backgroundColor : cs.borderTopColor), [1, 3]);
  });
  document.querySelectorAll('button[aria-controls="theme-options"] svg').forEach((el) =>
    pushComp('theme button icon', el, rgba(getComputedStyle(el).color), 'inside'),
  );
  document.querySelectorAll('#theme-options label svg').forEach((el) =>
    pushComp('theme menu option icon', el, rgba(getComputedStyle(el).color), 'inside'),
  );
  document.querySelectorAll('#theme-options .bg-accent').forEach((el) =>
    pushComp('theme menu selected dot', el, rgba(getComputedStyle(el).backgroundColor), [1, 3]),
  );
  document.querySelectorAll('.btn-ghost').forEach((el) =>
    pushComp('btn-ghost border', el, rgba(getComputedStyle(el).borderTopColor), [0.5, 3]),
  );
  const chips = [];
  document.querySelectorAll('.chip').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W || !inScope(el) || opacityChain(el) <= 0.02) return;
    if (!onTop(el, (r.left + r.right) / 2, (r.top + r.bottom) / 2)) return;
    const cs = getComputedStyle(el);
    chips.push({ sel: describe(el), t: el.textContent.trim().slice(0, 30), border: rgba(cs.borderTopColor), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
  });
  const root = document.documentElement;
  return {
    texts, rings, comps, chips,
    meta: {
      theme: root.dataset.theme, pref: root.dataset.themePref, stage: root.dataset.stage, scrollY: scrollY,
      glass: getComputedStyle(root).getPropertyValue('--glass').trim(),
      accent: getComputedStyle(root).getPropertyValue('--color-accent').trim(),
    },
  };
}

/* ── Node-side measuring ───────────────────────────────────────────────── */
async function decode(buf) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
const px = (img, x, y) => {
  const i = (y * img.w + x) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];

function measureText(it, bg, dpr) {
  const inset = (a, b, d) => (b - a > 2 * d + 2 ? [a + d, b - d] : [a, b]);
  const [cx0, cx1] = inset(it.x0, it.x1, 1);
  const [cy0, cy1] = inset(it.y0, it.y1, 2);
  const X0 = Math.max(0, Math.ceil(cx0 * dpr)), X1 = Math.min(bg.w, Math.floor(cx1 * dpr));
  const Y0 = Math.max(0, Math.ceil(cy0 * dpr)), Y1 = Math.min(bg.h, Math.floor(cy1 * dpr));
  const a = it.color[3] * it.op;
  const vals = [];
  let min = Infinity, worst = null;
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++) {
      const b = px(bg, x, y);
      const t = it.color.slice(0, 3).map((c, k) => a * c + (1 - a) * b[k]);
      const v = ratio(lum(...t), lum(...b));
      vals.push(v);
      if (v < min) { min = v; worst = b; }
    }
  if (!vals.length) return null;
  vals.sort((p, q) => p - q);
  const need = it.large ? 3 : 4.5;
  return { min: r2(min), p5: r2(pct(vals, 0.05)), med: r2(pct(vals, 0.5)), worstBg: hex(worst), need, pass: min >= need, below: r2(vals.filter((v) => v < need).length / vals.length) };
}

/* Chebyshev distance (CSS px) of a pixel centre from a rect: >0 outside, <=0 inside */
function dist(x, y, r) {
  const dx = Math.max(r.x0 - x, 0, x - r.x1);
  const dy = Math.max(r.y0 - y, 0, y - r.y1);
  if (dx > 0 || dy > 0) return Math.max(dx, dy);
  return -Math.min(x - r.x0, r.x1 - x, y - r.y0, r.y1 - y);
}
function band(img, dpr, r, lo, hi, color) {
  const pad = Math.max(hi, 0) + 1;
  const X0 = Math.max(0, Math.floor((r.x0 - pad) * dpr)), X1 = Math.min(img.w, Math.ceil((r.x1 + pad) * dpr));
  const Y0 = Math.max(0, Math.floor((r.y0 - pad) * dpr)), Y1 = Math.min(img.h, Math.ceil((r.y1 + pad) * dpr));
  const cl = lum(...color.slice(0, 3));
  const vals = [];
  let min = Infinity, worst = null;
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++) {
      const d = dist((x + 0.5) / dpr, (y + 0.5) / dpr, r);
      if (d <= lo || d > hi) continue;
      const b = px(img, x, y);
      const v = ratio(cl, lum(...b));
      vals.push(v);
      if (v < min) { min = v; worst = b; }
    }
  if (!vals.length) return null;
  vals.sort((p, q) => p - q);
  return { min: r2(min), p5: r2(pct(vals, 0.05)), med: r2(pct(vals, 0.5)), worstBg: hex(worst), below3: r2(vals.filter((v) => v < 3).length / vals.length), n: vals.length };
}
function median(img, dpr, r, lo, hi) {
  const ch = [[], [], []];
  const pad = Math.max(hi, 0) + 1;
  for (let y = Math.max(0, Math.floor((r.y0 - pad) * dpr)); y < Math.min(img.h, Math.ceil((r.y1 + pad) * dpr)); y++)
    for (let x = Math.max(0, Math.floor((r.x0 - pad) * dpr)); x < Math.min(img.w, Math.ceil((r.x1 + pad) * dpr)); x++) {
      const d = dist((x + 0.5) / dpr, (y + 0.5) / dpr, r);
      if (d <= lo || d > hi) continue;
      const p = px(img, x, y);
      for (let k = 0; k < 3; k++) ch[k].push(p[k]);
    }
  return ch.map((c) => (c.sort((a, b) => a - b), c[Math.floor(c.length / 2)] ?? 0));
}

const results = { base: BASE, when: new Date().toISOString(), views: [] };

async function measureView(page, name, dpr) {
  await page.mouse.move(2, 300).catch(() => {});
  await page.keyboard.press('Shift'); // keyboard modality, so programmatic focus matches :focus-visible
  const data = await page.evaluate(collect);
  await page.evaluate(() => document.activeElement && document.activeElement !== document.body && document.activeElement.blur());
  await page.waitForTimeout(150);
  const normalBuf = await page.screenshot({ path: `${SHOTS}/${name}.png` });
  const style = await page.addStyleTag({ content: HIDE });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const bgBuf = await page.screenshot({ path: `${SHOTS}/${name}-bg.png` });
  await style.evaluate((n) => n.remove());
  const [normal, bg] = [await decode(normalBuf), await decode(bgBuf)];

  const texts = data.texts.map((it) => ({ ...it, m: measureText(it, bg, dpr) })).filter((it) => it.m);
  const rings = data.rings.map((rg) => {
    const c = rg.color;
    const o = rg.offset, w = rg.width;
    const inner = o > 0 ? [0, o] : [-2, 0];
    const parts = rg.rects.map((r) => ({ inner: band(bg, dpr, r, inner[0], inner[1], c), outer: band(bg, dpr, r, o + w, o + w + 2, c) }));
    const worst = (k) => parts.map((p) => p[k]).filter(Boolean).sort((a, b) => a.min - b.min)[0] ?? null;
    return { ...rg, rects: undefined, x0: Math.round(rg.rects[0].x0), y0: Math.round(rg.rects[0].y0), inner: worst('inner'), outer: worst('outer'), ringColor: hex(c) };
  });
  const comps = data.comps.map((cp) => {
    const r = cp;
    const m = cp.band === 'inside' ? band(bg, dpr, r, -999, 0, cp.color) : band(bg, dpr, r, cp.band[0], cp.band[1], cp.color);
    return { kind: cp.kind, sel: cp.sel, color: hex(cp.color), x0: Math.round(r.x0), y0: Math.round(r.y0), m };
  });
  const chips = data.chips.slice(0, 8).map((c) => {
    const edge = median(normal, dpr, c, -1, 0);
    const out = median(normal, dpr, c, 1.5, 4);
    const fill = median(bg, dpr, c, -999, -3);
    return { t: c.t, sel: c.sel, edge: hex(edge), outside: hex(out), fill: hex(fill), edgeVsOutside: r2(ratio(lum(...edge), lum(...out))), fillVsOutside: r2(ratio(lum(...fill), lum(...out))) };
  });
  const view = { name, meta: data.meta, texts, rings, comps, chips };
  results.views.push(view);
  const fails = texts.filter((t) => !t.m.pass);
  const lowRing = rings.filter((r) => (r.inner && r.inner.min < 3) || (r.outer && r.outer.min < 3));
  const lowComp = comps.filter((c) => c.m && c.m.min < 3);
  const minText = texts.reduce((a, t) => Math.min(a, t.m.min / t.m.need), Infinity);
  console.log(
    `${name.padEnd(34)} theme=${data.meta.theme} stage=${data.meta.stage} texts=${texts.length} fail=${fails.length} ` +
      `worst(text ratio/need)=${r2(minText)} rings=${rings.length} ringLow=${lowRing.length} compLow=${lowComp.length}`,
  );
  for (const f of fails) console.log(`   TEXT ${f.m.min}:1 (p5 ${f.m.p5}, med ${f.m.med}, need ${f.m.need}) ${hex(f.color)} on ${f.m.worstBg} ${f.size}px/${f.weight} "${f.t}" [${f.sel}]`);
  for (const r of lowRing) console.log(`   RING ${r.ringColor} "${r.label}" inner min ${r.inner?.min} (below3 ${r.inner?.below3}) on ${r.inner?.worstBg} | outer min ${r.outer?.min} (below3 ${r.outer?.below3}) on ${r.outer?.worstBg} [${r.sel}] fv=${r.focusVisible}`);
  for (const c of lowComp) console.log(`   COMP ${c.kind} ${c.color} min ${c.m.min} (p5 ${c.m.p5}) on ${c.m.worstBg} [${c.sel}]`);
  return view;
}

const settle = (page, ms) => page.waitForTimeout(ms);
async function jumpTo(page, sel) {
  await page.evaluate(async (s) => {
    document.documentElement.classList.add('stops-laid-out');
    await new Promise((r) => setTimeout(r, 300));
    document.querySelector(s).scrollIntoView({ behavior: 'instant', block: 'start' });
  }, sel);
}
/** measure a section, then keep scrolling while its card runs below the screen */
async function measureSection(page, id, prefix, dpr, wait) {
  await jumpTo(page, `#${id}`);
  await settle(page, wait);
  await measureView(page, `${prefix}-${id}`, dpr);
  for (let step = 1; step <= 5; step++) {
    const more = await page.evaluate((i) => {
      const card = document.querySelector(`#${i} .card`);
      const r = card.getBoundingClientRect();
      if (r.bottom <= innerHeight - 8) return false;
      window.scrollBy({ top: Math.min(r.bottom - innerHeight + 24, innerHeight - 180), behavior: 'instant' });
      return true;
    }, id);
    if (!more) break;
    await settle(page, wait);
    await measureView(page, `${prefix}-${id}-s${step}`, dpr);
  }
}

const SECTIONS = ['about', 'experience', 'epost', 'client-work', 'workshop', 'education', 'contact'];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];

for (const theme of THEMES) {
  if (TARGETS.includes('desktop')) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${theme} desktop: ${e.message}`));
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.live.is-shown', { timeout: 30000 });
    await settle(page, 1500);
    const P = `d-${theme}`;
    await measureView(page, `${P}-hero`, 1);

    // landing note while the clouds clear
    const range = await page.evaluate(() => document.getElementById('city').offsetHeight - innerHeight);
    for (const f of [0.9, 0.93, 0.96, 1]) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(range * f));
      await settle(page, 1800);
      await measureView(page, `${P}-landing-${Math.round(f * 100)}`, 1);
    }

    for (const id of SECTIONS) await measureSection(page, id, P, 1, 2500);

    // project details dialogs (every project), top and scrolled to the bottom
    await jumpTo(page, '#workshop');
    await settle(page, 2000);
    const nDetails = await page.locator('.shelf-card button[aria-haspopup="dialog"]').count();
    for (let i = 0; i < nDetails; i++) {
      await page.locator('.shelf-card button[aria-haspopup="dialog"]').nth(i).click();
      await page.waitForSelector('dialog.project-dialog[open]');
      await settle(page, 700);
      await measureView(page, `${P}-dialog${i + 1}`, 1);
      const scrolled = await page.evaluate(() => {
        const d = document.querySelector('dialog.project-dialog');
        if (d.scrollHeight <= d.clientHeight + 4) return false;
        d.scrollTop = d.scrollHeight;
        return true;
      });
      if (scrolled) { await settle(page, 400); await measureView(page, `${P}-dialog${i + 1}-end`, 1); }
      await page.keyboard.press('Escape');
      await page.waitForSelector('dialog.project-dialog[open]', { state: 'detached' }).catch(() => {});
      await settle(page, 300);
    }

    // theme menu, open over the hero
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await settle(page, 1800);
    await page.click('button[aria-controls="theme-options"]');
    await page.waitForSelector('#theme-options');
    await settle(page, 400);
    await measureView(page, `${P}-theme-menu`, 1);
    await page.keyboard.press('Escape');

    // real ring sanity: keyboard-focus the brand link and the theme button, screenshot the header
    await page.evaluate(() => document.activeElement?.blur());
    for (const [k, sel] of [['brand', 'header a[href="#city"]'], ['theme-btn', 'button[aria-controls="theme-options"]'], ['ticket-ghost', '.ticket-stub .btn-ghost']]) {
      await page.keyboard.press('Shift');
      const ok = await page.evaluate((s) => {
        const el = document.querySelector(s);
        el.focus({ preventScroll: true });
        return el === document.activeElement && el.matches(':focus-visible');
      }, sel);
      await page.waitForTimeout(100);
      await page.screenshot({ path: `${SHOTS}/${P}-focus-${k}.png` });
      results.views.push({ name: `${P}-focus-${k}`, focusCheck: { sel, focused: ok } });
    }
    await ctx.close();
  }

  if (TARGETS.includes('phone')) {
    const dev = devices['Pixel 7'];
    const ctx = await browser.newContext({ ...dev });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${theme} phone: ${e.message}`));
    await page.goto(`${BASE}/?mode=still`, { waitUntil: 'networkidle' });
    await settle(page, 2000);
    const P = `p-${theme}`;
    const dpr = dev.deviceScaleFactor;
    await measureView(page, `${P}-hero`, dpr);
    // the hero ticket can run below a phone screen: scroll it into full view too
    const ticketBottom = await page.evaluate(() => document.querySelector('.ticket-wrap').getBoundingClientRect().bottom);
    if (ticketBottom > (await page.evaluate(() => innerHeight))) {
      await page.evaluate((b) => window.scrollTo({ top: b - innerHeight + 24, behavior: 'instant' }), ticketBottom);
      await settle(page, 1500);
      await measureView(page, `${P}-hero-s1`, dpr);
    }
    for (const id of ['experience', 'workshop', 'contact']) await measureSection(page, id, P, dpr, 1800);
    await ctx.close();
  }

  if (TARGETS.includes('resume')) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${theme} resume: ${e.message}`));
    await page.goto(`${BASE}/resume/`, { waitUntil: 'networkidle' });
    await settle(page, 800);
    const P = `r-${theme}`;
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    let step = 0;
    for (let y = 0; ; y += 760, step++) {
      await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), Math.min(y, total));
      await settle(page, 250);
      await measureView(page, `${P}-resume-${step}`, 1);
      if (y >= total) break;
    }
    await ctx.close();
  }
}
await browser.close();
results.errors = errors;
const tag = `${THEMES.join('-')}_${TARGETS.join('-')}`;
writeFileSync(`qa/qa-contrast-results-${tag}.json`, JSON.stringify(results, null, 1));
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
console.log(`wrote qa/qa-contrast-results-${tag}.json`);
