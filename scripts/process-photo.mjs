// Crops the original portrait to 4:5 (head to waist) and writes small WebP files to public/photo.
// Usage: npm run photo   (re-run only if source-assets/photo-original.jpg changes)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'source-assets/photo-original.jpg';
const OUT = 'public/photo';
mkdirSync(OUT, { recursive: true });

// Region chosen for the 1500×2000 original: face centred, shirt to the waist.
const region = { left: 230, top: 250, width: 1000, height: 1250 };

for (const w of [320, 640]) {
  const file = `${OUT}/rutul-${w}.webp`;
  await sharp(SRC).extract(region).resize(w).webp({ quality: 78 }).toFile(file);
  console.log('wrote', file);
}
