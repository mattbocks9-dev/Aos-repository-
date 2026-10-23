import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildFaction, diceAverage, indexEntries, parseCatalogue, slugify } from './bsdata';

const fixture = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf8');

describe('BSData extraction', () => {
  const lib = parseCatalogue(fixture('library.cat'));
  const fac = parseCatalogue(fixture('faction.cat'));
  const data = buildFaction(fac, indexEntries([fac, lib]), { id: 'test', grandAlliance: 'Order' });

  it('reads catalogue metadata and links', () => {
    expect(lib.library).toBe(true);
    expect(fac.links).toEqual([{ targetId: 'lib1', name: 'Test - Library' }]);
  });

  it('builds a deduplicated, points-costed roster', () => {
    expect(data.units.map((u) => u.name)).toEqual(['Arch Mage', 'Hammerguard']);
  });

  it('extracts unit profile, keywords, models and weapons', () => {
    const hg = data.units.find((u) => u.name === 'Hammerguard')!;
    expect(hg).toMatchObject({
      points: 150,
      move: 5,
      health: 2,
      save: 3,
      control: 1,
      models: 5,
      ward: 6,
    });
    expect(hg.keywords).toEqual(['INFANTRY']);
    expect(hg.weapons[0]).toMatchObject({
      kind: 'melee',
      attacks: '2',
      rend: 1,
      damage: 'D3',
      ability: 'Anti-Monster (+1 Rend)',
    });
    const mage = data.units.find((u) => u.name === 'Arch Mage')!;
    expect(mage).toMatchObject({ wizard: 2, models: 1 });
    expect(mage.weapons[0]).toMatchObject({ kind: 'ranged', range: 18, ability: undefined });
  });

  it('averages dice expressions', () => {
    expect(diceAverage('D6')).toBe(3.5);
    expect(diceAverage('2D3+1')).toBe(5);
    expect(diceAverage('4')).toBe(4);
  });

  it('slugifies names', () => {
    expect(slugify('Lumineth Realm-lords')).toBe('lumineth-realm-lords');
  });
});
