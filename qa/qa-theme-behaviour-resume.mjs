// QA (theme behaviour lens): /resume/ follows the theme, prints dark-on-white in dark theme,
// and '/' + '/resume/' log no console errors / hydration warnings in either theme.
// Usage: node qa/qa-theme-behaviour-resume.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3100';
const OUT = 'qa/shots/theme-behaviour';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const out = { checks: [], console: {} };
const check = (name, ok, detail) => out.checks.push({ name, ok, detail });

const lum = (c) => {
  const m = c.match(/[\d.]+/g).map(Number);
  const [r, g, b] = m.slice(0, 3).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
};

const styles = (page) =>
  page.evaluate(() => {
    const r = document.documentElement;
    const rp = document.querySelector('.resume-page');
    const cs = (el) => el && getComputedStyle(el);
    // every text-bearing element in the résumé: its colour, and any non-transparent background
    const texts = [];
    const bgs = new Set();
    for (const el of rp.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') bgs.add(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}: ${s.backgroundColor}`);
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own) texts.push({ sel: `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ').join('.') : ''}`, color: s.color, text: el.textContent.trim().slice(0, 30) });
    }
    return {
      theme: r.dataset.theme,
      pref: r.dataset.themePref,
      meta: document.querySelector('meta[name="theme-color"]')?.content,
      htmlBg: cs(r).backgroundColor,
      bodyBg: cs(document.body).backgroundColor,
      bodyColor: cs(document.body).color,
      pageBg: cs(rp).backgroundColor,
      h1: cs(rp.querySelector('h1')).color,
      soft: cs(rp.querySelector('.text-ink-soft'))?.color,
      link: cs(rp.querySelector('a.link'))?.color,
      colorScheme: cs(r).colorScheme,
      texts,
      bgs: [...bgs],
    };
  });

// ── (6) /resume/ follows the theme, and print under dark ───────────
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  await page.goto(base + '/resume/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const scr = await styles(page);
  await page.screenshot({ path: `${OUT}/resume-${theme}-screen.png` });
  const expectBg = theme === 'dark' ? 'rgb(31, 30, 28)' : 'rgb(250, 248, 244)';
  check(`resume ${theme}: screen palette follows theme`, scr.theme === theme && scr.pageBg === expectBg, { theme: scr.theme, pageBg: scr.pageBg, bodyColor: scr.bodyColor, h1: scr.h1, soft: scr.soft });
  check(`resume ${theme}: theme-color meta matches (3s after load)`, scr.meta === (theme === 'dark' ? '#161514' : '#efebe4'), { meta: scr.meta, theme: scr.theme });
  const worstScreen = scr.texts.map((t) => ({ ...t, cr: contrast(t.color, scr.pageBg) })).sort((a, b) => a.cr - b.cr)[0];
  check(`resume ${theme}: lowest screen text contrast`, worstScreen.cr >= 4.5, worstScreen);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(200);
  const pr = await styles(page);
  await page.screenshot({ path: `${OUT}/resume-${theme}-print-emulated.png`, fullPage: true });
  if (theme === 'dark') await page.pdf({ path: `${OUT}/resume-dark-print.pdf`, format: 'A4', printBackground: true }).catch((e) => check('pdf', false, e.message));
  const worst = pr.texts.map((t) => ({ ...t, cr: contrast(t.color, 'rgb(255, 255, 255)') })).sort((a, b) => a.cr - b.cr);
  check(`resume ${theme} print: white backgrounds`, pr.htmlBg === 'rgb(255, 255, 255)' && pr.pageBg === 'rgb(255, 255, 255)', { htmlBg: pr.htmlBg, bodyBg: pr.bodyBg, pageBg: pr.pageBg, otherBgs: pr.bgs });
  check(`resume ${theme} print: dark text (body/h1/soft/link)`, [pr.bodyColor, pr.h1, pr.soft, pr.link].every((c) => contrast(c, 'rgb(255, 255, 255)') >= 4.5), { body: pr.bodyColor, h1: pr.h1, soft: pr.soft, link: pr.link, colorScheme: pr.colorScheme });
  check(`resume ${theme} print: every text node >= 4.5:1 on white`, worst[0].cr >= 4.5, { worst: worst.slice(0, 3), count: worst.length });
  await ctx.close();
}

// /resume/ with pref=system: does it follow an OS change live (as '/' does)?
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  await ctx.addInitScript(() => localStorage.setItem('theme', 'system'));
  const page = await ctx.newPage();
  await page.goto(base + '/resume/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const a = await styles(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(500);
  const b = await styles(page);
  await page.screenshot({ path: `${OUT}/resume-system-after-os-dark.png` });
  check('resume system: follows OS dark live (direct load)', b.theme === 'dark', { before: { theme: a.theme, pageBg: a.pageBg }, after: { theme: b.theme, pageBg: b.pageBg, meta: b.meta, colorScheme: b.colorScheme } });
  // client-side navigation from '/' -> '/resume/'
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.getByLabel('Site').getByRole('link', { name: 'Résumé view' }).click();
  await page.waitForURL('**/resume/');
  await page.waitForTimeout(1500);
  const c = await styles(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(500);
  const d = await styles(page);
  check('resume system: follows OS dark live (client nav from /)', d.theme === 'dark', { before: c.theme, after: d.theme, pageBg: d.pageBg });
  await ctx.close();
}

// ── (7) console errors / hydration warnings ────────────────────────
for (const v of [
  { name: 'desktop', ctx: { viewport: { width: 1440, height: 900 } }, home: '/' },
  { name: 'pixel7', ctx: { ...devices['Pixel 7'] }, home: '/?mode=still' },
]) {
  for (const theme of ['light', 'dark', 'system-osdark']) {
    const pref = theme.startsWith('system') ? 'system' : theme;
    const ctx = await browser.newContext({ ...v.ctx, colorScheme: theme === 'system-osdark' ? 'dark' : 'light' });
    await ctx.addInitScript((t) => localStorage.setItem('theme', t), pref);
    const page = await ctx.newPage();
    const msgs = [];
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type()) || /hydrat|did not match|mismatch/i.test(m.text())) msgs.push(`[${m.type()}] ${m.text().slice(0, 220)}`);
    });
    page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message.slice(0, 220)}`));
    for (const path of [v.home, '/resume/']) {
      await page.goto(base + path, { waitUntil: 'load' });
      if (path === '/' ) await page.waitForSelector('.live.is-shown', { timeout: 30000 }).catch(() => msgs.push('[qa] live never shown'));
      await page.waitForTimeout(2500);
      const overlay = await page.evaluate(() => {
        const p = document.querySelector('nextjs-portal');
        const t = p?.shadowRoot?.textContent || '';
        const m = t.match(/(\d+)\s*Issues?/i);
        return m ? m[0] : null;
      });
      if (overlay) msgs.push(`[next-overlay ${path}] ${overlay}`);
    }
    out.console[`${v.name}-${theme}`] = msgs;
    await ctx.close();
  }
}
await browser.close();
for (const c of out.checks) console.log(c.ok ? 'PASS' : 'FAIL', c.name, JSON.stringify(c.detail));
console.log(JSON.stringify(out.console, null, 1));
