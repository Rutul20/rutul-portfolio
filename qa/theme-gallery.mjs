// QA preview for the "Gallery / museum plinth" theme direction (slug: gallery).
// Injects a light and a dark palette over the live 3D tour, screenshots 4 views per theme,
// measures WCAG contrast from the rendered pixels, and builds one contact sheet.
// Usage: cd /d/rutul-portfolio && node qa/theme-gallery.mjs
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const SLUG = 'gallery';
const BASE = 'http://localhost:3100';
const OUT = 'qa/shots';
mkdirSync(OUT, { recursive: true });

/* ── Theme tokens ───────────────────────────────────────────────────────────── */
const TOKENS = {
  light: `
  color-scheme: light;
  --page-bg: #efebe4;                       /* warm gallery-wall paper */
  --color-ink: #1d1b18;
  --color-ink-soft: #4b4640;
  --color-cream: #faf8f4;                   /* solid surface: dialog, résumé, text on ink */
  --color-paper: rgb(29 27 24 / 0.06);      /* chip / hover wash */
  --color-line: rgb(29 27 24 / 0.16);       /* hairlines */
  --color-plum: #982d1a;                    /* accent: the gallery "red dot" (cinnabar) */
  --color-teal: #2f5d58;
  --glass-live: rgb(250 248 244 / 0.78);
  --glass-live-strong: rgb(250 248 244 / 0.86);
  --glass-solid: rgb(250 248 244 / 0.97);
  --glass-filter-live: blur(20px) saturate(0.45) brightness(1.08);
  --glass-edge: rgb(29 27 24 / 0.12);
  --glass-sheen: inset 0 1px 0 rgb(255 255 255 / 0.9);
  --shadow-card: 0 1px 1px rgb(29 27 24 / 0.08), 0 18px 36px -22px rgb(29 27 24 / 0.45);
  --btn-primary-hover: #3a3631;
  --scrim: rgb(29 27 24 / 0.55);`,
  dark: `
  color-scheme: dark;
  --page-bg: #161514;                       /* charcoal "black box" gallery */
  --color-ink: #eeebe6;
  --color-ink-soft: #bcb6ad;
  --color-cream: #1f1e1c;
  --color-paper: rgb(255 255 255 / 0.07);
  --color-line: rgb(255 255 255 / 0.16);
  --color-plum: #ff8f75;                    /* the red dot, lifted for dark */
  --color-teal: #8cc7bf;
  --glass-live: rgb(24 23 22 / 0.70);
  --glass-live-strong: rgb(24 23 22 / 0.80);
  --glass-solid: rgb(31 30 28 / 0.97);
  --glass-filter-live: blur(22px) saturate(0.4) brightness(0.6);
  --glass-edge: rgb(255 255 255 / 0.10);
  --glass-sheen: inset 0 1px 0 rgb(255 255 255 / 0.07);
  --shadow-card: 0 1px 1px rgb(0 0 0 / 0.3), 0 22px 44px -22px rgb(0 0 0 / 0.75);
  --btn-primary-hover: #ffffff;
  --scrim: rgb(0 0 0 / 0.6);`,
};

/* ── Theme-independent rules (everything reads the tokens) ─────────────────── */
const COMPONENTS = `
:root {
  --radius-card: 0.6rem;                    /* squarer, plinth-like */
  --glass: var(--glass-live);
  --glass-strong: var(--glass-live-strong);
  --glass-filter: var(--glass-filter-live);
}
/* phones, reduced transparency, no backdrop-filter: the same card, nearly opaque, no live blur */
@media (max-width: 767px), (prefers-reduced-transparency: reduce) {
  :root { --glass: var(--glass-solid); --glass-strong: var(--glass-solid); --glass-filter: none; }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :root { --glass: var(--glass-solid); --glass-strong: var(--glass-solid); --glass-filter: none; }
}

html { background: var(--page-bg) !important; color: var(--color-ink); }
.sky { background: var(--page-bg) !important; }
::selection { background: var(--color-plum); color: var(--color-cream); }

/* glass: a quiet vitrine. The backdrop is blurred AND desaturated, so the city stays the
   only colour outside the cards and goes calm behind the text. */
.card, .landing-note, [class*="bg-cream"] {
  background: var(--glass) !important;
  -webkit-backdrop-filter: var(--glass-filter);
  backdrop-filter: var(--glass-filter);
  border: 1px solid var(--glass-edge) !important;
  box-shadow: var(--glass-sheen), var(--shadow-card) !important;
}
[class*="bg-cream"] { background: var(--glass-strong) !important; }
.card, .landing-note { border-radius: var(--radius-card); }

/* the ticket keeps its punched notches (mask); the drop-shadow filter would make the wrapper a
   backdrop root and stop the blur, so it becomes a plain box shadow */
.ticket-wrap { filter: none !important; border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.ticket-main, .ticket-stub {
  background-color: var(--glass) !important;
  -webkit-backdrop-filter: var(--glass-filter);
  backdrop-filter: var(--glass-filter);
  border: 1px solid var(--glass-edge);
  box-shadow: var(--glass-sheen);
}
.ticket-main { border-bottom: 0; }
.ticket-stub { border-top: 0; box-shadow: none; }

/* wall-label typography: quiet tracked caps with a single red dot */
.kicker { color: var(--color-ink-soft) !important; letter-spacing: 0.18em; }
.kicker::before {
  content: ''; display: inline-block; width: 0.62em; height: 0.62em; border-radius: 50%;
  background: var(--color-plum); margin-right: 0.65em; vertical-align: 0.02em;
}

.chip { background: var(--color-paper); border: 1px solid var(--color-line); border-radius: 0.3rem; }
.chip[class*="bg-ink"] { border-color: var(--color-ink); }
.btn-primary:hover { background: var(--btn-primary-hover) !important; }
.text-glow { color: var(--color-cream) !important; }           /* monogram: paper on ink */
.shelf-card { background: var(--color-paper) !important; border-color: var(--color-line) !important; border-radius: 0.5rem; }
#client-work li { background: var(--color-paper); border-radius: 0.5rem; }
.project-dialog::backdrop { background: var(--scrim) !important; }
.enter-3d { background: var(--color-ink) !important; color: var(--color-cream) !important; }
`;

