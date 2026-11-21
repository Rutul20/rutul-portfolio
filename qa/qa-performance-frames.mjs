// QA (performance lens): real-GPU desktop frame times with the glass blur live.
// For each viewport x theme: (a) scroll the whole page over ~12 s, (b) scroll just the hero dive
// (0 -> #city height - innerHeight) over 8 s. Each run is a fresh page load.
// Usage: node qa/qa-performance-frames.mjs [baseUrl] [repeats]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:4100';
const repeats = +(process.argv[3] || 1);
const viewports = [
  [1920, 1080],
  [1440, 900],
];
const themes = ['light', 'dark'];
const tests = [
  ['full', 12000],
  ['hero', 8000],
];

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [];

for (let rep = 0; rep < repeats; rep++)
  for (const [width, height] of viewports)
    for (const theme of themes)
      for (const [test, dur] of tests) {
        if ((process.env.ONLY_VP && process.env.ONLY_VP !== `${width}x${height}`) || (process.env.ONLY_THEME && process.env.ONLY_THEME !== theme) || (process.env.ONLY_TEST && process.env.ONLY_TEST !== test)) continue;
        const ctx = await browser.newContext({ viewport: { width, height } });
        await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
        await ctx.addInitScript(() => {
          window.__long = [];
          try {
            new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true });
          } catch {}
        });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
        await page.goto(base + '/', { waitUntil: 'load' });
        await page.waitForSelector('.live.is-shown', { timeout: 30000 });
        await page.waitForTimeout(1500);

        const env = await page.evaluate(() => {
          const gl = document.createElement('canvas').getContext('webgl2');
          const ext = gl?.getExtension('WEBGL_debug_renderer_info');
          const cs = (sel) => {
            const el = document.querySelector(sel);
            return el ? getComputedStyle(el).backdropFilter : null;
          };
          return {
            gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown',
            theme: document.documentElement.dataset.theme,
            stage: document.documentElement.dataset.stage,
            cardBlur: cs('.card'),
            ticketBlur: cs('.ticket-main'),
            heroHeight: document.getElementById('city')?.offsetHeight ?? null,
            scrollMax: document.documentElement.scrollHeight - innerHeight,
            longBeforeScroll: window.__long.length,
          };
        });

        const run = await page.evaluate(
          ({ test, dur }) =>
            new Promise((resolve) => {
              const hero = document.getElementById('city');
              const target = test === 'hero' ? hero.offsetHeight - innerHeight : document.documentElement.scrollHeight - innerHeight;
              const frames = [];
              const longStart = window.__long.length;
              let start = 0,
                last = 0;
              const step = (t) => {
                if (!start) start = last = t;
                frames.push([+(t - last).toFixed(2), Math.round(scrollY)]);
                last = t;
                const k = Math.min(1, (t - start) / dur);
                // full-page target grows as content-visibility sections lay out; re-read it each frame
                const max = test === 'hero' ? target : document.documentElement.scrollHeight - innerHeight;
                window.scrollTo({ top: max * k, behavior: 'instant' });
                if (k < 1) requestAnimationFrame(step);
                else
                  setTimeout(() => {
                    // map scroll positions to sections now that they have laid out
                    const secs = [...document.querySelectorAll('#city, main section[id], section[id]')]
                      .filter((s, i, a) => a.indexOf(s) === i)
                      .map((s) => ({ id: s.id, top: Math.round(s.getBoundingClientRect().top + scrollY), h: s.offsetHeight }));
                    resolve({ frames: frames.slice(2), secs, longDuring: window.__long.slice(longStart), finalScroll: Math.round(scrollY), target: Math.round(max) });
                  }, 300);
              };
              requestAnimationFrame(step);
            }),
          { test, dur },
        );

        const d = run.frames.map((f) => f[0]);
        const sorted = [...d].sort((a, b) => a - b);
        const avg = d.reduce((a, b) => a + b, 0) / d.length;
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];
        const secAt = (y) => {
          const c = y + height / 2;
          let id = '?';
          for (const s of run.secs) if (c >= s.top && c < s.top + s.h) id = s.id;
          return id;
        };
        const over25 = run.frames.filter((f) => f[0] > 25).map(([ms, y]) => ({ ms, y, sec: secAt(y) }));
        const over50 = over25.filter((f) => f.ms > 50);
        const r = {
          rep,
          viewport: `${width}x${height}`,
          theme,
          test,
          ...env,
          frames: d.length,
          avgFps: +(1000 / avg).toFixed(1),
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p95,
          p99,
          max: sorted[sorted.length - 1],
          over25: over25.length,
          over50: over50.length,
          over25At: over25,
          longDuring: run.longDuring,
          target: run.target,
          finalScroll: run.finalScroll,
          sections: run.secs,
          errors: [...new Set(errors)],
        };
        results.push(r);
        console.log(
          `${r.viewport} ${theme.padEnd(5)} ${test.padEnd(4)} | theme=${env.theme} stage=${env.stage} card=${env.cardBlur} | ${r.frames} frames, avg ${r.avgFps} fps, p50 ${r.p50} ms, p95 ${p95} ms, p99 ${p99} ms, max ${r.max} ms | >25ms: ${r.over25} >50ms: ${r.over50} | long tasks during: ${run.longDuring.length}`,
        );
        if (over25.length) console.log('   >25ms at:', over25.map((o) => `${o.ms}ms@y${o.y}(${o.sec})`).join(', '));
        if (errors.length) console.log('   errors:', [...new Set(errors)].join(' | '));
        await ctx.close();
      }

console.log('GPU:', results[0]?.gpu);
writeFileSync(process.env.OUT || 'qa/qa-performance-frames.json', JSON.stringify(results, null, 2));
await browser.close();
