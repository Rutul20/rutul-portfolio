// QA verify (performance lens): which backdrop-filter elements are already on screen just before the #about card enters
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://localhost:4100/', { waitUntil: 'load' });
await page.waitForSelector('.live.is-shown', { timeout: 30000 });
await page.waitForTimeout(1500);
const out = await page.evaluate(async () => {
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  for (let y = 0; y <= 2300; y += 60) { scrollTo({ top: y, behavior: 'instant' }); await raf(); await raf(); }
  scrollTo({ top: 2300, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 800));
  return [...document.querySelectorAll('body *')].filter((el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return cs.backdropFilter !== 'none' && r.bottom > 0 && r.top < innerHeight && r.width > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0; })
    .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)} top=${Math.round(el.getBoundingClientRect().top)} bf=${getComputedStyle(el).backdropFilter}`);
});
console.log('scrollY 2300 (card not yet in view), visible backdrop-filter elements:\n ' + out.join('\n '));
await browser.close();
