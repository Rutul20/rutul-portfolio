// Theme preview: "Complementary pop" (slug contrast-pop).
// Flat cool sky (sea-glass mint / deep petrol) against the warm terracotta city, cool-tinted frosted
// glass cards with a crisp hairline edge and a coral "roof-line", coral accents that echo the roofs.
// Injects the palette as CSS overrides (no source changes), screenshots 4 views per theme, measures
// WCAG contrast from the rendered pixels and builds a 2x4 contact sheet.
// Usage: node qa/theme-contrast-pop.mjs
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const SLUG = 'contrast-pop';
const URL = 'http://localhost:3100/?mode=live';
const OUT = 'qa/shots';
mkdirSync(OUT, { recursive: true });

/* ── Theme tokens ─────────────────────────────────────────────────────────── */
const LIGHT = `
:root {
  --page-bg: #c6e6df;                         /* sea-glass mint: complementary to terracotta */
  --color-ink: #0e2b2f;                       /* petrol ink */
  --color-ink-soft: #2c4f54;
  --color-plum: #963723;                      /* accent text: brick coral (links, kicker, focus) */
  --accent-fill: #bb4d31;                     /* accent fill: roof terracotta (buttons, roof-line) */
  --color-teal: #1f6660;
  --color-cream: #f2faf7;                     /* solid surface (dialogs, text on dark fills) */
  --color-paper: rgb(186 224 215 / 0.72);     /* chips, tinted panels */
  --color-line: rgb(14 43 47 / 0.16);
  --on-accent: #ffffff;
  --accent-hover: #a2412a;
  --glass-bg: rgb(240 250 246 / 0.82);
  --glass-solid: #eef8f5;                     /* phones / no backdrop-filter / reduced transparency */
  --glass-filter: blur(20px) saturate(1.1);
  --glass-edge: rgb(14 80 76 / 0.24);
  --glass-sheen: inset 0 1px 0 rgb(255 255 255 / 0.95), inset 0 0 0 1px rgb(255 255 255 / 0.4);
  --glass-roof: inset 0 3px 0 0 var(--accent-fill);
  --shadow-card: 0 1px 0 rgb(14 43 47 / 0.04), 0 24px 60px -28px rgb(14 43 47 / 0.5);
  --scrim: rgb(8 34 38 / 0.55);
  --cloud-fill: radial-gradient(ellipse at 50% 50%, #fbfefd 0%, #eaf7f3 55%, #d4ece6 100%);
  --cloud-core: rgb(251 254 253 / 0.97);
  --cloud-mid: rgb(234 247 243 / 0.75);
  color-scheme: light;
}`;

const DARK = `
:root {
  --page-bg: #0f2f36;                         /* deep petrol */
  --color-ink: #e8f5f1;
  --color-ink-soft: #b0ccc8;
  --color-plum: #ff9b7d;                      /* accent text: lit roof coral */
  --accent-fill: #ff9b7d;
  --color-teal: #82d4c6;
  --color-cream: #0f272c;
  --color-paper: rgb(130 212 198 / 0.14);
  --color-line: rgb(176 220 212 / 0.2);
  --on-accent: #0e2b2f;
  --accent-hover: #ffb8a3;
  --glass-bg: rgb(11 33 38 / 0.78);
  --glass-solid: #0f2a30;
  --glass-filter: blur(20px) saturate(1.2);
  --glass-edge: rgb(150 225 212 / 0.22);
  --glass-sheen: inset 0 1px 0 rgb(200 255 245 / 0.14), inset 0 0 0 1px rgb(200 255 245 / 0.04);
  --glass-roof: inset 0 3px 0 0 var(--accent-fill);
  --shadow-card: 0 1px 0 rgb(0 0 0 / 0.2), 0 24px 60px -24px rgb(0 0 0 / 0.65);
  --scrim: rgb(4 18 21 / 0.7);
  --cloud-fill: radial-gradient(ellipse at 50% 50%, #7e9fa5 0%, #4f7178 55%, #2a4c53 100%);
  --cloud-core: rgb(140 170 175 / 0.97);
  --cloud-mid: rgb(95 128 134 / 0.75);
  color-scheme: dark;
}`;

