// QA (performance lens): try to reproduce and attribute the occasional >50 ms frames seen during the
// full-page scroll. Scrolls 0 -> ~4000 px at the same speed as the 12 s full-page run and records
// rAF deltas plus Long Animation Frame (LoAF) entries with script attribution.
// Usage: node qa/qa-performance-hitch.mjs [baseUrl] [WxH] [theme] [runs]
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4100';
const [width, height] = (process.argv[3] || '1920x1080').split('x').map(Number);
const theme = process.argv[4] || 'light';
const runs = +(process.argv[5] || 4);
const preWait = +(process.argv[6] || 1500); // ms to idle after the live city shows, before scrolling
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (let i = 0; i < runs; i++) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await ctx.addInitScript(() => {
    window.__loaf = [];
    try {
      new PerformanceObserver((l) =>
        l.getEntries().forEach((e) =>
          window.__loaf.push({
            start: Math.round(e.startTime),
            dur: Math.round(e.duration),
            block: Math.round(e.blockingDuration),
            renderStart: Math.round(e.renderStart - e.startTime),
            styleLayout: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0),
            scripts: e.scripts.map((s) => `${s.invoker || s.invokerType}:${Math.round(s.duration)}ms ${(s.sourceURL || '').split('/').pop()}${s.sourceFunctionName ? ' ' + s.sourceFunctionName : ''}`),
          }),
        ),
      ).observe({ type: 'long-animation-frame', buffered: false });
    } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(base + '/' + (process.env.HERO_MS ? `?heroMs=${process.env.HERO_MS}` : ''), { waitUntil: 'load' });
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  // control experiment only (in the test page, not the site): NOBLUR=1 removes the glass blur from
  // .card so the post-dive stall can be attributed
  if (process.env.NOBLUR) await page.addStyleTag({ content: '.card{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}' });
  await page.waitForTimeout(preWait);
  const res = await page.evaluate(
    () =>
      new Promise((resolve) => {
        // default: 0 -> 4200 px at the 12 s full-page speed; HERO_MS=8000 instead runs the hero dive only
        const heroMs = +(new URLSearchParams(location.search).get('heroMs') || 0);
        const end = heroMs ? document.getElementById('city').offsetHeight - innerHeight : 4200;
        const pxPerMs = (document.documentElement.scrollHeight - innerHeight) / 12000;
        const dur = heroMs || end / pxPerMs;
        window.__loaf.length = 0;
        const frames = [];
        let start = 0,
          last = 0;
        const step = (t) => {
          if (!start) start = last = t;
          frames.push([+(t - last).toFixed(1), Math.round(scrollY), Math.round(t)]);
          last = t;
          const k = Math.min(1, (t - start) / dur);
          window.scrollTo({ top: end * k, behavior: 'instant' });
          if (k < 1) requestAnimationFrame(step);
          else setTimeout(() => resolve({ frames: frames.slice(2), loaf: window.__loaf.slice() }), 300);
        };
        requestAnimationFrame(step);
      }),
  );
  const bad = res.frames.filter((f) => f[0] > 40);
  console.log(`run ${i + 1} ${width}x${height} ${theme} preWait ${preWait}:${res.frames.length} frames, >25ms ${res.frames.filter((f) => f[0] > 25).length}, >40ms: ${bad.map((b) => `${b[0]}ms@y${b[1]}(t${b[2]})`).join(', ') || 'none'}`);
  for (const l of res.loaf.filter((l) => l.dur > 40))
    console.log(`   LoAF t${l.start} ${l.dur}ms (blocking ${l.block}, render starts +${l.renderStart}ms, style+layout ${l.styleLayout}ms) scripts: ${l.scripts.join(' | ') || '-'}`);
  await ctx.close();
}
await browser.close();
