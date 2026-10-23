// Regenerates public/data from the BSData catalogues pinned in data/bsdata.lock.json.
// Usage: npm run data            (pinned commit)
//        npm run data -- --latest  (move the pin to BSData's current main, then build)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FactionIndex } from '../src/data/types';
import {
  buildFaction,
  indexEntries,
  indexGroups,
  isPlayableFaction,
  matchedPlayForceId,
  parseCatalogue,
  slugify,
  universalManifestationLores,
} from './bsdata';

const lock = JSON.parse(readFileSync('data/bsdata.lock.json', 'utf8')) as {
  repo: string;
  commit: string;
};
const cache = '.data-cache/bsdata';

if (!existsSync(join(cache, '.git'))) {
  mkdirSync(cache, { recursive: true });
  execFileSync('git', ['init', '-q', cache]);
  execFileSync('git', ['-C', cache, 'remote', 'add', 'origin', lock.repo]);
}
if (process.argv.includes('--latest')) {
  execFileSync('git', ['-C', cache, 'fetch', '-q', '--depth', '1', 'origin', 'main']);
  lock.commit = execFileSync('git', ['-C', cache, 'rev-parse', 'FETCH_HEAD']).toString().trim();
  writeFileSync('data/bsdata.lock.json', JSON.stringify(lock, null, 2) + '\n');
  console.log(`pinned BSData ${lock.commit}`);
}
execFileSync('git', ['-C', cache, 'fetch', '-q', '--depth', '1', 'origin', lock.commit]);
execFileSync('git', ['-C', cache, 'checkout', '-q', 'FETCH_HEAD']);

const files = readdirSync(cache).filter((f) => f.endsWith('.cat'));
const cats = new Map(files.map((f) => [f, parseCatalogue(readFileSync(join(cache, f), 'utf8'))]));
const byId = new Map([...cats.values()].map((c) => [c.id, c]));

const outDir = 'public/data/factions';
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const index: FactionIndex = { source: { repo: lock.repo, commit: lock.commit }, factions: [] };
// Everything below comes from the pinned BSData catalogues: no hand-maintained faction data.
const all = [...cats.values()];
const gst = readdirSync(cache).find((f) => f.endsWith('.gst'));
const force = gst ? matchedPlayForceId(readFileSync(join(cache, gst), 'utf8')) : undefined;
console.log(`matched-play force: ${force}`);
const loresCat = all.find((c) => c.name.includes('Lores') && c.library);
const universal = loresCat
  ? universalManifestationLores(loresCat, indexEntries(all), indexGroups(all))
  : [];
console.log(`universal manifestation lores: ${universal.map((l) => l.name).join(', ')}`);

for (const faction of all.filter(isPlayableFaction)) {
  const linked = faction.links.map((l) => byId.get(l.targetId)).filter((c) => c !== undefined);
  const entries = indexEntries([faction, ...linked]);
  const groups = indexGroups([faction, ...linked]);
  const id = slugify(faction.name);
  const data = buildFaction(faction, entries, { id }, groups, force);
  for (const lore of universal) {
    if (!data.rules.manifestationLores.some((l) => l.name === lore.name)) {
      data.rules.manifestationLores.push(lore);
    }
  }
  writeFileSync(join(outDir, `${id}.json`), JSON.stringify(data));
  index.factions.push({
    id,
    name: faction.name,
    grandAlliance: data.grandAlliance,
    unitCount: data.units.length,
  });
  console.log(`${faction.name} (${data.grandAlliance}): ${data.units.length} units`);
}
index.factions.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync('public/data/index.json', JSON.stringify(index, null, 2));
