// Skeptic re-check (theme-behaviour lens): does Enter on a theme radio drop focus to <body>?
// Usage: node qa/qa-verify-theme-behaviour-enter-focus.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3100';
const OUT = 'qa/shots/theme-behaviour/verify-enter-focus';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

const describe = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return {
      tag: a?.tagName,
      label: a?.getAttribute('aria-label') || a?.getAttribute('value') || (a?.textContent || '').trim().slice(0, 40),
      panelOpen: !!document.getElementById('theme-options'),
      theme: document.documentElement.dataset.theme,
      pref: document.documentElement.dataset.themePref,
    };
  });

const results = [];
const runs = [
  { name: 'desktop-1440', ctx: { viewport: { width: 1440, height: 900 } }, path: '/', live: true },
  { name: 'pixel7', ctx: { ...devices['Pixel 7'] }, path: '/?mode=still', live: false },
];

for (const dev of runs) {
  for (const theme of ['light', 'dark']) {
    for (const closeKey of ['Enter', 'Escape']) {
      const tag = `${dev.name}-${theme}-${closeKey}`;
      const ctx = await browser.newContext({ ...dev.ctx });
      await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
      const page = await ctx.newPage();
      await page.goto(base + dev.path, { waitUntil: 'load' });
      if (dev.live) await page.waitForSelector('.live.is-shown', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(dev.live ? 1500 : 1200);

      // Real Tab presses until the theme button is focused
      let tabs = 0;
      for (; tabs < 25; tabs++) {
        await page.keyboard.press('Tab');
        const l = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || '');
        if (/^Theme:/.test(l)) break;
      }
      const onButton = await describe(page);
      await page.keyboard.press('Enter'); // open
      await page.waitForTimeout(150);
      const afterOpen = await describe(page);
      await page.keyboard.press('ArrowDown'); // move selection
      await page.waitForTimeout(150);
      const afterArrow = await describe(page);
      await page.screenshot({ path: `${OUT}/${tag}-1-open.png` });
      await page.keyboard.press(closeKey);
      await page.waitForTimeout(200);
      const afterClose = await describe(page);
      await page.screenshot({ path: `${OUT}/${tag}-2-closed.png` });
      const btnFocusVisible = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /^Theme:/.test(x.getAttribute('aria-label') || ''));
        return b === document.activeElement && b.matches(':focus-visible');
      });
      await page.keyboard.press('Tab');
      const nextTab = await describe(page);
      await page.keyboard.press('Shift+Tab');
      const thenShiftTab = await describe(page);
      const r = { tag, tabsToButton: tabs + 1, onButton, afterOpen, afterArrow, afterClose, btnFocusVisible, nextTab, thenShiftTab };
      results.push(r);
      console.log(tag, '| close ->', afterClose.tag, JSON.stringify(afterClose.label), 'open:', afterClose.panelOpen, '| next Tab ->', nextTab.tag, JSON.stringify(nextTab.label));
      await ctx.close();
    }
  }
}

writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
