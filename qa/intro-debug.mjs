// QA helper for the landing: (1) does the globe change size when the live 3D replaces the picture?
// (2) frame times while scrolling slowly through the whole dive (looking for hitches at the swap).
// Usage: node qa/intro-debug.mjs [baseUrl]
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = process.argv[2] || 'http://localhost:3100';
const gpu = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, args: gpu });

// globe radius in pixels: widest run of non-sky pixels on the row through the globe's centre
async function globeWidth(png) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let best = 0;
  for (let y = Math.floor(info.height * 0.25); y < info.height * 0.75; y += 4) {
    let run = 0;
    for (let x = Math.floor(info.width * 0.45); x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const sea = b > r + 25 && b > 150; // globe ocean is blue; dusk sky is lavender/peach
      const land = g > b + 10 && g > 150;
      if (sea || land) run++;
    }
    best = Math.max(best, run);
  }
  return best;
}

for (const [w, h] of [[1440, 900], [1100, 900], [1000, 1000]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(250);
  const before = await page.screenshot();
  await page.waitForSelector('.live.is-shown', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const after = await page.screenshot();
  await sharp(before).toFile(`qa/shots/intro-${w}x${h}-picture.png`);
  await sharp(after).toFile(`qa/shots/intro-${w}x${h}-live.png`);
  console.log(`${w}x${h}: globe width on the picture ${await globeWidth(before)} px → live ${await globeWidth(after)} px`);
  await page.close();
}

// frame times through the dive
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(base, { waitUntil: 'load' });
await page.waitForSelector('.live.is-shown', { timeout: 30000 });
await page.waitForTimeout(1500);
const frames = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const hero = document.getElementById('city');
      const max = hero.offsetHeight - innerHeight + innerHeight * 0.6;
      const dur = 8000;
      const out = [];
      let start = 0, last = 0;
      const step = (t) => {
        if (!start) start = last = t;
        const k = Math.min(1, (t - start) / dur);
        out.push([+(window.scrollY / (hero.offsetHeight - innerHeight)).toFixed(3), +(t - last).toFixed(1)]);
        last = t;
        window.scrollTo(0, max * k);
        if (k < 1) requestAnimationFrame(step);
        else resolve(out.slice(2));
      };
      requestAnimationFrame(step);
    }),
);
const slow = frames.filter(([, d]) => d > 25);
console.log(`dive: ${frames.length} frames, avg ${(frames.reduce((a, [, d]) => a + d, 0) / frames.length).toFixed(1)} ms`);
console.log(`frames over 25 ms (intro, ms): ${JSON.stringify(slow)}`);
await browser.close();
