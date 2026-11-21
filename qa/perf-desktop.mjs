// QA helper: real-GPU desktop numbers: long tasks while the 3D city boots, then frame rate while
// scrolling the whole tour. Usage: node qa/perf-desktop.mjs [baseUrl] [width] [height]
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4100';
const width = +(process.argv[3] || 1920);
const height = +(process.argv[4] || 1080);
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
await page.addInitScript(() => {
  window.__long = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true });
});
const t0 = Date.now();
await page.goto(base, { waitUntil: 'load' });
await page.waitForSelector('.live.is-shown', { timeout: 30000 });
const shownAfter = Date.now() - t0;
await page.waitForTimeout(1500);
const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
const long = await page.evaluate(() => window.__long);

// scroll the whole page smoothly over ~12 s and record frame times
const frames = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const dur = 12000;
      const times = [];
      let start = 0, last = 0;
      const step = (t) => {
        if (!start) start = last = t;
        times.push(t - last);
        last = t;
        const k = Math.min(1, (t - start) / dur);
        window.scrollTo(0, max * k);
        if (k < 1) requestAnimationFrame(step);
        else resolve(times.slice(2));
      };
      requestAnimationFrame(step);
    }),
);
const sorted = [...frames].sort((a, b) => a - b);
const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
const p95 = sorted[Math.floor(sorted.length * 0.95)];
console.log(`viewport ${width}x${height} · GPU: ${gpu}`);
console.log(`live city shown ${shownAfter} ms after navigation start`);
console.log(`long tasks (start ms, duration ms): ${JSON.stringify(long)}`);
console.log(`scrolling the tour: avg ${(1000 / avg).toFixed(0)} fps, 95th percentile frame ${p95.toFixed(1)} ms (${(1000 / p95).toFixed(0)} fps)`);
console.log(errors.length ? `errors: ${[...new Set(errors)].join(' | ')}` : 'no errors');
await browser.close();