const css = (theme) => `:root {${TOKENS[theme]}\n}\n${COMPONENTS}`;
writeFileSync(`${OUT}/theme-${SLUG}-light.css`, css('light'));
writeFileSync(`${OUT}/theme-${SLUG}-dark.css`, css('dark'));

/* ── What to measure (only elements visible in the viewport are sampled) ───── */
const SPECS = [
  ['body', '.site-ui h1, .site-ui h2, .card h3, .ticket-main p.font-bold, .chip:not([class*="bg-ink"]), .btn-ghost, header a[href="#city"] > span.font-bold, .landing-note .text-ink, .card p:not([class*="text-ink-soft"]):not(.kicker)'],
  ['soft', '.text-ink-soft, .kicker, .legend-rail a'],
  ['accent', '.link, a[href^="mailto"], .text-plum'],
];
// hides glyphs/decorations only (layout unchanged) so the backdrop under the text can be sampled
const HIDE_TEXT = `
.site-ui *, .site-ui *::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important;
  text-decoration-color: transparent !important; text-shadow: none !important; }
.site-ui *::before, .site-ui *::after, .legend-dot { visibility: hidden !important; }`;

const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const parseRgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);

async function measure(page, label) {
  const targets = await page.evaluate((specs) => {
    const out = [];
    for (const [cat, sel] of specs) {
      document.querySelectorAll(sel).forEach((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || r.width < 8 || r.height < 8) return;
        // stay clear of the element's own border (incl. the curve of pill-shaped buttons)
        const bw = parseFloat(cs.borderTopWidth) || 0;
        const rad = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.height / 2);
        const ix = 3 + bw + rad * 0.6, iy = 3 + bw;
        const x0 = Math.max(0, r.left + ix), y0 = Math.max(0, r.top + iy);
        const x1 = Math.min(innerWidth, r.right - ix), y1 = Math.min(innerHeight, r.bottom - iy);
        if (x1 - x0 < 4 || y1 - y0 < 4) return;
        out.push({ cat, tag: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''), color: cs.color, x0, y0, x1, y1 });
      });
    }
    return out;
  }, SPECS);
  const hide = await page.addStyleTag({ content: HIDE_TEXT });
  await page.waitForTimeout(120);
  const png = await page.screenshot();
  await hide.evaluate((el) => el.remove());
  await page.waitForTimeout(120);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const res = {};
  for (const t of targets) {
    const L = lum(...parseRgb(t.color));
    const vals = [];
    for (let y = Math.floor(t.y0); y < Math.floor(t.y1); y++)
      for (let x = Math.floor(t.x0); x < Math.floor(t.x1); x++) {
        const i = (y * info.width + x) * info.channels;
        vals.push(ratio(L, lum(data[i], data[i + 1], data[i + 2])));
      }
    if (!vals.length) continue;
    vals.sort((a, b) => a - b);
    const min = vals[0], p10 = vals[Math.floor(vals.length * 0.1)];
    const cur = res[t.cat];
    if (!cur || min < cur.min) res[t.cat] = { min, p10, worst: t.tag, color: t.color };
  }
  console.log(`  ${label}:`, Object.entries(res).map(([k, v]) => `${k} ${v.min.toFixed(2)} (p10 ${v.p10.toFixed(2)}, ${v.worst})`).join(' | '));
  return res;
}

