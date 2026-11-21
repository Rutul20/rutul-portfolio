// QA (lens: visual review) — sweep the landing (globe -> clouds -> city) in both themes and log the mean
// luminance of every frame, to catch a bright flash or a muddy fog. Also opens the phone Map panel.
// Usage: cd /d/rutul-portfolio && node qa/qa-visual-fog.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import sharp from 'sharp';

const BASE = process.argv[2] || 'http://localhost:4100';
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

async function frameStats(buf) {
  const { data, info } = await sharp(buf).resize(160, 100, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, sat = 0;
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    sum += 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    sat += Math.max(r, g, b) - Math.min(r, g, b);
  }
  const n = data.length / 3;
  return { meanLum: +(sum / n).toFixed(3), meanChroma: +(sat / n).toFixed(1) };
}

async function sweep(kind, theme) {
  const browser = await chromium.launch(kind === 'desk' ? { headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } : { headless: true });
  const ctx = await browser.newContext(kind === 'desk' ? { viewport: { width: 1440, height: 900 } } : { ...devices['Pixel 7'] });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  await page.goto(BASE + (kind === 'desk' ? '/' : '/?mode=still'), { waitUntil: 'networkidle' });
  if (kind === 'desk') await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const range = await page.evaluate(() => document.getElementById('city').offsetHeight - innerHeight);
  await page.evaluate(() => window.scrollTo({ top: 40, behavior: 'instant' }));
  await page.waitForTimeout(1200);
  const rows = [];
  for (let f = 0.6; f <= 1.0001; f += 0.04) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(range * f));
    await page.waitForTimeout(kind === 'desk' ? 900 : 700);
    const s = await frameStats(await page.screenshot());
    const clouds = await page.evaluate(() => {
      const c = document.querySelector('.clouds');
      const cs = getComputedStyle(c);
      return { op: cs.opacity, vis: cs.visibility, fill: getComputedStyle(c.querySelector('.cloud-fill')).opacity };
    });
    rows.push(`${f.toFixed(2)} lum=${s.meanLum} chroma=${s.meanChroma} cloudsOpacity=${(+clouds.op).toFixed(2)} fill=${(+clouds.fill).toFixed(2)}`);
  }
  console.log(`\n${kind} ${theme}:\n` + rows.join('\n'));
  if (kind === 'phone') {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(500);
    const mapBtn = page.locator('header nav button', { hasText: 'Map' });
    if (await mapBtn.count()) {
      await mapBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `qa/shots/qa-visual-${theme}-phone-map-panel.png` });
    }
  }
  await browser.close();
}

for (const theme of ['light', 'dark']) {
  await sweep('desk', theme);
  await sweep('phone', theme);
}
