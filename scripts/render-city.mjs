// Renders the live 3D city at every stop into pictures for phones and devices without WebGL,
// plus the social share image. Starts its own dev server, uses the real GPU through Playwright.
// Usage: npm run renders
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { rendersHash } from './renders-hash.mjs';

// Set RENDER_BASE (e.g. http://localhost:3100) to reuse a dev server that is already running.
const PORT = 3101;
const BASE = process.env.RENDER_BASE || `http://localhost:${PORT}`;
const OUT = 'public/renders';
const STOPS = 8;

const VIEWS = [
  // landscape: desktop before 3D loads, and desktops without WebGL
  { name: 'landscape', viewport: { width: 1600, height: 1000 }, scale: 1, widths: [1600, 960] },
  // portrait: phones (the city sits in the top half, above the cards). Transparent, so the page's
  // light or dark wall colour shows behind the city in either theme.
  { name: 'portrait', viewport: { width: 540, height: 960 }, scale: 1.5, widths: [810, 540] },
];

/** Soft focus at the top edge, baked in (phones skip the live CSS blur). */
async function bakeTiltShift(png) {
  const { width: W, height: H } = await sharp(png).metadata();
  const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="0.06" stop-color="#fff" stop-opacity="1"/>
    <stop offset="0.2" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  const blurredTop = await sharp(png).blur(5).composite([{ input: Buffer.from(mask), blend: 'dest-in' }]).png().toBuffer();
  return sharp(png).composite([{ input: blurredTop, blend: 'over' }]).png().toBuffer();
}

async function waitForServer(url, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(`Dev server did not start at ${url}`);
}

const server = process.env.RENDER_BASE ? null : spawn('npx', ['next', 'dev', '-p', String(PORT)], { shell: true, stdio: 'ignore' });
const stopServer = () => {
  if (!server) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true });
  else server.kill('SIGTERM');
};

try {
  await waitForServer(BASE);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const files = [];

  // Put the scene in a state (landing value + tour stop) and wait until it has settled on screen.
  const renderState = async (page, intro, stop) => {
    await page.evaluate(([intro, stop]) => {
      window.__renderReady = -1;
      window.__setIntro(intro);
      window.__setProgress(stop);
    }, [intro, stop]);
    await page.waitForFunction(() => window.__renderReady !== -1, null, { timeout: 30000 });
  };
  const renderStop = (page, i) => renderState(page, 1, i);
  // The landing's globe pictures, from the whole toy globe (g0) to close over Gujarat (g3), all before
  // the clouds. StillLayer zooms each one towards the Vadodara pin and hands over to the next.
  // Spaced so each step is a similar zoom (~2.3×) and the globe's turn happens early.
  const GLOBE_FRAMES = [
    { name: 'g0', intro: 0 },
    { name: 'g1', intro: 0.3 },
    { name: 'g2', intro: 0.5 },
    { name: 'g3', intro: 0.63 },
    { name: 'g4', intro: 0.76 },
  ];
  const meta = { frames: GLOBE_FRAMES, landscape: {}, portrait: {} };
  const SHOTS = [
    ...GLOBE_FRAMES.map((g) => ({ ...g, stop: 0, globe: true })),
    ...Array.from({ length: STOPS }, (_, i) => ({ name: String(i), intro: 1, stop: i })),
  ];

  for (const v of VIEWS) {
    const page = await browser.newPage({ viewport: v.viewport, deviceScaleFactor: v.scale });
    await page.goto(`${BASE}/?render=1${v.sky ? '&sky=1' : ''}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.__setProgress === 'function' && window.__renderReady !== undefined, null, { timeout: 60000 });
    await page.waitForFunction(() => window.__globeReady === true, null, { timeout: 60000 });
    for (const shot of SHOTS) {
      await renderState(page, shot.intro, shot.stop);
      if (shot.globe) meta[v.name][shot.name] = await page.evaluate(() => window.__renderMeta);
      let png = await page.screenshot({ omitBackground: !v.sky });
      if (v.name === 'portrait') png = await bakeTiltShift(png);
      for (const w of v.widths) {
        const file = `/renders/${v.name}-${shot.name}-${w}.webp`;
        const img = v.sky ? sharp(png).removeAlpha() : sharp(png);
        await img.resize(w).webp({ quality: 74, alphaQuality: 90, effort: 5 }).toFile(`public${file}`);
        files.push(file);
      }
      console.log(`rendered ${v.name} ${shot.name}`);
    }
    await page.close();
  }

  // Social share image: the whole city at dusk, sky included.
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await og.goto(`${BASE}/?render=1&sky=1&frame=center`, { waitUntil: 'networkidle' });
  await og.waitForFunction(() => typeof window.__setProgress === 'function' && window.__renderReady !== undefined, null, { timeout: 60000 });
  await renderStop(og, 0);
  await sharp(await og.screenshot()).jpeg({ quality: 82 }).toFile('public/og.jpg');
  console.log('rendered og.jpg');

  await browser.close();
  // where the Vadodara pin sits in each globe picture, and how high the camera is (read by StillLayer)
  writeFileSync('src/components/stage/globe-frames.json', JSON.stringify(meta, null, 2) + '\n');
  writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ hash: rendersHash(), generatedAt: new Date().toISOString(), files }, null, 2));
  console.log(`✓ ${files.length} pictures written to ${OUT}`);
} finally {
  stopServer();
}
