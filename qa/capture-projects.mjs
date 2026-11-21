// One-off: screenshots of the side projects for the workshop stop, saved to public/shots.
// Needs NEXORA's production build served on :4180 (node scripts/serve.mjs D:/nexora/dist 4180)
// and Sasta's dev server on :5173.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/shots', { recursive: true });
const save = async (png, name) => {
  await sharp(png).resize(1280).webp({ quality: 80 }).toFile(`public/shots/${name}.webp`);
  console.log('saved', name);
};

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

if (!process.argv.includes('--skip-nexora')) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:4180/?quality=high', { waitUntil: 'networkidle' });
  const enter = page.getByRole('button', { name: 'Enter NEXORA' });
  await enter.waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Enter NEXORA/.test(x.textContent || ''));
    return b && !b.disabled;
  }, null, { timeout: 60000 });
  await enter.click();
  await page.waitForTimeout(6500);
  await save(await page.screenshot(), 'nexora-universe');
  await page.keyboard.press('Enter'); // fly through the portal you face (Fashion)
  await page.waitForTimeout(9000);
  await page.keyboard.press('Enter'); // pull the centred piece into the 360° viewer
  await page.waitForTimeout(3500);
  await save(await page.screenshot(), 'nexora-viewer');
  await page.close();
}

if (!process.argv.includes('--skip-sasta')) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5173/compare?q=amul%20butter%20500g', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(30000);
  await save(await page.screenshot(), 'sasta-compare');
  await page.close();
}

await browser.close();
