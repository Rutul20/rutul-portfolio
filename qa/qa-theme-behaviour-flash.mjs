// QA (theme behaviour lens): is the first painted frame already in the saved theme?
// Records data-theme / html background at DOMContentLoaded, the time the boot script flips data-theme
// vs first paint, the theme-color meta, and analyses every early CDP screencast frame for paper vs charcoal.
// Usage: node qa/qa-theme-behaviour-flash.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3100';
const OUT = 'qa/shots/theme-behaviour';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

const PAPER = [0xef, 0xeb, 0xe4];
const CHAR = [0x16, 0x15, 0x14];
const near = (r, g, b, c, tol = 10) => Math.abs(r - c[0]) <= tol && Math.abs(g - c[1]) <= tol && Math.abs(b - c[2]) <= tol;

async function classify(buf) {
  const { data, info } = await sharp(buf).resize(160, 100, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let paper = 0, charcoal = 0, white = 0;
  const n = info.width * info.height;
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (near(r, g, b, PAPER)) paper++;
    else if (near(r, g, b, CHAR)) charcoal++;
    else if (r > 250 && g > 250 && b > 250) white++;
  }
  return { paper: +(paper / n).toFixed(3), charcoal: +(charcoal / n).toFixed(3), white: +(white / n).toFixed(3) };
}

const probe = () => {
  const P = (window.__probe = { muts: [], paints: [] });
  new MutationObserver((recs) => {
    for (const r of recs)
      if (r.attributeName === 'data-theme' && r.target === document.documentElement)
        P.muts.push({ t: +performance.now().toFixed(1), from: r.oldValue, to: document.documentElement.dataset.theme });
  }).observe(document, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-theme'] });
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => P.paints.push({ name: e.name, t: +e.startTime.toFixed(1) }))).observe({ type: 'paint', buffered: true });
  } catch {}
  const snap = (label) => {
    const r = document.documentElement;
    return {
      label,
      t: +performance.now().toFixed(1),
      theme: r.dataset.theme,
      pref: r.dataset.themePref,
      htmlBg: getComputedStyle(r).backgroundColor,
      meta: document.querySelector('meta[name="theme-color"]')?.content,
    };
  };
  document.addEventListener('DOMContentLoaded', () => {
    P.dcl = snap('DOMContentLoaded');
    requestAnimationFrame(() => (P.raf = snap('first rAF after DCL')));
  });
  // poll the theme-color meta until it matches the theme, to time any browser-chrome mismatch
  const t0 = performance.now();
  const iv = setInterval(() => {
    const m = document.querySelector('meta[name="theme-color"]')?.content;
    const th = document.documentElement?.dataset.theme;
    if (m && th) {
      const ok = (th === 'dark') === (m.toLowerCase() === '#161514');
      if (!ok && P.metaMismatchFrom == null) P.metaMismatchFrom = +performance.now().toFixed(1);
      if (ok && P.metaMismatchFrom != null && P.metaOkAt == null) P.metaOkAt = +performance.now().toFixed(1);
    }
    if (performance.now() - t0 > 15000) clearInterval(iv);
  }, 5);
};

const cases = [
  { name: 'desktop-pref-dark', pref: 'dark', scheme: 'light', expect: 'dark', ctx: { viewport: { width: 1440, height: 900 } }, path: '/' },
  { name: 'desktop-pref-system-osdark', pref: 'system', scheme: 'dark', expect: 'dark', ctx: { viewport: { width: 1440, height: 900 } }, path: '/' },
  { name: 'desktop-pref-light-osdark', pref: 'light', scheme: 'dark', expect: 'light', ctx: { viewport: { width: 1440, height: 900 } }, path: '/' },
  { name: 'pixel7-pref-dark', pref: 'dark', scheme: 'light', expect: 'dark', ctx: { ...devices['Pixel 7'] }, path: '/?mode=still' },
  { name: 'resume-pref-dark', pref: 'dark', scheme: 'light', expect: 'dark', ctx: { viewport: { width: 1440, height: 900 } }, path: '/resume/' },
];

const results = [];
for (const c of cases) {
  const ctx = await browser.newContext({ ...c.ctx, colorScheme: c.scheme });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), c.pref);
  await ctx.addInitScript(probe);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  let navStart = null;
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ ts: f.metadata.timestamp, data: f.data });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.enable');
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  navStart = Date.now() / 1000;
  await page.goto(base + c.path, { waitUntil: 'commit' });
  const early = await page.screenshot().catch(() => null); // as early as Playwright allows after commit
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000);
  await cdp.send('Page.stopScreencast');
  const probeData = await page.evaluate(() => window.__probe);
  // classify frames after navigation start
  const after = frames.filter((f) => f.ts >= navStart - 0.05);
  const classified = [];
  for (const f of after) classified.push({ dt: +(f.ts - navStart).toFixed(3), ...(await classify(Buffer.from(f.data, 'base64'))) });
  // first frame that is not the blank white about:blank
  const firstPainted = classified.find((f) => f.white < 0.9);
  const wrong = classified.filter((f) => (c.expect === 'dark' ? f.paper > 0.25 : f.charcoal > 0.25));
  if (firstPainted) {
    const idx = classified.indexOf(firstPainted);
    writeFileSync(`${OUT}/flash-${c.name}-first-frame.png`, Buffer.from(after[idx].data, 'base64'));
  }
  if (early) writeFileSync(`${OUT}/flash-${c.name}-commit-shot.png`, early);
  const earlyCls = early ? await classify(early) : null;
  results.push({ case: c.name, expect: c.expect, probe: probeData, frameCount: classified.length, firstPainted, wrongFrames: wrong, commitShot: earlyCls, frames: classified.slice(0, 12) });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 1));
