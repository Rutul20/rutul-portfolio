// QA verify (performance lens, skeptic): do cold-GPU stalls really happen (a) at cloud onset in the
// hero dive and (b) on the first scroll frames? Each "cold" run launches a fresh browser (empty shader
// and raster caches), loads the production build, waits for the live city, then scrolls the hero dive
// over HERO_MS with rAF. A "warm" pass repeats the dive in the same page. PREWARM=1 is a control:
// in the test page only, it shows the cloud layer at opacity 0.001 for a few frames before the dive.
// Usage: node qa/qa-verify-performance-cold-stalls.mjs [base] [WxH] [theme] [runs]
import { chromium } from 'playwright';
import os from 'node:os';

const base = process.argv[2] || 'http://localhost:4100';
const [width, height] = (process.argv[3] || '1920x1080').split('x').map(Number);
const theme = process.argv[4] || 'light';
const runs = +(process.argv[5] || 5);
const heroMs = +(process.env.HERO_MS || 8000);
const prewarm = !!process.env.PREWARM;

function cpuBusy(ms = 500) {
  const snap = () => os.cpus().map((c) => c.times);
  const a = snap();
  return new Promise((r) =>
    setTimeout(() => {
      const b = snap();
      let idle = 0, total = 0;
      b.forEach((t, i) => {
        const d = (k) => t[k] - a[i][k];
        const tot = d('user') + d('nice') + d('sys') + d('idle') + d('irq');
        total += tot;
        idle += d('idle');
      });
      r(Math.round(100 * (1 - idle / total)));
    }, ms),
  );
}

async function dive(page, label) {
  if (prewarm && label === 'cold')
    await page.evaluate(
      () =>
        new Promise((res) => {
          const el = document.querySelector('.clouds');
          el.style.visibility = 'visible';
          el.style.opacity = '0.001';
          el.classList.add('is-on');
          let n = 0;
          const f = () => {
            if (++n < 4) return requestAnimationFrame(f);
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
            el.classList.remove('is-on');
            res();
          };
          requestAnimationFrame(f);
        }),
    );
  if (prewarm && label === 'cold') await page.waitForTimeout(500);
  const cpu = await cpuBusy();
  const r = await page.evaluate(
    (dur) =>
      new Promise((resolve) => {
        const end = document.getElementById('city').offsetHeight - innerHeight;
        const clouds = document.querySelector('.clouds');
        window.__loaf = [];
        const frames = [];
        let start = 0, last = 0;
        const step = (t) => {
          if (!start) start = last = t;
          frames.push({ dt: +(t - last).toFixed(1), y: Math.round(scrollY), vis: clouds.style.visibility === 'visible' ? 1 : 0, t: Math.round(t) });
          last = t;
          const k = Math.min(1, (t - start) / dur);
          window.scrollTo({ top: end * k, behavior: 'instant' });
          if (k < 1) requestAnimationFrame(step);
          else setTimeout(() => resolve({ end, frames: frames.slice(1), loaf: window.__loaf.slice() }), 300);
        };
        requestAnimationFrame(step);
      }),
    heroMs,
  );
  const f = r.frames;
  const onset = f.findIndex((x) => x.vis);
  const dts = f.map((x) => x.dt).sort((a, b) => a - b);
  const p95 = dts[Math.floor(dts.length * 0.95)];
  const stalls = f.map((x, i) => ({ ...x, i })).filter((x) => x.dt > 40);
  const tag = (s) => (onset >= 0 && s.i >= onset - 2 && s.i <= onset + 4 ? 'CLOUD-ONSET' : s.y < 400 ? "FIRST-SCROLL" : 'other');
  const onsetMax = onset >= 0 ? Math.max(...f.slice(Math.max(0, onset - 2), onset + 5).map((x) => x.dt)) : null;
  const firstMax = Math.max(...f.filter((x) => x.y < 400).map((x) => x.dt));
  return {
    label,
    cpu,
    frames: f.length,
    p95,
    max: dts[dts.length - 1],
    onsetY: onset >= 0 ? f[onset].y : null,
    onsetMax,
    firstMax,
    stalls: stalls.map((s) => `${s.dt}ms@y${s.y}[${tag(s)}]`),
    loaf: r.loaf.filter((l) => l.dur > 40).map((l) => `t${l.start} ${l.dur}ms render+${l.renderStart} scripts:${l.scripts.join('|') || '-'}`),
  };
}

const all = [];
for (let i = 0; i < runs; i++) {
  const gpuArgs = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
  // PROFILE=<dir>: one persistent profile, so the GPU shader disk cache survives between browser launches
  const browser = process.env.PROFILE ? null : await chromium.launch({ headless: true, args: gpuArgs });
  const ctx = browser
    ? await browser.newContext({ viewport: { width, height } })
    : await chromium.launchPersistentContext(process.env.PROFILE, { headless: true, args: gpuArgs, viewport: { width, height } });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await ctx.addInitScript(() => {
    window.__loaf = [];
    try {
      new PerformanceObserver((l) =>
        l.getEntries().forEach((e) =>
          window.__loaf.push({
            start: Math.round(e.startTime),
            dur: Math.round(e.duration),
            renderStart: Math.round(e.renderStart - e.startTime),
            scripts: e.scripts.map((s) => `${s.invokerType}:${Math.round(s.duration)}ms`),
          }),
        ),
      ).observe({ type: 'long-animation-frame' });
    } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a';
  });
  const cold = await dive(page, 'cold');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(1500);
  const warm = await dive(page, 'warm');
  for (const d of [cold, warm]) {
    console.log(
      `run ${i + 1} ${width}x${height} ${theme}${prewarm ? ' PREWARM' : ''} ${d.label} cpu${d.cpu}% | ${d.frames} frames p95 ${d.p95} max ${d.max} | cloud onset y${d.onsetY} max ${d.onsetMax} | first-scroll(y<400) max ${d.firstMax} | >40ms: ${d.stalls.join(', ') || 'none'}`,
    );
    d.loaf.forEach((l) => console.log('     LoAF ' + l));
    all.push(d);
  }
  if (i === 0) console.log('   gpu: ' + gpu);
  await (browser || ctx).close();
}
const summ = (lab) => {
  const ds = all.filter((d) => d.label === lab);
  return `${lab}: cloud-onset >40ms in ${ds.filter((d) => d.onsetMax > 40).length}/${ds.length} [${ds.map((d) => d.onsetMax).join(', ')}]; first-scroll(y<400) >40ms in ${ds.filter((d) => d.firstMax > 40).length}/${ds.length} [${ds.map((d) => d.firstMax).join(', ')}]; p95 [${ds.map((d) => d.p95).join(', ')}]`;
};
console.log('SUMMARY ' + summ('cold'));
console.log('SUMMARY ' + summ('warm'));
