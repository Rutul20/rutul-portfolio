// Theme preview: "Brand-tinted dusk" (slug: dusk-brand).
// Injects a flat page colour + tinted glass cards (light and dark), screenshots four stops of the live
// tour per theme, measures WCAG contrast of the text tokens against the real rendered card pixels,
// and builds a 2x4 contact sheet. Nothing in src/ is touched.
// Usage: cd /d/rutul-portfolio && node qa/theme-dusk-brand.mjs
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SLUG = 'dusk-brand';
const BASE = 'http://localhost:3100/?mode=live';
const OUT = 'qa/shots';
mkdirSync(OUT, { recursive: true });

// ── Theme tokens (the only thing that differs between light and dark) ──────────────────────────
const LIGHT = `
:root {
  color-scheme: light;
  --page-bg: #d8cfe4;                         /* misty lilac, flat */
  --color-ink: #251b38;
  --color-ink-soft: #463b5b;
  --color-plum: #7a2955;                      /* dusk rose */
  --color-teal: #235b56;
  --color-cream: #fbf8ff;                     /* solid surface + text on ink */
  --color-paper: rgb(255 255 255 / 0.62);     /* chips, hover fills */
  --color-line: rgb(84 62 136 / 0.22);
  --glass: rgb(249 245 255 / 0.76);           /* lilac-white frost */
  --glass-strong: rgb(250 247 255 / 0.86);    /* header pills, map rail */
  --glass-solid: rgb(246 242 252 / 0.96);     /* phones / no-blur fallback */
  --glass-tile: rgb(255 255 255 / 0.42);      /* cards inside a card */
  --glass-filter: blur(18px) saturate(1.2);
  --glass-rim: rgb(255 255 255 / 0.75);
  --glass-edge: rgb(76 52 128 / 0.14);
  --glass-highlight: rgb(255 255 255 / 0.95);
  --glass-glow: radial-gradient(120% 70% at 0% 0%, rgb(240 160 186 / 0.2), transparent 58%);
  --shadow-card: 0 1px 0 rgb(43 33 64 / 0.04), 0 26px 50px -30px rgb(52 30 96 / 0.5);
  --btn-primary-hover: #3b2e57;
}`;

const DARK = `
@media screen { /* screen only: print always gets the light tokens */
:root {
  color-scheme: dark;
  --page-bg: #1d1630;                         /* aubergine night, flat */
  --color-ink: #f5f0fc;
  --color-ink-soft: #cfc4e2;
  --color-plum: #f4a9ca;                      /* dusk rose, lifted for the dark */
  --color-teal: #8ed3c9;
  --color-cream: #1b1429;                     /* solid surface + text on ink */
  --color-paper: rgb(255 255 255 / 0.09);
  --color-line: rgb(214 196 255 / 0.2);
  --glass: rgb(37 27 60 / 0.72);              /* indigo-violet frost */
  --glass-strong: rgb(37 27 60 / 0.82);
  --glass-solid: rgb(33 24 54 / 0.96);
  --glass-tile: rgb(255 255 255 / 0.045);
  --glass-filter: blur(18px) saturate(1.3) brightness(0.72);
  --glass-rim: rgb(226 208 255 / 0.17);
  --glass-edge: rgb(8 4 20 / 0.35);
  --glass-highlight: rgb(255 236 248 / 0.2);
  --glass-glow: radial-gradient(120% 70% at 0% 0%, rgb(236 128 172 / 0.14), transparent 58%);
  --shadow-card: 0 1px 0 rgb(0 0 0 / 0.2), 0 26px 60px -26px rgb(6 2 18 / 0.75);
  --btn-primary-hover: #ffffff;
}
}`;