/* ── Run ───────────────────────────────────────────────────────────────────── */
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const VIEWS = [
  ['hero', null],
  ['experience', '#experience'],
  ['client-work', '#client-work'],
  ['contact', '#contact'],
];
const tiles = [];
const summary = {};
for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  await page.goto(`${BASE}/?mode=live`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: css(theme) });
  await page.waitForTimeout(300);
  console.log(theme);
  summary[theme] = {};
  for (const [name, sel] of VIEWS) {
    if (sel) {
      await page.evaluate((s) => document.querySelector(s).scrollIntoView({ behavior: 'instant', block: 'start' }), sel);
      await page.waitForTimeout(1600);
    }
    const path = `${OUT}/theme-${SLUG}-${theme}-${name}.png`;
    await page.screenshot({ path });
    tiles.push(path);
    const m = await measure(page, name);
    for (const [k, v] of Object.entries(m)) if (!summary[theme][k] || v.min < summary[theme][k].min) summary[theme][k] = { ...v, view: name };
  }
  // extra (not on the sheet): the globe dive and cloud landing against the flat background
  for (const v of [0.35, 0.7, 0.93]) {
    await page.evaluate((v) => {
      const hero = document.getElementById('city');
      window.scrollTo({ top: v * (hero.offsetHeight - innerHeight), behavior: 'instant' });
    }, v);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${OUT}/theme-${SLUG}-${theme}-landing-${String(v).replace('.', '')}.png` });
    if (v === 0.93) {
      const m = await measure(page, 'landing note (clouds clearing)');
      for (const [k, x] of Object.entries(m)) if (!summary[theme][k] || x.min < summary[theme][k].min) summary[theme][k] = { ...x, view: 'landing' };
    }
  }
  await page.close();

  // phone fallback check (pictures, no live 3D; solid cards, no blur)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: theme });
  const phone = await ctx.newPage();
  await phone.goto(`${BASE}/?mode=still`, { waitUntil: 'networkidle' });
  await phone.addStyleTag({ content: css(theme) });
  await phone.waitForTimeout(800);
  await phone.screenshot({ path: `${OUT}/theme-${SLUG}-${theme}-phone-hero.png` });
  await phone.evaluate(() => document.querySelector('#experience').scrollIntoView({ behavior: 'instant', block: 'start' }));
  await phone.waitForTimeout(1200);
  const pf = await phone.evaluate(() => {
    const c = getComputedStyle(document.querySelector('#experience .card'));
    return { bg: c.backgroundColor, backdrop: c.backdropFilter || c.webkitBackdropFilter };
  });
  console.log(`  phone #experience card:`, pf);
  await phone.screenshot({ path: `${OUT}/theme-${SLUG}-${theme}-phone-experience.png` });
  await ctx.close();
}
await browser.close();

/* ── Contact sheet: 2 rows (light, dark) x 4 columns, 480x300 tiles ────────── */
const W = 480, H = 300;
const composites = [];
for (const [i, p] of tiles.entries()) {
  const row = Math.floor(i / 4), col = i % 4;
  composites.push({ input: await sharp(p).resize(W, H).toBuffer(), left: col * W, top: row * H });
  const label = `${row ? 'DARK' : 'LIGHT'} · ${VIEWS[col][0]}`;
  const lw = Math.round(10 + label.length * 6.2);
  composites.push({
    input: Buffer.from(`<svg width="${lw}" height="18"><rect width="${lw}" height="18" rx="3" fill="rgba(0,0,0,0.6)"/><text x="5" y="13" font-family="Arial" font-size="11" fill="#fff">${label}</text></svg>`),
    left: col * W + W - lw - 6, top: row * H + H - 24,
  });
}
await sharp({ create: { width: W * 4, height: H * 2, channels: 3, background: '#000' } })
  .composite(composites)
  .jpeg({ quality: 86 })
  .toFile(`${OUT}/theme-${SLUG}.jpg`);

console.log('\nMIN CONTRAST (worst sampled backdrop pixel under the text):');
for (const [t, cats] of Object.entries(summary))
  console.log(t, Object.entries(cats).map(([k, v]) => `${k}=${v.min.toFixed(2)} [${v.view} ${v.worst} ${v.color}]`).join('  '));
// solid pairs (no backdrop involved): primary button / ink chip, and the opaque phone card
const hexL = (h) => lum(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
for (const theme of ['light', 'dark']) {
  const tok = Object.fromEntries([...TOKENS[theme].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
  const solid = theme === 'light' ? '#faf8f4' : '#1f1e1c';
  console.log(`${theme} solid: cream-on-ink ${ratio(hexL(tok['color-cream']), hexL(tok['color-ink'])).toFixed(2)}  ink/soft/accent on phone card ${[tok['color-ink'], tok['color-ink-soft'], tok['color-plum']].map((c) => ratio(hexL(c), hexL(solid)).toFixed(2)).join(' / ')}`);
}
writeFileSync(`${OUT}/theme-${SLUG}-contrast.json`, JSON.stringify(summary, null, 2));
console.log(`sheet: ${OUT}/theme-${SLUG}.jpg`);
