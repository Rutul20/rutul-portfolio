// QA verify (performance lens): why are 3 of the 4 programs linked at the swap byte-identical to
// programs linked at load? Captures three.js WebGLProgram.cacheKey (via an Object.prototype setter,
// diagnostic only) next to each link, then diffs the cache keys of identical-source programs.
// Usage: node qa/qa-verify-performance-swap-keys.mjs [baseUrl] [WxH]
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4100';
const [width, height] = (process.argv[3] || '1440x900').split('x').map(Number);
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width, height } });
await ctx.addInitScript(() => {
  window.__links = [];
  const shSrc = new WeakMap(), progSrc = new WeakMap();
  const h = (s) => {
    let x = 2166136261;
    for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
    return (x >>> 0).toString(16);
  };
  for (const P of [window.WebGL2RenderingContext?.prototype].filter(Boolean)) {
    const ss = P.shaderSource, at = P.attachShader, lp = P.linkProgram;
    P.shaderSource = function (sh, src) { shSrc.set(sh, src); return ss.call(this, sh, src); };
    P.attachShader = function (p, sh) { progSrc.set(p, (progSrc.get(p) || '') + (shSrc.get(sh) || '')); return at.call(this, p, sh); };
    P.linkProgram = function (p) {
      const src = progSrc.get(p) || '';
      window.__links.push({ y: Math.round(scrollY), hash: h(src), name: (src.match(/#define SHADER_TYPE (\S+)/) || [])[1] || (src.match(/#define SHADER_NAME (\S+)/) || [])[1] || '?' });
      return lp.call(this, p);
    };
  }
  Object.defineProperty(Object.prototype, 'cacheKey', {
    configurable: true,
    set(v) {
      Object.defineProperty(this, 'cacheKey', { value: v, writable: true, configurable: true, enumerable: true });
      const last = window.__links[window.__links.length - 1];
      if (last && !last.key) last.key = v;
    },
  });
});
const page = await ctx.newPage();
await page.goto(base + '/', { waitUntil: 'load' });
await page.waitForSelector('.live.is-shown', { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const end = document.getElementById('city').offsetHeight - innerHeight;
  for (let k = 0; k <= 1; k += 0.01) {
    window.scrollTo({ top: end * k, behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  await new Promise((r) => setTimeout(r, 500));
});
const links = await page.evaluate(() => window.__links);
await browser.close();
const load = links.filter((l) => l.y === 0);
const late = links.filter((l) => l.y > 0);
console.log(`${width}x${height}: ${load.length} programs at load, ${late.length} during the dive`);
for (const l of late) {
  const twin = load.find((x) => x.hash === l.hash);
  console.log(`\n@y${l.y} ${l.name} #${l.hash} ${twin ? 'IDENTICAL SOURCE to a load-time program' : 'new source'}`);
  if (twin) {
    const a = twin.key.split(','), b = l.key.split(',');
    const diffs = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diffs.push(`[${i}] load=${a[i]} swap=${b[i]}`);
    console.log(`  cacheKey fields that differ: ${diffs.join('  ') || 'none'}`);
    console.log(`  load key: ${twin.key.slice(0, 400)}`);
    console.log(`  swap key: ${l.key.slice(0, 400)}`);
  } else console.log(`  key: ${String(l.key).slice(0, 400)}`);
}