// ── Shared rules: reference tokens only, identical for both themes ─────────────────────────────
const SHARED = `
:root {
  --glass-fill: var(--glass);
  --glass-fill-strong: var(--glass-strong);
  --glass-fx: var(--glass-filter);
}
/* phones, reduced transparency, no backdrop-filter: same colours, near-opaque, no live blur */
@media (max-width: 767px), (prefers-reduced-transparency: reduce) {
  :root { --glass-fill: var(--glass-solid); --glass-fill-strong: var(--glass-solid); --glass-fx: none; }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :root { --glass-fill: var(--glass-solid); --glass-fill-strong: var(--glass-solid); }
}

html { background: var(--page-bg) !important; }
.sky { background: var(--page-bg) !important; }

.card, .landing-note, .ticket-main, .ticket-stub,
header [class*="bg-cream/95"] {
  background-color: var(--glass-fill) !important;
  -webkit-backdrop-filter: var(--glass-fx);
  backdrop-filter: var(--glass-fx);
}
header [class*="bg-cream/95"] { background-color: var(--glass-fill-strong) !important; }
.card, .landing-note, header [class*="bg-cream/95"] {
  border: 1px solid var(--glass-rim) !important;
  box-shadow: inset 0 1px 0 var(--glass-highlight), 0 0 0 1px var(--glass-edge), var(--shadow-card) !important;
}
/* the dusk afterglow: last light catching each card's top-left corner */
.card, .landing-note, .ticket-main { background-image: var(--glass-glow); }

/* ticket: keep the punched-notch mask; the drop-shadow filter would hide the backdrop from the
   blur (a filter makes a backdrop root), so the shadow moves to a box-shadow on the wrapper
   (outer shadows never paint under the translucent card) */
.ticket-wrap { filter: none !important; border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.ticket-main { box-shadow: inset 0 1px 0 var(--glass-highlight), inset 1px 0 0 var(--glass-rim), inset -1px 0 0 var(--glass-rim); }
.ticket-stub { box-shadow: inset 0 -1px 0 var(--glass-rim), inset 1px 0 0 var(--glass-rim), inset -1px 0 0 var(--glass-rim); }

/* cards inside a card: a little more frost, no second blur */
#client-work li, .shelf-card { background-color: var(--glass-tile) !important; border-color: var(--color-line) !important; }
/* the dropdown map sits inside the header pill (a backdrop root), so it gets the solid fill */
#tour-map { background-color: var(--glass-solid) !important; -webkit-backdrop-filter: none; backdrop-filter: none; }

.btn-primary:hover { background: var(--btn-primary-hover); }
/* always-dark bits keep fixed colours in both themes */
.bg-ink.text-glow { background-color: #2b2140 !important; box-shadow: inset 0 0 0 1px var(--glass-rim); }
.enter-3d, .shelf-tile { color: #fff8f0; }
`;

const themes = { light: LIGHT + SHARED, dark: DARK + SHARED };

// ── Measurement regions per shot ───────────────────────────────────────────────────────────────
const HEADER = { name: 'header pills', sel: 'header [class*="bg-cream/95"]:not(.legend-rail)', all: true, roles: ['body'], inset: 3 };
const RAIL = { name: 'map rail', sel: '.legend-rail', roles: ['body', 'soft'], inset: 4 };
const CARD_ROLES = ['body', 'soft', 'accent'];
const SHOTS = [
  {
    key: 'hero',
    target: null,
    regions: [
      { name: 'ticket main', sel: '.ticket-main', roles: CARD_ROLES, corner: 24, skip: '.chip' },
      { name: 'ticket stub', sel: '.ticket-stub', roles: CARD_ROLES, corner: 24, inset: 8 },
      { name: 'ticket chips', sel: '.ticket-main .chip:not([class*="bg-ink"])', all: true, roles: ['body'], inset: 1.5 },
      HEADER,
      RAIL,
    ],
  },
  { key: 'experience', target: '#experience', regions: [{ name: 'experience card', sel: '#experience .card', roles: CARD_ROLES }, HEADER, RAIL] },
  {
    key: 'client-work',
    target: '#client-work',
    regions: [
      { name: 'client card', sel: '#client-work .card', roles: CARD_ROLES, skip: '#client-work li' },
      { name: 'client tiles', sel: '#client-work li', all: true, roles: CARD_ROLES, skip: '.chip' },
      { name: 'client chips', sel: '#client-work .chip', all: true, roles: ['body'], inset: 1.5 },
      HEADER,
      RAIL,
    ],
  },
  { key: 'contact', target: '#contact', regions: [{ name: 'contact card', sel: '#contact .card', roles: CARD_ROLES }, HEADER, RAIL] },
];
// measured too, but not on the contact sheet (robustness: every other stop)
const EXTRA = [
  { key: 'about', target: '#about', regions: [{ name: 'about card', sel: '#about .card', roles: CARD_ROLES }, { name: 'about note', sel: '#about .bg-paper', roles: ['body'] }] },
  { key: 'epost', target: '#epost', regions: [{ name: 'epost card', sel: '#epost .card', roles: CARD_ROLES, skip: '.chip' }, { name: 'epost chips', sel: '#epost .chip', all: true, roles: ['body'], inset: 1.5 }] },
  { key: 'workshop', target: '#workshop', regions: [{ name: 'workshop card', sel: '#workshop .card', roles: CARD_ROLES, skip: '.shelf-card' }, { name: 'shelf cards', sel: '.shelf-card', all: true, roles: [...CARD_ROLES, 'teal'], skip: '.shelf-tile' }] },
  { key: 'education', target: '#education', regions: [{ name: 'education card', sel: '#education .card', roles: CARD_ROLES }] },
];
const ORDER = ['hero', 'about', 'experience', 'epost', 'client-work', 'workshop', 'education', 'contact'].map((k) => [...SHOTS, ...EXTRA].find((s) => s.key === k));

