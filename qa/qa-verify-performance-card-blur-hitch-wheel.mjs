// QA verify (performance lens, skeptic): same as qa-verify-performance-card-blur-hitch.mjs "isolated", but the
// card is brought into view with real mouse-wheel input (compositor scrolling), like a visitor would.
// Fresh browser per run. Usage: node qa/qa-verify-performance-card-blur-hitch-wheel.mjs <blur|noblur> [WxH] [theme] [runs]
import { chromium } from 'playwright';

const variant = process.argv[2] || 'blur';
const [width, height] = (process.argv[3] || '1920x1080').split('x').map(Number);
const theme = process.argv[4] || 'light';
const runs = +(process.argv[5] || 3);

for (let i = 0; i < runs; i++) {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  await page.goto('http://localhost:4100/', { waitUntil: 'load' });
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  if (variant === 'noblur') await page.addStyleTag({ content: '.card{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}' });
  // CSS=<rules>: extra control-experiment CSS injected into the test page only (attribution of the cost)
  if (process.env.CSS) await page.addStyleTag({ content: process.env.CSS });
  await page.waitForTimeout(1500);
  const entryY = await page.evaluate(async () => {
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    const card = document.querySelector('#about .card');
    let entry = Math.round(card.getBoundingClientRect().top + scrollY - innerHeight);
    for (let y = 0; y <= entry - 300; y += 60) {
      scrollTo({ top: y, behavior: 'instant' });
      await raf();
      await raf();
    }
    scrollTo({ top: entry - 300, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 1000));
    entry = Math.round(card.getBoundingClientRect().top + scrollY - innerHeight); // after real layout
    scrollTo({ top: entry - 300, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 2500));
    window.__frames = [];
    let last = 0;
    const rec = (t) => {
      if (last) window.__frames.push([+(t - last).toFixed(1), Math.round(scrollY)]);
      last = t;
      if (!window.__stop) requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
    return entry;
  });
  await page.mouse.move(width / 2, height / 2);
  for (let k = 0; k < 12; k++) {
    await page.mouse.wheel(0, 50);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(600);
  const frames = await page.evaluate(() => ((window.__stop = true), window.__frames));
  const long = frames.filter((f) => f[0] > 40);
  const near = long.filter((f) => Math.abs(f[1] - entryY) <= 80);
  console.log(
    `wheel ${variant} ${width}x${height} ${theme} run${i + 1}: entryY=${entryY} frames=${frames.length} scrolled ${frames[0]?.[1]}->${frames.at(-1)?.[1]} ` +
      `>40ms: ${long.map((f) => `${f[0]}@y${f[1]}`).join(', ') || 'none'} | AT CARD ENTRY (+-80px): ${near.map((f) => f[0] + 'ms').join(', ') || 'none'}`,
  );
  await browser.close();
}
