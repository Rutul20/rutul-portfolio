// QA (performance lens): Chrome trace of the hero dive (0 -> 4200 px at full-page speed) to attribute
// the >50 ms frames: lists the renderer main-thread tasks over 40 ms with their biggest child slices,
// plus the scroll position at that moment.
// Usage: node qa/qa-performance-trace.mjs [baseUrl] [WxH] [theme]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:4100';
const [width, height] = (process.argv[3] || '1920x1080').split('x').map(Number);
const theme = process.argv[4] || 'light';
const tracePath = `qa/qa-performance-trace-${width}x${height}-${theme}.json`;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width, height } });
await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
const page = await ctx.newPage();
await page.goto(base + '/', { waitUntil: 'load' });
await page.waitForSelector('.live.is-shown', { timeout: 30000 });
await page.waitForTimeout(1500);
await browser.startTracing(page, {
  path: tracePath,
  categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'toplevel', 'blink', 'cc', 'gpu', 'viz', 'v8.execute', 'disabled-by-default-v8.gc'],
});
const res = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const end = 4200;
      const pxPerMs = (document.documentElement.scrollHeight - innerHeight) / 12000;
      const dur = end / pxPerMs;
      const frames = [];
      let start = 0,
        last = 0;
      const step = (t) => {
        if (!start) start = last = t;
        frames.push([+(t - last).toFixed(1), Math.round(scrollY), t + performance.timeOrigin]);
        last = t;
        const k = Math.min(1, (t - start) / dur);
        window.scrollTo({ top: end * k, behavior: 'instant' });
        if (k < 1) requestAnimationFrame(step);
        else setTimeout(() => resolve(frames.slice(2)), 300);
      };
      requestAnimationFrame(step);
    }),
);
await browser.stopTracing();
await browser.close();

const bad = res.filter((f) => f[0] > 40);
console.log(`${width}x${height} ${theme}: ${res.length} frames, >25ms ${res.filter((f) => f[0] > 25).length}, >40ms: ${bad.map((b) => `${b[0]}ms@y${b[1]}`).join(', ') || 'none'}`);

const ev = JSON.parse(readFileSync(tracePath, 'utf8')).traceEvents;
const names = {};
for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') names[`${e.pid}:${e.tid}`] = e.args.name;
const pidOf = (n) => Object.entries(names).filter(([, v]) => v === n).map(([k]) => k);
const mains = pidOf('CrRendererMain');
const gpuMain = pidOf('CrGpuMain');
const compositor = pidOf('Compositor');
const vizComp = pidOf('VizCompositorThread');
// map trace ts (us, monotonic) to scroll via the rAF timestamps: use the first frame as anchor
const anchorTrace = ev.find((e) => e.name === 'FireAnimationFrame' || e.name === 'AnimationFrame')?.ts;
const report = (threads, label, min = 40) => {
  const top = ev.filter((e) => e.ph === 'X' && threads.includes(`${e.pid}:${e.tid}`) && e.dur > min * 1000);
  // keep only outermost slices
  const outer = top.filter((e) => !top.some((o) => o !== e && o.pid === e.pid && o.tid === e.tid && o.ts <= e.ts && o.ts + o.dur >= e.ts + e.dur));
  for (const t of outer) {
    const kids = ev
      .filter((e) => e.ph === 'X' && e.pid === t.pid && e.tid === t.tid && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e !== t && e.dur > 3000)
      .sort((a, b) => b.dur - a.dur)
      .slice(0, 8)
      .map((e) => `${e.name}${e.args?.data?.functionName ? '(' + e.args.data.functionName + ')' : ''}:${(e.dur / 1000).toFixed(0)}`);
    console.log(`  [${label}] +${((t.ts - (anchorTrace ?? t.ts)) / 1000).toFixed(0)}ms ${t.name} ${(t.dur / 1000).toFixed(0)}ms -> ${kids.join(', ')}`);
  }
};
report(mains, 'renderer main');
report(compositor, 'compositor');
report(gpuMain, 'gpu main');
report(vizComp, 'viz');
console.log(`trace: ${tracePath}`);
