// QA skeptic (lens: contrast): does keyboard focus change rounded-full controls into 6px rectangles?
// Reaches each control with real Tab presses, reads computed border-radius before/while focused,
// and saves zoomed header crops (as-is, and with the global focus radius neutralised for comparison).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const OUT = 'qa/shots/contrast/verify-radius';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

const targets = [
  ['brand', 'header a[href="#city"]'],
  ['map', 'button[aria-controls="tour-map"]'],
  ['theme', 'button[aria-controls="theme-options"]'],
  ['resume', 'header nav a[href="/resume/"]'],
  ['contact', 'header nav a[href="#contact"]'],
  ['rail-about', '.legend-rail a[href="#about"]'],
  ['skip', 'header a[href="#main"]'],
];

async function run(theme, kind) {
  const ctx = kind === 'phone'
    ? await browser.newContext({ ...devices['Pixel 7'] })
    : await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  await page.goto(kind === 'phone' ? 'http://localhost:4100/?mode=still' : 'http://localhost:4100/', { waitUntil: 'load' });
  if (kind === 'desktop') {
    await page.waitForSelector('.live.is-shown', { timeout: 30000 }).catch(() => console.log('  (live 3D not shown)'));
    await page.waitForTimeout(1500);
  } else await page.waitForTimeout(1200);

  const rows = [];
  // unfocused radii
  const before = {};
  for (const [name, sel] of targets) {
    before[name] = await page.evaluate((q) => {
      const el = document.querySelector(q);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { radius: getComputedStyle(el).borderTopLeftRadius, visible: r.width > 1 && getComputedStyle(el).display !== 'none', w: r.width, h: r.height };
    }, sel);
  }
  // Tab from the top of the document, recording what gets focus
  await page.evaluate(() => window.scrollTo(0, 0));
  // no click: a fresh page starts sequential focus navigation at the document start

  const seen = new Set();
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(120);
    const info = await page.evaluate((tg) => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const hit = tg.find(([, q]) => el.matches(q));
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { name: hit ? hit[0] : el.tagName + '.' + el.className.toString().slice(0, 30), fv: el.matches(':focus-visible'), radius: cs.borderTopLeftRadius, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineOffset, bg: cs.backgroundColor, box: [r.x, r.y, r.width, r.height] };
    }, targets);
    if (!info || seen.has(info.name)) continue;
    seen.add(info.name);
    const b = before[info.name];
    rows.push({ theme, kind, el: info.name, unfocused: b ? b.radius : '?', focused: info.radius, focusVisible: info.fv, outline: info.outline, bg: info.bg, box: info.box.map((v) => Math.round(v)) });
    if (targets.some(([n]) => n === info.name)) {
      const [x, y, w, h] = info.box;
      const clip = { x: Math.max(0, x - 24), y: Math.max(0, y - 24), width: w + 48, height: h + 48 };
      await page.screenshot({ path: `${OUT}/${theme}-${kind}-${info.name}-focused.png`, clip });
      // comparison: same control, global :focus-visible radius neutralised (layered radius wins again)
      const tag = await page.addStyleTag({ content: ':focus-visible{border-radius:revert-layer !important}' });
      await page.waitForTimeout(60);
      const fixedR = await page.evaluate(() => getComputedStyle(document.activeElement).borderTopLeftRadius);
      await page.screenshot({ path: `${OUT}/${theme}-${kind}-${info.name}-focused-ifFixed.png`, clip });
      rows[rows.length - 1].radiusIfFixed = fixedR;
      await tag.evaluate((n) => n.remove());
    }
  }
  await ctx.close();
  return rows;
}

const all = [];
for (const theme of ['light', 'dark']) for (const kind of ['desktop', 'phone']) {
  const r = await run(theme, kind);
  all.push(...r);
  for (const row of r) console.log(`${theme.padEnd(5)} ${kind.padEnd(7)} ${row.el.padEnd(30)} unfocused=${String(row.unfocused).padEnd(14)} focused=${String(row.focused).padEnd(6)} fv=${row.focusVisible} ifFixed=${row.radiusIfFixed ?? '-'} bg=${row.bg}`);
}
fs.writeFileSync('qa/qa-verify-contrast-focus-radius.json', JSON.stringify(all, null, 2));
await browser.close();
