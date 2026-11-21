// QA (lens: visual review) — sample pixel colours from screenshots and report luminance contrast.
// Usage: node qa/qa-visual-pixels.mjs <png> x,y[,label] x,y[,label] ...   (also: crop=<x,y,w,h,scale,out>)
import sharp from 'sharp';

const [file, ...pts] = process.argv.slice(2);
const img = sharp(file);
const { width, height, channels } = await img.metadata();
const raw = await img.raw().toBuffer();
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const at = (x, y) => {
  const i = (y * width + x) * channels;
  return [raw[i], raw[i + 1], raw[i + 2]];
};
// 3x3 average
const avg = (x, y) => {
  const s = [0, 0, 0];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) at(x + dx, y + dy).forEach((v, k) => (s[k] += v));
  return s.map((v) => Math.round(v / 9));
};
const samples = [];
for (const p of pts) {
  if (p.startsWith('crop=')) {
    const [x, y, w, h, scale, out] = p.slice(5).split(',');
    await sharp(file).extract({ left: +x, top: +y, width: +w, height: +h }).resize(+w * +scale, +h * +scale, { kernel: 'nearest' }).toFile(out);
    console.log('crop ->', out);
    continue;
  }
  const [x, y, label = ''] = p.split(',');
  const c = avg(+x, +y);
  samples.push({ label: label || `${x},${y}`, c });
}
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
for (const s of samples) console.log(s.label.padEnd(18), hex(s.c), s.c.join(','));
for (let i = 1; i < samples.length; i++) console.log(`${samples[0].label} vs ${samples[i].label}: ${ratio(samples[0].c, samples[i].c).toFixed(2)}:1`);