// Runs in the page: region rectangles + rectangles to exclude (text, things with their own fill, borders, bullets).
function collectRegions(regions) {
  const vw = innerWidth;
  const vh = innerHeight;
  const out = [];
  const rect = (r, p = 0, pb = p) => [r.left - p, r.top - p, r.right + p, r.bottom + pb];
  for (const spec of regions) {
    const roots = spec.all ? [...document.querySelectorAll(spec.sel)] : [document.querySelector(spec.sel)].filter(Boolean);
    for (const root of roots) {
      const r = root.getBoundingClientRect();
      if (r.width < 20 || r.height < 12 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
      const cs = getComputedStyle(root);
      const ex = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (!n.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const tr of range.getClientRects()) ex.push(rect(tr, 3, 7)); // 7px below covers underlines
      }
      for (const el of root.querySelectorAll('*')) {
        const er = el.getBoundingClientRect();
        if (er.width === 0 || er.height === 0) continue;
        if (spec.skip && el.matches(spec.skip)) {
          ex.push(rect(er, 3));
          continue;
        }
        const ecs = getComputedStyle(el);
        const bg = ecs.backgroundColor;
        const hasFill = (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') || ecs.backgroundImage !== 'none';
        // line-clamp / truncate draw an ellipsis glyph that is not part of any text-node rect
        const clamps = (ecs.webkitLineClamp && ecs.webkitLineClamp !== 'none') || ecs.textOverflow === 'ellipsis';
        if (hasFill || clamps || /^(IMG|svg|CANVAS|VIDEO|PICTURE)$/i.test(el.tagName)) {
          ex.push(rect(er, 3));
          continue;
        }
        const bw = (s) => parseFloat(ecs[`border${s}Width`]) || 0;
        if (bw('Top')) ex.push([er.left - 3, er.top - 3, er.right + 3, er.top + bw('Top') + 3]);
        if (bw('Bottom')) ex.push([er.left - 3, er.bottom - bw('Bottom') - 3, er.right + 3, er.bottom + 3]);
        if (bw('Left')) ex.push([er.left - 3, er.top - 3, er.left + bw('Left') + 3, er.bottom + 3]);
        if (bw('Right')) ex.push([er.right - bw('Right') - 3, er.top - 3, er.right + 3, er.bottom + 3]);
        // rounded bordered things (pill buttons, tiles): the curved border runs through the corner squares
        const rr = Math.min(parseFloat(ecs.borderTopLeftRadius) || 0, er.height / 2, er.width / 2);
        if ((bw('Top') || bw('Left')) && rr > 2) {
          const c = rr + 3;
          ex.push([er.left - 3, er.top - 3, er.left + c, er.top + c], [er.right - c, er.top - 3, er.right + 3, er.top + c]);
          ex.push([er.left - 3, er.bottom - c, er.left + c, er.bottom + 3], [er.right - c, er.bottom - c, er.right + 3, er.bottom + 3]);
        }
        for (const ps of ['::before', '::after']) {
          const c = getComputedStyle(el, ps).content;
          if (c && c !== 'none' && c !== 'normal') {
            const pl = Math.max(parseFloat(ecs.paddingLeft) || 0, 12);
            ex.push([er.left - 3, er.top - 3, er.left + pl + 3, er.bottom + 3]);
          }
        }
      }
      const radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.height / 2, r.width / 2);
      out.push({ name: spec.name, roles: spec.roles, box: [r.left, r.top, r.right, r.bottom], radius, corner: spec.corner || 0, inset: spec.inset ?? 6, ex });
    }
  }
  const probe = (v) => {
    const s = document.createElement('span');
    s.style.color = `var(${v})`;
    document.body.appendChild(s);
    const c = getComputedStyle(s).color;
    s.remove();
    return c;
  };
  return { regions: out, colors: { body: probe('--color-ink'), soft: probe('--color-ink-soft'), accent: probe('--color-plum'), teal: probe('--color-teal'), cream: probe('--color-cream') } };
}

// ── WCAG maths ─────────────────────────────────────────────────────────────────────────────────
const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const parseRgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);

