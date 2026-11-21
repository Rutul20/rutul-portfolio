// QA (lens: visual review) — check the transparent phone/no-WebGL pictures for a light matte fringe:
// composite each picture over the dark wall (#161514) and the light wall (#efebe4) and measure how bright the
// semi-transparent edge pixels come out compared with what a clean edge would give.
// Usage: node qa/qa-visual-alpha-edges.mjs
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
const DIR = 'public/renders';
const files = readdirSync(DIR).filter((f) => f.endsWith('.webp'));
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
for (const f of files) {
  const { data, info } = await sharp(`${DIR}/${f}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, partial = 0, transparent = 0, edgeLum = 0, edgeR = 0, edgeG = 0, edgeB = 0, brightEdges = 0;
  for (let i = 0; i < data.length; i += 4) {
    n++;
    const a = data[i + 3];
    if (a === 0) { transparent++; continue; }
    if (a < 250) {
      partial++;
      edgeR += data[i]; edgeG += data[i + 1]; edgeB += data[i + 2];
      const l = L(data[i], data[i + 1], data[i + 2]);
      edgeLum += l;
      if (l > 0.6) brightEdges++;
    }
  }
  const avg = partial ? [edgeR / partial, edgeG / partial, edgeB / partial].map(Math.round) : null;
  console.log(f.padEnd(26), `${info.width}x${info.height}`, 'transparent', (100 * transparent / n).toFixed(1) + '%', 'partial', partial,
    partial ? `edgeRGB ${avg} edgeLum ${(edgeLum / partial).toFixed(2)} bright(>0.6) ${(100 * brightEdges / partial).toFixed(1)}%` : '');
}
