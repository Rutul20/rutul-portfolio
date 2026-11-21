// QA verify (lens: visual) — skeptic check of "phone header overflows at <=390px".
// Measures the header nav pill, its links, the .enter-3d button and page overflow at several phone widths, both themes.
import { chromium, devices } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:4100';
const sizes = [
  { name: 'pixel7-412', dev: devices['Pixel 7'] },
  { name: 'iphone13-390', dev: devices['iPhone 13'] },
  { name: 'iphoneSE-375', dev: devices['iPhone SE'] },
  { name: 'galaxyS8-360', dev: { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } } },
  { name: 'w320', dev: { ...devices['Pixel 7'], viewport: { width: 320, height: 640 } } },
];
const browser = await chromium.launch({ headless: true });
const out = [];
for (const theme of ['light', 'dark']) {
  for (const s of sizes) {
    const ctx = await browser.newContext({ ...s.dev });
    await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
    const page = await ctx.newPage();
    await page.goto(BASE + '/?mode=still', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const rect = (el) => (el ? (({ x, y, width, height, right, bottom }) => ({ x, y, width, height, right, bottom }))(el.getBoundingClientRect()) : null);
      const nav = document.querySelector('header nav');
      const links = [...nav.children].map((el) => ({
        text: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '),
        ...rect(el),
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
      }));
      const enter = document.querySelector('.enter-3d');
      const ecs = enter ? getComputedStyle(enter) : null;
      const brand = document.querySelector('header a[href="#city"]');
      // what is painted at points inside the overlap band
      const hits = [];
      if (enter) {
        const er = enter.getBoundingClientRect();
        const nr = nav.getBoundingClientRect();
        const y = (er.top + Math.min(er.bottom, nr.bottom)) / 2;
        for (const x of [er.left + 6, (er.left + er.right) / 2, er.right - 6]) {
          const el = document.elementFromPoint(x, y);
          hits.push({ x: Math.round(x), y: Math.round(y), top: el ? (el.className && el.className.baseVal === undefined ? el.className : el.tagName) + ' ' + (el.innerText || '').slice(0, 20) : null });
        }
      }
      return {
        vw: innerWidth,
        docScrollW: document.documentElement.scrollWidth,
        brand: rect(brand),
        nav: rect(nav),
        links,
        enter: rect(enter),
        enterVisible: enter ? ecs.display !== 'none' && ecs.visibility !== 'hidden' && +ecs.opacity > 0 : false,
        enterText: enter?.innerText,
        hits,
      };
    });
    const resume = r.links.find((l) => /sum/.test(l.text));
    const contact = r.links.find((l) => /Contact/.test(l.text));
    const summary = {
      theme,
      size: s.name,
      vw: r.vw,
      docScrollW: r.docScrollW,
      navH: Math.round(r.nav.height * 10) / 10,
      navLeft: Math.round(r.nav.x * 10) / 10,
      navRight: Math.round(r.nav.right * 10) / 10,
      navBottom: Math.round(r.nav.bottom * 10) / 10,
      resumeH: resume?.height,
      contact: contact && { x: contact.x, right: contact.right, scrollW: contact.scrollW, clientW: contact.clientW },
      enterTop: r.enter?.y,
      enterVisible: r.enterVisible,
      overlapPx: r.enter ? Math.round((r.nav.bottom - r.enter.y) * 10) / 10 : null,
      overlapHorizontally: r.enter ? r.enter.x < r.nav.right && r.enter.right > r.nav.x : null,
      hits: r.hits,
      brand: r.brand && { x: r.brand.x, right: r.brand.right },
    };
    console.log(JSON.stringify(summary));
    out.push({ ...summary, raw: r });
    await page.screenshot({ path: `qa/shots/qa-verify-visual-header-${theme}-${s.name}.png`, clip: { x: 0, y: 0, width: r.vw, height: 150 } });
    await ctx.close();
  }
}
await browser.close();
import { writeFileSync } from 'node:fs';
writeFileSync('qa/qa-verify-visual-header-phone.json', JSON.stringify(out, null, 2));
