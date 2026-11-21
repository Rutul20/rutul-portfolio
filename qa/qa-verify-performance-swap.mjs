// QA verify (performance lens, skeptic): does the globe -> city cloud swap stall a frame because WebGL
// programs are linked there for the first time? Independent re-measure:
//  - wraps EVERY WebGL call and buckets the time per animation frame (so the sync calls where Chrome
//    actually waits for the GPU-process link, e.g. getUniformLocation/getActiveUniform, show up),
//  - hashes each linked program's full shader source (not just a few #defines),
//  - reads the cloud cover at the stalled frame,
//  - A/B in the same page: cold dive, scroll back to the top, then a second (warm) dive.
// Usage: node qa/qa-verify-performance-swap.mjs [baseUrl] [WxH] [theme] [runs]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:4100';
const [width, height] = (process.argv[3] || '1920x1080').split('x').map(Number);
const theme = process.argv[4] || 'light';
const runs = +(process.argv[5] || 2);

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

const out = [];
for (let run = 1; run <= runs; run++) {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await ctx.addInitScript(() => {
    window.__cur = {};
    window.__links = [];
    window.__progSrc = new WeakMap();
    window.__shSrc = new WeakMap();
    window.__loaf = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries())
          if (e.duration > 45)
            window.__loaf.push({
              t: Math.round(e.startTime),
              dur: Math.round(e.duration),
              y: Math.round(scrollY),
              scripts: (e.scripts || []).map((s) => `${s.invokerType}:${s.invoker}:${Math.round(s.duration)}ms:${(s.sourceURL || '').split('/').pop()}:${s.sourceFunctionName}`),
            });
      }).observe({ type: 'long-animation-frame', buffered: true });
    } catch {}
    const h = (s) => {
      let x = 2166136261;
      for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
      return (x >>> 0).toString(16);
    };
    for (const P of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype].filter(Boolean)) {
      for (const name of Object.getOwnPropertyNames(P)) {
        const d = Object.getOwnPropertyDescriptor(P, name);
        if (!d || typeof d.value !== 'function' || name === 'constructor') continue;
        const orig = d.value;
        P[name] = function (...a) {
          if (name === 'shaderSource') window.__shSrc.set(a[0], a[1]);
          if (name === 'attachShader') {
            const prev = window.__progSrc.get(a[0]) || '';
            window.__progSrc.set(a[0], prev + (window.__shSrc.get(a[1]) || ''));
          }
          const t0 = performance.now();
          const r = orig.apply(this, a);
          const dt = performance.now() - t0;
          const c = (window.__cur[name] ??= [0, 0]);
          c[0] += dt;
          c[1]++;
          if (name === 'deleteProgram') {
            const src = window.__progSrc.get(a[0]) || '';
            (window.__dels ??= []).push({ y: Math.round(scrollY), hash: h(src) });
          }
          if (name === 'linkProgram') {
            const src = window.__progSrc.get(a[0]) || '';
            const sname = (src.match(/#define SHADER_NAME (\S+)/) || [])[1] || 'custom';
            const defs = (src.match(/#define [A-Z_]+(?=\s|$)/g) || []).map((s) => s.slice(8)).filter((s) => !/^(SHADER_NAME|PRECISION|HIGH_PRECISION|STANDARD|LAMBERT|PHONG|GAMMA|LINEAR|TONE|OPAQUE|SHADOWMAP_TYPE_PCF|USE_SHADOWMAP)$/.test(s));
            window.__links.push({ y: Math.round(scrollY), name: sname, hash: h(src), defs: defs.join('+'), len: src.length });
          }
          return r;
        };
      }
    }
  });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  await page.waitForTimeout(1500);

  const dive = (label) =>
    page.evaluate(
      (label) =>
        new Promise((resolve) => {
          const end = document.getElementById('city').offsetHeight - innerHeight;
          const clouds = document.querySelector('.clouds');
          const dur = 8000;
          const frames = [];
          const linksBefore = window.__links.length;
          window.__cur = {};
          let start = 0,
            last = 0;
          const step = (t) => {
            if (!start) start = last = t;
            const gl = window.__cur;
            window.__cur = {};
            const glMs = Object.values(gl).reduce((s, v) => s + v[0], 0);
            const top = Object.entries(gl)
              .sort((a, b) => b[1][0] - a[1][0])
              .slice(0, 6)
              .map(([n, v]) => `${n}x${v[1]}=${v[0].toFixed(1)}`);
            frames.push({ dt: +(t - last).toFixed(1), y: Math.round(scrollY), glMs: +glMs.toFixed(1), top, cover: clouds ? +getComputedStyle(clouds).opacity : null, fill: clouds ? clouds.style.getPropertyValue('--fill') : null });
            last = t;
            const k = Math.min(1, (t - start) / dur);
            window.scrollTo({ top: end * k, behavior: 'instant' });
            if (k < 1) requestAnimationFrame(step);
            else setTimeout(() => resolve({ label, end, frames: frames.slice(2), links: window.__links.slice(linksBefore) }), 400);
          };
          requestAnimationFrame(step);
        }),
      label,
    );

  const loadLinks = await page.evaluate(() => window.__links.slice());
  const cold = await dive('cold');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(2000);
  const warm = await dive('warm');
  const loaf = await page.evaluate(() => window.__loaf);
  const dels = await page.evaluate(() => window.__dels || []);

  // screenshot the swap moment (cover) to judge visibility
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(800);
  const swapY = cold.links[0]?.y ?? Math.round(cold.end * 0.82);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), swapY);
  await page.waitForTimeout(600);
  const shot = `qa/shots/qa-verify-performance-swap-${width}x${height}-${theme}-r${run}.png`;
  await page.screenshot({ path: shot });
  await browser.close();

  const summary = { run, width, height, theme, loadLinks: loadLinks.length, shot };
  for (const d of [cold, warm]) {
    const bad = d.frames.filter((f) => f.dt > 40);
    summary[d.label] = {
      end: d.end,
      links: d.links.map((l) => `${l.name}[${l.defs}]#${l.hash}@y${l.y}`),
      slow: bad.map((f) => ({ ...f, intro: +(f.y / d.end).toFixed(3) })),
      medianDt: d.frames.map((f) => f.dt).sort((a, b) => a - b)[Math.floor(d.frames.length / 2)],
    };
  }
  // are the "new" programs at the swap really different from ones linked at load? compare full-source hashes
  const loadHashes = new Set(loadLinks.map((l) => l.hash));
  summary.cold.dupOfLoad = cold.links.filter((l) => loadHashes.has(l.hash)).length;
  summary.loadPrograms = loadLinks.map((l) => `${l.name}[${l.defs}]#${l.hash}`);
  summary.loaf = loaf.filter((l) => l.y > 0);
  summary.deletes = await (async () => dels)();
  out.push(summary);
  console.log(JSON.stringify(summary, null, 1));
}
fs.writeFileSync(`qa/qa-verify-performance-swap-${width}x${height}-${theme}.json`, JSON.stringify(out, null, 1));