function measure(raw, info, W, H) {
  const { data, info: meta } = raw;
  const ch = meta.channels;
  const textL = Object.fromEntries(Object.entries(info.colors).map(([k, v]) => [k, lum(...parseRgb(v))]));
  const results = [];
  for (const reg of info.regions) {
    const [l, t, r, b] = reg.box;
    const x0 = Math.max(0, Math.ceil(l)), y0 = Math.max(0, Math.ceil(t));
    const x1 = Math.min(W, Math.floor(r)), y1 = Math.min(H, Math.floor(b));
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) continue;
    const mask = new Uint8Array(w * h);
    for (const [el, et, er, eb] of reg.ex) {
      const ax = Math.max(x0, Math.floor(el)), ay = Math.max(y0, Math.floor(et));
      const bx = Math.min(x1, Math.ceil(er)), by = Math.min(y1, Math.ceil(eb));
      for (let y = ay; y < by; y++) mask.fill(1, (y - y0) * w + (ax - x0), (y - y0) * w + (bx - x0));
    }
    const ins = reg.inset;
    const rad = Math.max(0, reg.radius - ins);
    const L = [];
    const pts = [];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (mask[(y - y0) * w + (x - x0)]) continue;
        // inside the rounded box, inset from the edge (rim, highlight and anti-aliasing stay out)
        const px = x + 0.5, py = y + 0.5;
        if (px < l + ins || px > r - ins || py < t + ins || py > b - ins) continue;
        const il = l + ins, it = t + ins, ir = r - ins, ib = b - ins;
        if (reg.corner) {
          const c = reg.corner;
          if ((px < l + c || px > r - c) && (py < t + c || py > b - c)) continue; // square corners (ticket notches)
        } else if (rad > 0) {
          const cx = px < il + rad ? il + rad : px > ir - rad ? ir - rad : px;
          const cy = py < it + rad ? it + rad : py > ib - rad ? ib - rad : py;
          if ((px - cx) ** 2 + (py - cy) ** 2 > rad * rad) continue;
        }
        const i = (y * W + x) * ch;
        L.push(lum(data[i], data[i + 1], data[i + 2]));
        pts.push(x, y);
      }
    }
    if (!L.length) continue;
    const res = { name: reg.name, n: L.length, roles: {} };
    for (const role of reg.roles) {
      const tl = textL[role];
      let worst = Infinity, wi = 0;
      const all = new Float64Array(L.length);
      for (let k = 0; k < L.length; k++) {
        const c = ratio(tl, L[k]);
        all[k] = c;
        if (c < worst) { worst = c; wi = k; }
      }
      all.sort();
      res.roles[role] = { min: +worst.toFixed(2), p10: +all[Math.floor(all.length * 0.1)].toFixed(2), at: [pts[wi * 2], pts[wi * 2 + 1]] };
    }
    results.push(res);
  }
  return results;
}

// ── Run ────────────────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const W = 1440, H = 900;
const tiles = {};
const summary = {};

async function openThemed(theme, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: themes[theme] });
  await page.waitForTimeout(500);
  return page;
}

