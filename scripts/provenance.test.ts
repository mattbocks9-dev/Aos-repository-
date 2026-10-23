// The app's unit, points, weapon, ability and battletome data must come only from the
// pinned BSData catalogues. CI also regenerates public/data and fails on any diff.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import type { FactionData, FactionIndex } from '../src/data/types';

const lock = JSON.parse(readFileSync('data/bsdata.lock.json', 'utf8')) as {
  repo: string;
  commit: string;
};
const index = JSON.parse(readFileSync('public/data/index.json', 'utf8')) as FactionIndex;

describe('data provenance', () => {
  it('was generated from the pinned BSData commit', () => {
    expect(lock.repo).toBe('https://github.com/BSData/age-of-sigmar-4th');
    expect(index.source).toEqual(lock);
  });

  it('ships exactly the factions in the index, each with catalogue-costed units', () => {
    const files = readdirSync('public/data/factions').map((f) => f.replace(/\.json$/, ''));
    expect(files.sort()).toEqual(index.factions.map((f) => f.id).sort());
    for (const entry of index.factions) {
      const f = JSON.parse(
        readFileSync(`public/data/factions/${entry.id}.json`, 'utf8'),
      ) as FactionData;
      expect(f.name).toBe(entry.name);
      expect(f.units.length).toBe(entry.unitCount);
      for (const u of f.units) expect(u.points, `${f.name}: ${u.name}`).toBeGreaterThan(0);
    }
  });

  it('has no hand-maintained faction list', () => {
    expect(existsSync('scripts/factions.ts')).toBe(false);
  });
});
