// QA verify (performance lens, skeptic): is the #about card-entry stall a once-per-browser-process cost?
// prep=site      : load the site and wheel past the card in context A, then measure in a fresh context B
// prep=blurpage  : first show an unrelated page with a big backdrop-filter panel (same filter chain), then measure
// prep=none      : measure straight away (cold)
// Usage: node qa/qa-verify-performance-card-blur-hitch-warm.mjs <none|site|blurpage> [runs]
import { chromium } from 'playwright';

const prep = process.argv[2] || 'none';
const runs = +(process.argv[3] || 2);
const W = 1920,
  H = 1080;

async function measure(browser) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(() => localStorage.setItem('theme', 'light'));
  const page = await ctx.newPage();
  await page.goto('http://localhost:4100/', { waitUntil: 'load' });
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
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
    entry = Math.round(card.getBoundingClientRect().top + scrollY - innerHeight);
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
  await page.mouse.move(W / 2, H / 2);
  for (let k = 0; k < 12; k++) {
    await page.mouse.wheel(0, 50);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(600);
  const frames = await page.evaluate(() => ((window.__stop = true), window.__frames));
  await ctx.close();
  const near = frames.filter((f) => f[0] > 40 && Math.abs(f[1] - entryY) <= 80);
  return `entryY=${entryY} >40ms anywhere: ${frames.filter((f) => f[0] > 40).map((f) => `${f[0]}@y${f[1]}`).join(', ') || 'none'} | AT CARD ENTRY: ${near.map((f) => f[0] + 'ms').join(', ') || 'none'}`;
}

for (let i = 0; i < runs; i++) {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  if (prep === 'site') console.log(`  prep (context A, cold): ${await measure(browser)}`);
  if (prep === 'blurpage') {
    const p = await browser.newPage({ viewport: { width: W, height: H } });
    await p.setContent(`<body style="margin:0;height:3000px;background:repeating-linear-gradient(45deg,#c33 0 40px,#36c 40px 80px)">
      <div style="position:absolute;top:1400px;left:300px;width:1100px;height:700px;border-radius:24px;background:rgb(250 248 244/.84);backdrop-filter:blur(20px) saturate(0.7) brightness(1.05);font:20px/1.5 serif;padding:40px">glass</div></body>`);
    await p.waitForTimeout(500);
    for (let y = 0; y <= 1200; y += 100) {
      await p.mouse.wheel(0, 100);
      await p.waitForTimeout(40);
    }
    await p.waitForTimeout(800);
    await p.close();
  }
  console.log(`prep=${prep} run${i + 1} measured: ${await measure(browser)}`);
  await browser.close();
}
