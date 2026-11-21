// One-off: Sasta results screenshot, cropped below the search header so it shows the
// like-for-like comparison and the honest "not listed" rows. Needs Sasta's dev server on :5173.
import { chromium } from 'playwright';
import sharp from 'sharp';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 640, height: 1200 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/compare?q=amul%20butter%20500g', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(30000);
const box = await page.getByText(/Comparing only the/).first().boundingBox();
const png = await page.screenshot({ clip: { x: 0, y: Math.max(0, box.y - 18), width: 640, height: 400 } });
await sharp(png).resize(1280).webp({ quality: 82 }).toFile('public/shots/sasta-compare.webp');
console.log('saved sasta-compare at y', Math.round(box.y));
await browser.close();
