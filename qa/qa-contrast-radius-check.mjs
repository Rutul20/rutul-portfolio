// QA lens "contrast" side check: border-radius of header controls before vs during keyboard focus.
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4100/?mode=still', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const sels = ['header a[href="#city"]', 'button[aria-controls="theme-options"]', 'header nav a[href="/resume/"]', 'header nav a[href="#contact"]', '.legend-rail a[href="#about"]', '.enter-3d'];
for (const s of sels) {
  const before = await page.evaluate((q) => { const el = document.querySelector(q); return el ? getComputedStyle(el).borderRadius : null; }, s);
  if (before === null) { console.log(s, 'not present'); continue; }
  await page.keyboard.press('Shift');
  const after = await page.evaluate((q) => { const el = document.querySelector(q); el.focus({ preventScroll: true }); return [el.matches(':focus-visible'), getComputedStyle(el).borderRadius]; }, s);
  console.log(s.padEnd(42), 'unfocused', before.padEnd(10), 'focus-visible', after[0], after[1]);
  await page.evaluate(() => document.activeElement.blur());
}
await browser.close();
