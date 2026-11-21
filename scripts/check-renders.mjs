// Runs before `npm run build`: refuses to build if the city pictures are missing or out of date.
import { existsSync, readFileSync } from 'node:fs';
import { rendersHash } from './renders-hash.mjs';

const manifest = 'public/renders/manifest.json';
const fail = (why) => {
  console.error(`\n✖ City pictures are ${why}.\n  Run \`npm run renders\` (needs a GPU-capable machine), then build again.\n`);
  process.exit(1);
};

if (!existsSync(manifest)) fail('missing');
const saved = JSON.parse(readFileSync(manifest, 'utf8'));
const now = rendersHash();
if (saved.hash !== now) fail(`out of date (made for ${saved.hash}, code is now ${now})`);
const missing = saved.files.filter((f) => !existsSync(`public${f}`));
if (missing.length) fail(`incomplete (${missing.length} files missing)`);
console.log(`✓ City pictures match the current content and 3D code (${now}).`);
