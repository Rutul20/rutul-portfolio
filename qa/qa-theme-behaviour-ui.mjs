// QA (theme behaviour lens): persistence, System live-follow, keyboard operation, ARIA and panel geometry.
// Usage: node qa/qa-theme-behaviour-ui.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3100';
const OUT = 'qa/shots/theme-behaviour';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const log = {};
const fails = [];
const check = (name, ok, detail) => {
  (log.checks ||= []).push({ name, ok, detail });
  if (!ok) fails.push({ name, detail });
};

const state = (page) =>
  page.evaluate(() => {
    const r = document.documentElement;
    const btn = [...document.querySelectorAll('button')].find((b) => /^Theme:/.test(b.getAttribute('aria-label') || ''));
    return {
      theme: r.dataset.theme,
      pref: r.dataset.themePref,
      stored: localStorage.getItem('theme'),
      meta: document.querySelector('meta[name="theme-color"]')?.content,
      htmlBg: getComputedStyle(r).backgroundColor,
      btnLabel: btn?.getAttribute('aria-label'),
      btnExpanded: btn?.getAttribute('aria-expanded'),
    };
  });
const themeBtn = (page) => page.getByRole('button', { name: /^Theme:/ });

async function loadLive(page, path = '/') {
  await page.goto(base + path, { waitUntil: 'load' });
  if (path === '/') await page.waitForSelector('.live.is-shown', { timeout: 30000 }).catch(() => check('live 3D shown', false, 'timeout'));
  await page.waitForTimeout(1500);
}

// ── (2) persistence ────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await loadLive(page);
  const s0 = await state(page);
  await themeBtn(page).click();
  await page.getByRole('radio', { name: 'Dark' }).check({ force: true }); // native radio is sr-only; label click path tested below
  const s1 = await state(page);
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const s2 = await state(page);
  check('persist: dark via UI then reload stays dark', s2.theme === 'dark' && s2.pref === 'dark' && s2.stored === 'dark' && s2.btnLabel === 'Theme: Dark', { s0, s1, s2 });
  // choose System via a real label click
  await themeBtn(page).click();
  await page.locator('#theme-options label', { hasText: 'System' }).click();
  const s3 = await state(page);
  check('label click on System applies immediately (OS light)', s3.theme === 'light' && s3.pref === 'system', s3);
  await page.keyboard.press('Escape');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const s4 = await state(page);
  check('persist: system + OS dark after reload -> dark', s4.theme === 'dark' && s4.pref === 'system' && s4.btnLabel === 'Theme: System' && s4.meta === '#161514', s4);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const s5 = await state(page);
  check('persist: system + OS light after reload -> light', s5.theme === 'light' && s5.meta === '#efebe4', s5);

  // ── (3) live follow without reload ──────────────────────────────
  const navCount0 = await page.evaluate(() => performance.getEntriesByType('navigation').length + ':' + performance.timeOrigin);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(150);
  const l1 = await state(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(150);
  const l2 = await state(page);
  const navCount1 = await page.evaluate(() => performance.getEntriesByType('navigation').length + ':' + performance.timeOrigin);
  check('system live-follow: OS dark flips theme + meta', l1.theme === 'dark' && l1.meta === '#161514' && l1.htmlBg === 'rgb(22, 21, 20)', l1);
  check('system live-follow: OS light flips back', l2.theme === 'light' && l2.meta === '#efebe4' && l2.htmlBg === 'rgb(239, 235, 228)', l2);
  check('system live-follow happened without reload', navCount0 === navCount1, { navCount0, navCount1 });
  // explicit choice must NOT follow the OS
  await themeBtn(page).click();
  await page.locator('#theme-options label', { hasText: 'Light' }).click();
  await page.keyboard.press('Escape');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(150);
  const l3 = await state(page);
  check('explicit Light ignores OS dark', l3.theme === 'light' && l3.meta === '#efebe4', l3);
  await ctx.close();
}

