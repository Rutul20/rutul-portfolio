// QA (performance lens): does the globe -> city swap link new WebGL programs (i.e. the warm-up frame
// did not compile everything)? Wraps WebGL linkProgram / compileShader / getProgramParameter in the
// page and records when they run relative to scroll position. Cold browser each run.
// Usage: node qa/qa-performance-programs.mjs [baseUrl] [WxH] [theme]
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4100';
const [width, height] = (process.argv[3] || '1920x1080').split('x').map(Number);
const theme = process.argv[4] || 'light';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width, height } });
await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
await ctx.addInitScript(() => {
  window.__gl = [];
  window.__src = [];
  for (const P of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype].filter(Boolean)) {
    const ss = P.shaderSource;
    P.shaderSource = function (sh, src) {
      if (/gl_FragColor|out highp vec4 pc_fragColor|pc_fragColor/.test(src) || src.includes('gl_Position')) {
        const name = (src.match(/#define SHADER_NAME (\S+)/) || [])[1] || (src.match(/#define SHADER_TYPE (\S+)/) || [])[1] || 'custom';
        const defs = ['USE_INSTANCING', 'USE_INSTANCING_COLOR', 'USE_SHADOWMAP', 'DEPTH_PACKING', 'USE_MAP', 'USE_COLOR', 'FLAT_SHADED', 'DOUBLE_SIDED', 'USE_FOG', 'TRANSPARENT', 'USE_UV'].filter((d) => src.includes('#define ' + d));
        const kind = src.includes('gl_Position') ? 'vert' : 'frag';
        window.__src.push([Math.round(scrollY), kind, name, defs.join('+')]);
      }
      return ss.call(this, sh, src);
    };
    for (const name of ['linkProgram', 'compileShader', 'getProgramParameter', 'getShaderParameter']) {
      const orig = P[name];
      P[name] = function (...a) {
        const t0 = performance.now();
        const r = orig.apply(this, a);
        const d = performance.now() - t0;
        if (name === 'linkProgram' || name === 'compileShader' || d > 2) window.__gl.push([name, Math.round(t0), +d.toFixed(1), Math.round(scrollY)]);
        return r;
      };
    }
  }
});
const page = await ctx.newPage();
await page.goto(base + '/', { waitUntil: 'load' });
await page.waitForSelector('.live.is-shown', { timeout: 30000 });
await page.waitForTimeout(1500);
const before = await page.evaluate(() => window.__gl.length);
const res = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const end = document.getElementById('city').offsetHeight - innerHeight;
      const dur = 8000;
      const frames = [];
      let start = 0,
        last = 0;
      const step = (t) => {
        if (!start) start = last = t;
        frames.push([+(t - last).toFixed(1), Math.round(scrollY)]);
        last = t;
        const k = Math.min(1, (t - start) / dur);
        window.scrollTo({ top: end * k, behavior: 'instant' });
        if (k < 1) requestAnimationFrame(step);
        else setTimeout(() => resolve({ frames: frames.slice(2), end }), 300);
      };
      requestAnimationFrame(step);
    }),
);
const gl = await page.evaluate(() => window.__gl);
const pre = gl.slice(0, before);
const during = gl.slice(before);
const sum = (arr, n) => arr.filter((g) => g[0] === n);
console.log(`${width}x${height} ${theme} hero dive 0->${res.end}px / 8 s (cold browser)`);
console.log(`before scrolling: ${sum(pre, 'linkProgram').length} linkProgram, ${sum(pre, 'compileShader').length} compileShader, blocking getters >2ms: ${pre.filter((g) => g[0].startsWith('get')).length} (${pre.filter((g) => g[0].startsWith('get')).reduce((s, g) => s + g[2], 0).toFixed(0)} ms)`);
console.log(`during the dive: ${sum(during, 'linkProgram').length} linkProgram, ${sum(during, 'compileShader').length} compileShader`);
const byY = {};
for (const g of during) {
  const k = g[3];
  byY[k] ??= { link: 0, compile: 0, blockMs: 0 };
  if (g[0] === 'linkProgram') byY[k].link++;
  else if (g[0] === 'compileShader') byY[k].compile++;
  else byY[k].blockMs += g[2];
}
for (const [y, v] of Object.entries(byY)) console.log(`   at scrollY ${y} (intro ${(+y / res.end).toFixed(2)}): ${v.link} links, ${v.compile} shader compiles, ${v.blockMs.toFixed(0)} ms blocked in get*Parameter`);
const src = await page.evaluate(() => window.__src);
const late = src.filter((s) => s[0] > 0 && s[1] === 'vert');
console.log(`programs first built during the dive: ${late.map((s) => `${s[2]}[${s[3]}]@y${s[0]}`).join(', ') || 'none'}`);
console.log(`programs built at load (warm-up): ${src.filter((s) => s[0] === 0 && s[1] === 'vert').map((s) => `${s[2]}[${s[3]}]`).join(', ')}`);
const bad = res.frames.filter((f) => f[0] > 40);
console.log(`frames >40ms: ${bad.map((b) => `${b[0]}ms@y${b[1]}`).join(', ') || 'none'}`);
await browser.close();