/* ── Components (theme-agnostic: they only read tokens) ───────────────────── */
const COMPONENTS = `
html { background: var(--page-bg) !important; color: var(--color-ink); }
.sky { background: var(--page-bg) !important; }

/* frosted glass surfaces */
.card, .landing-note, .legend-rail, [class*="bg-cream"], .ticket-main, .ticket-stub {
  background-color: var(--glass-bg) !important;
  -webkit-backdrop-filter: var(--glass-filter);
  backdrop-filter: var(--glass-filter);
}
.card, .landing-note, .legend-rail, [class*="bg-cream"] {
  border: 1px solid var(--glass-edge) !important;
  box-shadow: var(--glass-sheen), var(--shadow-card) !important;
}
/* the coral roof-line: content cards only */
.card { box-shadow: var(--glass-roof), var(--glass-sheen), var(--shadow-card) !important; }

/* ticket: the wrap's drop-shadow filter would isolate the children's backdrop blur, so the shadow
   moves to a pseudo behind it; the notch masks stay on the halves */
.ticket-wrap { filter: none !important; position: relative; }
.ticket-wrap::before {
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  border-radius: var(--radius-card); box-shadow: var(--shadow-card);
}
.ticket-main { border: 1px solid var(--glass-edge); border-bottom: 0; box-shadow: var(--glass-roof), var(--glass-sheen); }
.ticket-stub { border: 1px solid var(--glass-edge); border-top: 0; }

.chip { background: var(--color-paper); }
.shelf-card { background: var(--color-paper) !important; border-color: var(--color-line) !important; }
#client-work li { background: color-mix(in oklab, var(--color-paper) 55%, transparent); }

.btn-primary { background: var(--accent-fill) !important; color: var(--on-accent) !important; }
.btn-primary:hover { background: var(--accent-hover) !important; }
[class~="bg-ink"][class~="text-glow"] { background: var(--accent-fill); color: var(--on-accent); }

.enter-3d { background: var(--glass-bg); color: var(--color-ink); border: 1px solid var(--glass-edge);
  -webkit-backdrop-filter: var(--glass-filter); backdrop-filter: var(--glass-filter); }
.project-dialog { background: var(--color-cream); }
.project-dialog::backdrop { background: var(--scrim); }

.cloud-fill { background: var(--cloud-fill) !important; }
.cloud { background: radial-gradient(closest-side, var(--cloud-core), var(--cloud-mid) 50%, transparent 100%) !important; }

/* phones (GPU-poor), no backdrop-filter support, or reduced transparency: near-opaque, no blur */
@media (max-width: 767px), (prefers-reduced-transparency: reduce) {
  .card, .landing-note, .legend-rail, [class*="bg-cream"], .ticket-main, .ticket-stub, .enter-3d {
    -webkit-backdrop-filter: none; backdrop-filter: none;
    background-color: var(--glass-solid) !important;
  }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .card, .landing-note, .legend-rail, [class*="bg-cream"], .ticket-main, .ticket-stub, .enter-3d {
    background-color: var(--glass-solid) !important;
  }
}`;

const TEXT_OFF = `.site-ui, .site-ui * { color: transparent !important; -webkit-text-fill-color: transparent !important;
  text-decoration-color: transparent !important; text-shadow: none !important; }`;

/* ── WCAG helpers ─────────────────────────────────────────────────────────── */
const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const parseRgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);

const views = [
  { key: 'top', sel: null },
  { key: 'experience', sel: '#experience' },
  { key: 'client-work', sel: '#client-work' },
  { key: 'contact', sel: '#contact' },
];

async function collectText(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.site-ui');
    const hidden = (el) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return true;
        if (cs.clipPath && cs.clipPath.startsWith('inset(50%')) return true;
        if (cs.overflow === 'hidden' && e.getBoundingClientRect().width <= 2) return true;
      }
      return false;
    };
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode()); ) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (hidden(el)) continue;
      const cs = getComputedStyle(el);
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        const x0 = Math.ceil(Math.max(0, r.left)), y0 = Math.ceil(Math.max(0, r.top));
        const x1 = Math.floor(Math.min(innerWidth, r.right)), y1 = Math.floor(Math.min(innerHeight, r.bottom));
        if (x1 - x0 < 4 || y1 - y0 < 6) continue;
        // only text that is actually on top at its centre (not under the header, not off-card)
        const top = document.elementFromPoint((x0 + x1) / 2, (y0 + y1) / 2);
        if (!top || !(top === el || el.contains(top) || top.contains(el))) continue;
        const size = parseFloat(cs.fontSize), weight = +cs.fontWeight;
        out.push({ color: cs.color, x0, y0, x1, y1, large: size >= 24 || (size >= 18.66 && weight >= 700), text: n.textContent.trim().slice(0, 40) });
      }
    }
    return out;
  });
}

