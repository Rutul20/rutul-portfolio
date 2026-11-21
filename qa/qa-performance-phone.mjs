// QA (performance lens): what a phone (Pixel 7) requests on '/', confirm the big three.js chunk is
// never fetched, and that the glass cards carry no backdrop blur. Scrolls the page to the bottom so
// any lazily triggered imports would show up too.
// Usage: node qa/qa-performance-phone.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import { readdirSync, statSync, writeFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:4100';
const chunkDir = 'out/_next/static/chunks';
const chunks = readdirSync(chunkDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => [f, statSync(`${chunkDir}/${f}`).size])
  .sort((a, b) => b[1] - a[1]);
const [bigName, bigSize] = chunks[0];
console.log(`largest chunk: ${bigName} (${bigSize} bytes)`);

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const out = [];
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  const reqs = [];
  page.on('request', (r) => reqs.push([r.resourceType(), new URL(r.url()).pathname]));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  // scroll slowly to the bottom and back to catch anything lazy
  await page.evaluate(async () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    for (let y = 0; y <= max; y += Math.round(innerHeight * 0.8)) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => {
    const vals = (sel) => [...new Set([...document.querySelectorAll(sel)].map((e) => getComputedStyle(e).backdropFilter))];
    return {
      theme: document.documentElement.dataset.theme,
      stage: document.documentElement.dataset.stage,
      liveCanvas: !!document.querySelector('.live canvas'),
      cardCount: document.querySelectorAll('.card').length,
      card: vals('.card'),
      landingNote: vals('.landing-note'),
      ticket: vals('.ticket-main, .ticket-stub'),
      glassSolid: vals('.glass-solid'),
      webkitCard: [...new Set([...document.querySelectorAll('.card')].map((e) => getComputedStyle(e).webkitBackdropFilter))],
    };
  });
  const scripts = reqs.filter(([t, p]) => t === 'script' || p.endsWith('.js')).map(([, p]) => p);
  const chunkReqs = scripts.filter((p) => p.includes('/_next/static/chunks/')).map((p) => p.split('/').pop());
  const jsBytes = chunkReqs.reduce((s, f) => s + (chunks.find((c) => c[0] === f)?.[1] ?? 0), 0);
  const threeLike = reqs.filter(([, p]) => /\.(glb|gltf|ktx2|drc|hdr|bin)$/i.test(p) || /draco|basis/i.test(p)).map(([, p]) => p);
  const r = { theme, ...state, scripts, bigRequested: chunkReqs.includes(bigName), jsBytes, threeAssets: threeLike, totalRequests: reqs.length };
  out.push(r);
  console.log(`\n[Pixel 7, ${theme}] html data-theme=${state.theme} data-stage=${state.stage} live canvas=${state.liveCanvas}`);
  console.log('script requests:');
  for (const s of scripts) console.log('  ', s, chunks.find((c) => s.endsWith(c[0]))?.[1] ?? '');
  console.log(`big chunk ${bigName} requested: ${r.bigRequested}; JS chunk bytes on disk: ${jsBytes}`);
  console.log(`3D asset requests: ${threeLike.length ? threeLike.join(', ') : 'none'}`);
  console.log(`.card backdrop-filter (x${state.cardCount}): ${JSON.stringify(state.card)} webkit: ${JSON.stringify(state.webkitCard)}`);
  console.log(`.landing-note: ${JSON.stringify(state.landingNote)} ticket: ${JSON.stringify(state.ticket)} .glass-solid: ${JSON.stringify(state.glassSolid)}`);
  await ctx.close();
}
writeFileSync('qa/qa-performance-phone.json', JSON.stringify({ bigName, bigSize, runs: out }, null, 2));
await browser.close();
