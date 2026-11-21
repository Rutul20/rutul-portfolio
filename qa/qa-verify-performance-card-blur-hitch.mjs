// QA verify (performance lens, skeptic): does the first glass card (#about .card) stall a frame when it
// scrolls into view on a cold browser, and is the backdrop-filter the cause?
// Every run launches a NEW browser (fresh temp profile = cold GPU/shader/raster caches).
// Usage: node qa/qa-verify-performance-card-blur-hitch.mjs <full|isolated> <blur|noblur> [WxH] [theme] [runs]
//   full      0 -> 4200 px at the 12 s full-page speed (same as the reported run)
//   isolated  step slowly to 300 px before the card enters, idle 2.5 s, then scroll through the entry
//             at the full-page speed (removes the globe dive / other first-scroll costs from the picture)
import { chromium } from 'playwright';

const mode = process.argv[2] || 'full';
const variant = process.argv[3] || 'blur';
const [width, height] = (process.argv[4] || '1920x1080').split('x').map(Number);
const theme = process.argv[5] || 'light';
const runs = +(process.argv[6] || 3);
const base = process.env.BASE || 'http://localhost:4100';

for (let i = 0; i < runs; i++) {
  // PROFILE=<dir>: persistent profile (GPU shader disk cache survives between launches = returning visitor)
  const launchArgs = { headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] };
  const browser = process.env.PROFILE
    ? await chromium.launchPersistentContext(process.env.PROFILE, { ...launchArgs, viewport: { width, height } })
    : await chromium.launch(launchArgs);
  const ctx = process.env.PROFILE ? browser : await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  if (variant === 'noblur') await page.addStyleTag({ content: '.card{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}' });
  await page.waitForTimeout(1500);

  const res = await page.evaluate(
    async ({ mode }) => {
      const raf = () => new Promise((r) => requestAnimationFrame(r));
      const card = document.querySelector('#about .card');
      const cs = getComputedStyle(card);
      const pxPerMs = (document.documentElement.scrollHeight - innerHeight) / 12000;
      // absolute y at which the card's top edge reaches the bottom of the viewport
      const entryY = Math.round(card.getBoundingClientRect().top + scrollY - innerHeight);
      let from = 0,
        to = 4200;
      if (mode === 'isolated') {
        from = entryY - 300;
        to = entryY + 300;
        for (let y = 0; y <= from; y += 60) {
          scrollTo({ top: y, behavior: 'instant' });
          await raf();
          await raf();
        }
        scrollTo({ top: from, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 2500));
      }
      const dur = (to - from) / pxPerMs;
      const frames = [];
      await new Promise((resolve) => {
        let start = 0,
          last = 0;
        const step = (t) => {
          if (!start) start = last = t;
          frames.push([+(t - last).toFixed(1), Math.round(scrollY)]);
          last = t;
          const k = Math.min(1, (t - start) / dur);
          scrollTo({ top: from + (to - from) * k, behavior: 'instant' });
          if (k < 1) requestAnimationFrame(step);
          else setTimeout(resolve, 300);
        };
        requestAnimationFrame(step);
      });
      const f = frames.slice(2);
      const entryAfter = Math.round(card.getBoundingClientRect().top + scrollY - innerHeight);
      const deltas = f.map((x) => x[0]).sort((a, b) => a - b);
      return {
        bf: cs.backdropFilter,
        entryY: entryAfter,
        entryBefore: entryY,
        n: f.length,
        p95: deltas[Math.floor(deltas.length * 0.95)],
        long: f.filter((x) => x[0] > 40),
      };
    },
    { mode },
  );
  const near = res.long.filter((x) => Math.abs(x[1] - res.entryY) <= 80);
  console.log(
    `${mode} ${variant} ${width}x${height} ${theme} run${i + 1}: card bf=${res.bf} entryY=${res.entryY} (pre-layout est ${res.entryBefore}) frames=${res.n} p95=${res.p95}ms ` +
      `>40ms: ${res.long.map((x) => `${x[0]}@y${x[1]}`).join(', ') || 'none'} | AT CARD ENTRY (+-80px): ${near.map((x) => x[0] + 'ms').join(', ') || 'none'}`,
  );
  if (process.env.SHOT) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), res.entryY + 120);
    await page.waitForTimeout(600);
    await page.screenshot({ path: process.env.SHOT });
  }
  await browser.close();
}