for (const theme of ['light', 'dark']) {
  const page = await openThemed(theme, { width: W, height: H });
  const agg = { body: [Infinity, ''], soft: [Infinity, ''], accent: [Infinity, ''], teal: [Infinity, ''] };
  for (const shot of ORDER) {
    if (shot.target) {
      await page.evaluate((s) => document.querySelector(s).scrollIntoView({ behavior: 'instant', block: 'start' }), shot.target);
      await page.waitForTimeout(1600);
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(800);
    }
    const info = await page.evaluate(collectRegions, shot.regions);
    const tiled = SHOTS.includes(shot);
    const buf = await page.screenshot(tiled ? { path: `${OUT}/theme-${SLUG}-${theme}-${shot.key}.png` } : {});
    if (tiled) tiles[`${theme}-${shot.key}`] = buf;
    const raw = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    const res = measure(raw, info, W, H);
    console.log(`\n[${theme}] ${shot.key}  text: body ${info.colors.body} | soft ${info.colors.soft} | accent ${info.colors.accent}`);
    for (const r of res) {
      const parts = Object.entries(r.roles).map(([k, v]) => `${k} min ${v.min} (p10 ${v.p10}) @${v.at.join(',')}`);
      console.log(`  ${r.name.padEnd(16)} n=${String(r.n).padStart(6)}  ${parts.join(' | ')}`);
      for (const [k, v] of Object.entries(r.roles)) if (v.min < agg[k][0]) agg[k] = [v.min, `${shot.key}/${r.name}`];
    }
    if (shot.key === 'hero') {
      // extras for the landing check: clouds over the globe, then clearing over the city
      for (const v of [0.68, 0.93]) {
        await page.evaluate((v) => {
          const hero = document.getElementById('city');
          window.scrollTo(0, v * (hero.offsetHeight - innerHeight));
        }, v);
        await page.waitForTimeout(1600);
        const linfo = await page.evaluate(collectRegions, [{ name: 'landing note', sel: '.landing-note', roles: CARD_ROLES }]);
        const lbuf = await page.screenshot({ path: `${OUT}/theme-${SLUG}-${theme}-landing-${Math.round(v * 100)}.png` });
        for (const r of measure(await sharp(lbuf).raw().toBuffer({ resolveWithObject: true }), linfo, W, H)) {
          console.log(`  [landing ${v}] ${r.name} n=${r.n}  ${Object.entries(r.roles).map(([k, x]) => `${k} min ${x.min}`).join(' | ')}`);
          for (const [k, x] of Object.entries(r.roles)) if (x.min < agg[k][0]) agg[k] = [x.min, `landing-${v}/${r.name}`];
        }
      }
    }
  }
  // solid-on-solid pairs (no backdrop involved)
  const c = await page.evaluate(() => {
    const p = (v) => { const s = document.createElement('span'); s.style.color = `var(${v})`; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; };
    return { ink: p('--color-ink'), cream: p('--color-cream') };
  });
  const btn = ratio(lum(...parseRgb(c.ink)), lum(...parseRgb(c.cream))).toFixed(2);
  summary[theme] = { body: agg.body, soft: agg.soft, accent: agg.accent, teal: agg.teal, primaryButton: btn };
  await page.close();
}

// phone fallback check (no blur, near-opaque fill) on the longest card
for (const theme of ['light', 'dark']) {
  const page = await openThemed(theme, { width: 390, height: 844 });
  await page.evaluate(() => document.querySelector('#experience').scrollIntoView({ behavior: 'instant', block: 'start' }));
  await page.waitForTimeout(1600);
  const info = await page.evaluate(collectRegions, [{ name: 'experience card', sel: '#experience .card', roles: CARD_ROLES }]);
  const fx = await page.evaluate(() => getComputedStyle(document.querySelector('#experience .card')).backdropFilter);
  const buf = await page.screenshot({ path: `${OUT}/theme-${SLUG}-${theme}-phone-experience.png` });
  const res = measure(await sharp(buf).raw().toBuffer({ resolveWithObject: true }), info, 390, 844);
  for (const r of res) {
    const parts = Object.entries(r.roles).map(([k, v]) => `${k} min ${v.min}`);
    console.log(`\n[${theme}] phone ${r.name} (backdrop-filter: ${fx}) n=${r.n}  ${parts.join(' | ')}`);
    summary[theme].phone = Object.fromEntries(Object.entries(r.roles).map(([k, v]) => [k, v.min]));
  }
  await page.close();
}
await browser.close();

// ── Contact sheet: rows light/dark × hero, experience, client work, contact ───────────────────
const TW = 480, TH = 300;
const comps = [];
const labels = [];
for (const [row, theme] of ['light', 'dark'].entries()) {
  for (const [col, shot] of SHOTS.entries()) {
    const img = await sharp(tiles[`${theme}-${shot.key}`]).resize(TW, TH).toBuffer();
    comps.push({ input: img, left: col * TW, top: row * TH });
    const text = `${theme} · ${shot.key}`;
    labels.push(`<g transform="translate(${col * TW + 8},${row * TH + TH - 26})"><rect width="${text.length * 7 + 14}" height="18" rx="9" fill="rgb(20 14 36 / 0.72)"/><text x="7" y="13" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#fff">${text}</text></g>`);
  }
}
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TW * 4}" height="${TH * 2}">${labels.join('')}</svg>`);
comps.push({ input: svg, left: 0, top: 0 });
const sheet = `${OUT}/theme-${SLUG}.jpg`;
await sharp({ create: { width: TW * 4, height: TH * 2, channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 86 }).toFile(sheet);

console.log('\n── summary (min WCAG ratio vs worst sampled glass pixel) ──');
for (const [t, s] of Object.entries(summary)) {
  console.log(`${t}: body ${s.body[0]} [${s.body[1]}] | soft ${s.soft[0]} [${s.soft[1]}] | accent ${s.accent[0]} [${s.accent[1]}] | teal ${s.teal[0]} [${s.teal[1]}] | primary button ${s.primaryButton} | phone ${JSON.stringify(s.phone)}`);
}
console.log('sheet:', sheet);
