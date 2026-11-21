// Paints the toy globe's texture (public/globe/land.webp) from Natural Earth's public-domain land
// shapes (world-atlas). Coastlines only: no country borders are drawn.
// Usage: node scripts/make-globe-texture.mjs   (only needed if you change the colours)
import { mkdirSync, readFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { geoEquirectangular, geoGraticule, geoPath } from 'd3-geo';
import sharp from 'sharp';

const W = 4096;
const H = 2048;
const COLORS = { ocean: '#8fb3d8', land: '#b9d193', edge: '#8eae6c', snow: '#f4f1ec', grid: 'rgba(255,255,255,0.16)' };

const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-50m.json', 'utf8'));
const land = feature(topo, topo.objects.land);
const projection = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]).precision(0.1);
const path = geoPath(projection);
const landPath = path(land);
const gridPath = path(geoGraticule().step([30, 30])());
const y = (lat) => ((90 - lat) / 180) * H;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><clipPath id="land"><path d="${landPath}"/></clipPath></defs>
  <rect width="${W}" height="${H}" fill="${COLORS.ocean}"/>
  <path d="${gridPath}" fill="none" stroke="${COLORS.grid}" stroke-width="3"/>
  <path d="${landPath}" fill="${COLORS.land}" stroke="${COLORS.edge}" stroke-width="4" stroke-linejoin="round"/>
  <g clip-path="url(#land)">
    <rect x="0" y="0" width="${W}" height="${y(72)}" fill="${COLORS.snow}"/>
    <rect x="0" y="${y(-62)}" width="${W}" height="${H - y(-62)}" fill="${COLORS.snow}"/>
  </g>
</svg>`;

mkdirSync('public/globe', { recursive: true });
await sharp(Buffer.from(svg), { limitInputPixels: false }).webp({ quality: 82, effort: 6 }).toFile('public/globe/land.webp');
console.log('wrote public/globe/land.webp');