async function measure(buf, items, tokenColors) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const groups = {};
  for (const it of items) {
    const tc = parseRgb(it.color);
    const tl = lum(...tc);
    const name = Object.entries(tokenColors).find(([, c]) => c === it.color)?.[0] ?? `other ${it.color}`;
    const vals = [];
    for (let y = it.y0 + 1; y < it.y1 - 1; y++)
      for (let x = it.x0 + 1; x < it.x1 - 1; x++) {
        const i = (y * info.width + x) * 3;
        vals.push(ratio(tl, lum(data[i], data[i + 1], data[i + 2])));
      }
    if (!vals.length) continue;
    vals.sort((a, b) => a - b);
    const min = vals[0], p10 = vals[Math.floor(vals.length * 0.1)];
    const g = (groups[name] ??= { min: Infinity, p10: Infinity, worst: '', n: 0, large: true });
    g.n++;
    g.large &&= it.large;
    if (min < g.min) { g.min = min; g.worst = it.text; }
    g.p10 = Math.min(g.p10, p10);
  }
  for (const g of Object.values(groups)) { g.min = +g.min.toFixed(2); g.p10 = +g.p10.toFixed(2); }
  return groups;
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = {};
const tiles = [];

for (const [theme, tokens] of [['light', LIGHT], ['dark', DARK]]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: tokens + COMPONENTS });
  const tokenColors = await page.evaluate(() => {
    const probe = document.createElement('span');
    document.body.append(probe);
    const get = (v) => ((probe.style.color = `var(${v})`), getComputedStyle(probe).color);
    const c = { body: get('--color-ink'), soft: get('--color-ink-soft'), accent: get('--color-plum') };
    probe.remove();
    return c;
  });
  results[theme] = {};
  for (const v of views) {
    if (v.sel) await page.evaluate((s) => document.querySelector(s).scrollIntoView({ behavior: 'instant', block: 'start' }), v.sel);
    else await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(1600);
    const items = await collectText(page);
    const file = `${OUT}/theme-${SLUG}-${theme}-${v.key}.png`;
    const shot = await page.screenshot({ path: file });
    const off = await page.addStyleTag({ content: TEXT_OFF });
    await page.waitForTimeout(60);
    const bare = await page.screenshot();
    await off.evaluate((n) => n.remove());
    results[theme][v.key] = await measure(bare, items, tokenColors);
    tiles.push(shot);
  }
  // landing clouds + globe dive, for judging the clouds against the flat background
  const range = await page.evaluate(() => document.getElementById('city').offsetHeight - innerHeight);
  for (const f of [0.4, 0.72, 0.8]) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(range * f));
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${OUT}/theme-${SLUG}-${theme}-dive-${Math.round(f * 100)}.png` });
  }
  await page.close();

  // phone: the no-blur fallback over the city
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await phone.goto(URL, { waitUntil: 'networkidle' });
  await phone.waitForSelector('.live.is-shown', { timeout: 30000 }).catch(() => {});
  await phone.waitForTimeout(1500);
  await phone.addStyleTag({ content: tokens + COMPONENTS });
  await phone.evaluate(() => document.querySelector('#experience').scrollIntoView({ behavior: 'instant', block: 'start' }));
  await phone.waitForTimeout(1600);
  const pItems = await collectText(phone);
  await phone.screenshot({ path: `${OUT}/theme-${SLUG}-${theme}-phone-experience.png` });
  const pOff = await phone.addStyleTag({ content: TEXT_OFF });
  await phone.waitForTimeout(60);
  results[theme]['phone-experience'] = await measure(await phone.screenshot(), pItems, tokenColors);
  await pOff.evaluate((n) => n.remove());
  await phone.close();
}
await browser.close();

// contact sheet: 2 rows (light, dark) x 4 columns, 480x300 tiles
const W = 480, H = 300;
const composite = await Promise.all(
  tiles.map(async (t, i) => ({ input: await sharp(t).resize(W, H).toBuffer(), left: (i % 4) * W, top: Math.floor(i / 4) * H })),
);
await sharp({ create: { width: W * 4, height: H * 2, channels: 3, background: '#000' } })
  .composite(composite)
  .jpeg({ quality: 88 })
  .toFile(`${OUT}/theme-${SLUG}.jpg`);

// summary: min contrast per role per theme
const summary = {};
for (const [theme, byView] of Object.entries(results)) {
  summary[theme] = {};
  for (const [view, groups] of Object.entries(byView))
    for (const [role, g] of Object.entries(groups)) {
      const s = (summary[theme][role] ??= { min: Infinity, view: '', worst: '' });
      if (g.min < s.min) Object.assign(s, { min: g.min, view, worst: g.worst });
    }
}
writeFileSync(`${OUT}/theme-${SLUG}-contrast.json`, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
