// QA (lens: visual review) — scan a row/column of a screenshot and print min/max colour (for hairlines, dashes, borders).
// Usage: node qa/qa-visual-scan.mjs <png> row|col <index> <from> <to>
import sharp from 'sharp';
const [file, dir, idx, from, to] = process.argv.slice(2);
const img = sharp(file);
const { width, channels } = await img.metadata();
const raw = await img.raw().toBuffer();
const px = [];
for (let t = +from; t <= +to; t++) {
  const [x, y] = dir === 'row' ? [t, +idx] : [+idx, t];
  const i = (y * width + x) * channels;
  px.push([t, raw[i], raw[i + 1], raw[i + 2]]);
}
const s = (p) => p[1] + p[2] + p[3];
const sorted = [...px].sort((a, b) => s(a) - s(b));
console.log('min', sorted[0], 'max', sorted.at(-1));
console.log(px.map((p) => `${p[0]}:${p[1]},${p[2]},${p[3]}`).join(' '));
