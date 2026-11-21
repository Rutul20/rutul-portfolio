// QA (performance lens): which elements enter the viewport around a given scroll position (to locate
// the post-dive raster stall). Usage: node qa/qa-performance-whatenters.mjs [WxH] [y1] [y2]
import { chromium } from 'playwright';
const [width, height] = (process.argv[2] || '1920x1080').split('x').map(Number);
const y1 = +(process.argv[3] || 2340), y2 = +(process.argv[4] || 2400);
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height } });
await page.goto('http://localhost:4100/', { waitUntil: 'load' });
await page.waitForSelector('.live.is-shown', { timeout: 30000 });
await page.waitForTimeout(1000);
const out = await page.evaluate(async ({ y1, y2 }) => {
  const vis = () => {
    const s = new Set();
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width && r.height && r.bottom > 0 && r.top < innerHeight && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0) s.add(el);
    }
    return s;
  };
  for (let y = 0; y <= y1; y += 100) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }
  const a = vis();
  scrollTo({ top: y2, behavior: 'instant' });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const b = vis();
  const d = (el) => { const cs = getComputedStyle(el); return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].slice(0, 3).join('.')} top=${Math.round(el.getBoundingClientRect().top)} bf=${cs.backdropFilter} filter=${cs.filter} shadow=${cs.boxShadow === 'none' ? 'none' : 'yes'}`; };
  const entered = [...b].filter((e) => !a.has(e));
  const left = [...a].filter((e) => !b.has(e));
  return { entered: entered.slice(0, 25).map(d), enteredCount: entered.length, left: left.slice(0, 15).map(d), leftCount: left.length, intro: document.querySelector('.clouds')?.style.opacity };
}, { y1, y2 });
console.log(JSON.stringify(out, null, 1));
await browser.close();
