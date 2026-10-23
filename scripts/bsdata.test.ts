import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildFaction,
  diceAverage,
  grandAllianceOf,
  indexEntries,
  indexGroups,
  isPlayableFaction,
  parseCatalogue,
  slugify,
  universalManifestationLores,
} from './bsdata';

const fixture = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf8');

describe('BSData extraction', () => {
  const lib = parseCatalogue(fixture('library.cat'));
  const fac = parseCatalogue(fixture('faction.cat'));
  const data = buildFaction(
    fac,
    indexEntries([fac, lib]),
    { id: 'test', grandAlliance: 'Order' },
    indexGroups([fac, lib]),
  );

  it('reads catalogue metadata and links', () => {
    expect(lib.library).toBe(true);
    expect(fac.links).toEqual([{ targetId: 'lib1', name: 'Test - Library' }]);
  });

  it('leaves out Warhammer Legends units', () => {
    expect(data.units.map((u) => u.name)).not.toContain('Old Hero');
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
    expect(hg.keywords).toEqual(['INFANTRY', 'ORDER']);
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

  it('extracts unit abilities and spells with clean effect text', () => {
    const hg = data.units.find((u) => u.name === 'Hammerguard')!;
    expect(hg.abilities).toEqual([
      {
        name: 'Shield Wall',
        kind: 'passive',
        category: 'Defensive',
        effect: 'This unit has Ward (5+) while it is contesting an objective.',
      },
    ]);
    const mage = data.units.find((u) => u.name === 'Arch Mage')!;
    expect(mage.abilities[0]).toMatchObject({
      name: 'Arcane Blast',
      kind: 'spell',
      category: 'Offensive',
      timing: 'Your Hero Phase',
      castingValue: 7,
      declare: 'Pick a visible enemy unit within 18".',
    });
  });

  it('extracts battletome rules: traits, formations, lores and enhancements', () => {
    expect(data.rules.battleTraits.map((a) => a.name)).toEqual(['Steadfast']);
    expect(data.rules.formations).toEqual([
      {
        name: 'Hammer Host',
        abilities: [
          {
            name: 'Hammerfall',
            kind: 'activated',
            timing: 'Any Charge Phase',
            effect: 'Add 1 to charge rolls.',
          },
        ],
      },
    ]);
    expect(data.rules.spellLores.map((o) => o.name)).toEqual(['Lore of Links', 'Lore of Testing']);
    expect(data.rules.spellLores[0]!.abilities.map((a) => a.name)).toEqual(['Linked Bolt']);
    expect(data.rules.spellLores[1]!.name).toBe('Lore of Testing');
    expect(data.rules.spellLores[1]!.abilities[0]).toMatchObject({
      name: 'Test Bolt',
      kind: 'spell',
      castingValue: 6,
    });
    expect(data.rules.heroicTraits.map((o) => o.name)).toEqual(['Brave']);
    expect(data.rules.artefacts).toEqual([]);
  });

  it("takes the grand alliance from the units' keywords in the catalogue", () => {
    expect(grandAllianceOf(data.units)).toBe('Order');
    expect(data.units.find((u) => u.name === 'Hammerguard')!.keywords).toContain('ORDER');
  });

  it('picks playable factions from catalogue metadata, not a hand-written list', () => {
    expect(isPlayableFaction(fac)).toBe(true);
    expect(isPlayableFaction(lib)).toBe(false); // library
    expect(isPlayableFaction({ ...fac, name: 'Legions of Nagash [LEGENDS]' })).toBe(false);
    expect(isPlayableFaction({ ...fac, name: 'Stormcast Eternals - Astral Templars' })).toBe(false); // Army of Renown
    expect(isPlayableFaction({ ...fac, name: 'Regiments of Renown' })).toBe(false);
  });

  it('extracts universal manifestation lores with their points', () => {
    const lores = parseCatalogue(fixture('lores.cat'));
    const all = [fac, lib, lores];
    expect(universalManifestationLores(lores, indexEntries(all), indexGroups(all))).toEqual([
      {
        name: 'Universal Conjuration',
        points: 20,
        abilities: [
          { name: 'Summon Wisp', kind: 'spell', castingValue: 6, effect: 'Set up a Wisp.' },
        ],
      },
    ]);
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