// ── (4)(5) keyboard + ARIA + geometry, desktop and Pixel 7 ─────────
for (const dev of [
  { name: 'desktop-1440', ctx: { viewport: { width: 1440, height: 900 } }, path: '/' },
  { name: 'pixel7', ctx: { ...devices['Pixel 7'] }, path: '/?mode=still' },
]) {
  for (const startTheme of ['light', 'dark']) {
    const tag = `${dev.name}-${startTheme}`;
    const ctx = await browser.newContext({ ...dev.ctx, colorScheme: 'light' });
    await ctx.addInitScript((t) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('theme', t); sessionStorage.setItem('seeded', '1'); } }, startTheme);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text().slice(0, 200)));
    if (dev.path === '/') await loadLive(page);
    else {
      await page.goto(base + dev.path, { waitUntil: 'load' });
      await page.waitForTimeout(1200);
    }
    // Tab until the theme button has focus
    let presses = 0, focusedLabel = null;
    for (; presses < 20; presses++) {
      await page.keyboard.press('Tab');
      focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
      if (/^Theme:/.test(focusedLabel || '')) break;
    }
    const btnFocus = await page.evaluate(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { fv: el.matches(':focus-visible'), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, offset: cs.outlineOffset };
    });
    check(`${tag}: Tab reaches theme button`, /^Theme:/.test(focusedLabel || ''), { presses: presses + 1, focusedLabel, btnFocus });
    const ariaClosed = await themeBtn(page).getAttribute('aria-expanded');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const opened = await page.evaluate(() => {
      const a = document.activeElement;
      const lab = a?.closest('label');
      const panel = document.getElementById('theme-options');
      const r = panel?.getBoundingClientRect();
      const btn = [...document.querySelectorAll('button')].find((b) => /^Theme:/.test(b.getAttribute('aria-label') || ''));
      let hit = null;
      if (r) {
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        hit = panel.contains(e) ? 'panel' : e?.outerHTML.slice(0, 120);
      }
      const lcs = lab && getComputedStyle(lab);
      return {
        expanded: btn?.getAttribute('aria-expanded'),
        activeTag: a?.tagName,
        activeType: a?.type,
        activeChecked: a?.checked,
        activeValue: a?.value,
        labelOutline: lcs ? `${lcs.outlineStyle} ${lcs.outlineWidth} ${lcs.outlineColor}` : null,
        rect: r && { left: +r.left.toFixed(1), right: +r.right.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) },
        vw: innerWidth,
        vh: innerHeight,
        docW: document.documentElement.scrollWidth,
        hit,
        panelBg: panel && getComputedStyle(panel).backgroundColor,
      };
    });
    await page.screenshot({ path: `${OUT}/ui-${tag}-panel-open.png` });
    check(`${tag}: aria-expanded false -> true`, ariaClosed === 'false' && opened.expanded === 'true', { ariaClosed, opened: opened.expanded });
    check(`${tag}: focus lands on checked radio`, opened.activeTag === 'INPUT' && opened.activeType === 'radio' && opened.activeChecked && opened.activeValue === startTheme, opened);
    check(`${tag}: focused radio shows visible indicator`, /solid 3px/.test(opened.labelOutline || ''), opened.labelOutline);
    check(
      `${tag}: panel fully inside viewport`,
      opened.rect && opened.rect.left >= 0 && opened.rect.right <= opened.vw && opened.rect.top >= 0 && opened.rect.bottom <= opened.vh && opened.docW <= opened.vw,
      { rect: opened.rect, vw: opened.vw, vh: opened.vh, docW: opened.docW },
    );
    check(`${tag}: panel not covered by other layers`, opened.hit === 'panel', opened.hit);
    // ARIA structure
    const aria = await page.evaluate(() => {
      const fs = document.querySelector('#theme-options fieldset');
      const lg = fs?.querySelector('legend');
      const radios = [...(fs?.querySelectorAll('input[type=radio]') || [])].map((i) => ({ name: i.name, value: i.value, label: i.closest('label')?.textContent.trim() }));
      return { fieldset: !!fs, legend: lg?.textContent.trim(), radios };
    });
    const groupOk = await page.getByRole('group', { name: 'Theme' }).count();
    const radioNames = [];
    for (const n of ['Light', 'Dark', 'System']) radioNames.push(`${n}:${await page.getByRole('group', { name: 'Theme' }).getByRole('radio', { name: n, exact: true }).count()}`);
    check(`${tag}: fieldset/legend "Theme" with 3 named radios`, aria.fieldset && aria.legend === 'Theme' && groupOk === 1 && radioNames.every((x) => x.endsWith(':1')), { aria, groupOk, radioNames });
    // Arrow keys change theme immediately
    const seq = [];
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(60);
      seq.push({ key, ...(await state(page)), focused: await page.evaluate(() => document.activeElement?.value) });
    }
    const expectOrder = startTheme === 'light' ? ['dark', 'system', 'light', 'system'] : ['system', 'light', 'dark', 'light'];
    check(
      `${tag}: arrow keys change theme immediately`,
      seq.every((s, i) => s.pref === expectOrder[i] && s.stored === expectOrder[i]),
      seq.map((s) => `${s.key}->${s.pref}/${s.theme} label=${s.btnLabel}`),
    );
    // Enter closes and focus returns to button
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const afterEnter = await page.evaluate(() => ({
      open: !!document.getElementById('theme-options'),
      active: document.activeElement?.tagName + ' ' + (document.activeElement?.getAttribute('aria-label') || ''),
    }));
    check(`${tag}: Enter closes panel`, !afterEnter.open, afterEnter);
    check(`${tag}: Enter returns focus to theme button`, /Theme:/.test(afterEnter.active), afterEnter);
    // what does the next Tab do after Enter-close?
    await page.keyboard.press('Tab');
    const afterEnterTab = await page.evaluate(() => (document.activeElement?.textContent || '').trim().slice(0, 40) + ' <' + document.activeElement?.tagName + '>');
    log[`${tag} next Tab after Enter-close`] = afterEnterTab;

    // Escape closes and focus returns
    await themeBtn(page).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const afterEsc = await page.evaluate(() => ({
      open: !!document.getElementById('theme-options'),
      active: document.activeElement?.getAttribute('aria-label'),
      expanded: [...document.querySelectorAll('button')].find((b) => /^Theme:/.test(b.getAttribute('aria-label') || ''))?.getAttribute('aria-expanded'),
    }));
    check(`${tag}: Escape closes, focus back on button, aria-expanded false`, !afterEsc.open && /^Theme:/.test(afterEsc.active || '') && afterEsc.expanded === 'false', afterEsc);
    // Space on the button also opens (native button)
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    const spaceOpen = await page.evaluate(() => !!document.getElementById('theme-options'));
    check(`${tag}: Space opens panel`, spaceOpen, spaceOpen);
    // Tab out of the panel: does it stay open?
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
    const tabOut = await page.evaluate(() => ({
      open: !!document.getElementById('theme-options'),
      active: (document.activeElement?.textContent || '').trim().slice(0, 30) + ' <' + document.activeElement?.tagName + '>',
      activeInPanel: !!document.getElementById('theme-options')?.contains(document.activeElement),
    }));
    log[`${tag} Tab out of open panel`] = tabOut;
    if (tabOut.open && !tabOut.activeInPanel) await page.screenshot({ path: `${OUT}/ui-${tag}-tabbed-away-panel-still-open.png` });
    await page.keyboard.press('Escape');
    // click outside closes
    await themeBtn(page).click();
    await page.waitForTimeout(150);
    const vp = page.viewportSize();
    await page.mouse.click(Math.round(vp.width * 0.5), Math.round(vp.height * 0.6));
    await page.waitForTimeout(150);
    const outside = await page.evaluate(() => !!document.getElementById('theme-options'));
    check(`${tag}: click outside closes`, !outside, outside);
    // clicking the button again toggles closed
    await themeBtn(page).click();
    await page.waitForTimeout(100);
    await themeBtn(page).click();
    await page.waitForTimeout(100);
    const toggled = await page.evaluate(() => !!document.getElementById('theme-options'));
    check(`${tag}: button click toggles closed`, !toggled, toggled);
    log[`${tag} console`] = errors;
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify({ fails, log }, null, 1));
