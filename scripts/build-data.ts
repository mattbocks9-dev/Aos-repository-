// Regenerates public/data from the BSData catalogues pinned in data/bsdata.lock.json.
// Usage: npm run data
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FactionIndex } from '../src/data/types';
import { buildFaction, indexEntries, parseCatalogue, slugify } from './bsdata';
import { FACTIONS } from './factions';

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
execFileSync('git', ['-C', cache, 'fetch', '-q', '--depth', '1', 'origin', lock.commit]);
execFileSync('git', ['-C', cache, 'checkout', '-q', 'FETCH_HEAD']);

const files = readdirSync(cache).filter((f) => f.endsWith('.cat'));
const cats = new Map(files.map((f) => [f, parseCatalogue(readFileSync(join(cache, f), 'utf8'))]));
const byId = new Map([...cats.values()].map((c) => [c.id, c]));

const outDir = 'public/data/factions';
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const index: FactionIndex = { source: { repo: lock.repo, commit: lock.commit }, factions: [] };
for (const [name, grandAlliance] of Object.entries(FACTIONS)) {
  const faction = cats.get(`${name}.cat`);
  if (!faction) {
    console.warn(`missing catalogue for ${name}`);
    continue;
  }
  const linked = faction.links.map((l) => byId.get(l.targetId)).filter((c) => c !== undefined);
  const entries = indexEntries([faction, ...linked]);
  const id = slugify(name);
  const data = buildFaction(faction, entries, { id, grandAlliance });
  writeFileSync(join(outDir, `${id}.json`), JSON.stringify(data));
  index.factions.push({ id, name, grandAlliance, unitCount: data.units.length });
  console.log(`${name}: ${data.units.length} units`);
}
index.factions.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync('public/data/index.json', JSON.stringify(index, null, 2));
