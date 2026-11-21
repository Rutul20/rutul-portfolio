// Fingerprint of everything that changes how the city looks: the 3D code, plus the few things in
// content.ts the city reads (the stop list and which building each client project gets).
// Copy edits in content.ts don't change it, so they never need new pictures.
// The render script stores it; the build checks it, so stale pictures can't ship.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function rendersHash() {
  const h = createHash('sha256');
  const content = readFileSync('src/content/content.ts', 'utf8');
  const stopIds = [...content.matchAll(/\{\s*id:\s*'([\w-]+)'/g)].map((m) => m[1]);
  const buildings = [...content.matchAll(/building:\s*'(\w+)'/g)].map((m) => m[1]);
  h.update(JSON.stringify({ stopIds, buildings }));
  const cityFiles = readdirSync('src/components/city').map((f) => join('src/components/city', f)).sort();
  for (const f of cityFiles) h.update(f).update(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
  return h.digest('hex').slice(0, 16);
}
