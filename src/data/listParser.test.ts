import { detectFaction, listPoints, parseList, similarity } from './listParser';
import type { FactionData, UnitData } from './types';

const unit = (name: string, points: number, extra: Partial<UnitData> = {}): UnitData => ({
  name,
  points,
  move: 5,
  health: 2,
  save: 3,
  control: 1,
  models: 5,
  ward: 0,
  wizard: 0,
  priest: 0,
  keywords: [],
  weapons: [],
  abilities: [],
  ...extra,
});

const spell = {
  name: 'Bolt',
  kind: 'spell' as const,
  castingValue: 7,
  effect: 'Inflict D3 mortal damage.',
};
const sce: FactionData = {
  id: 'stormcast-eternals',
  name: 'Stormcast Eternals',
  grandAlliance: 'Order',
  rules: {
    battleTraits: [{ name: 'Scions of the Storm', kind: 'passive', effect: 'Deep strike.' }],
    formations: [
      { name: 'Thunderhead Host', abilities: [] },
      { name: 'Vanguard Wing', abilities: [] },
    ],
    heroicTraits: [],
    artefacts: [],
    spellLores: [{ name: 'Lore of the Storm', abilities: [spell] }],
    prayerLores: [{ name: 'Prayers of the Stormhosts', abilities: [] }],
    manifestationLores: [{ name: 'Manifestations of the Storm', abilities: [] }],
  },
  units: [
    unit('Liberators', 90),
    unit('Lord-Celestant', 100, { models: 1 }),
    unit('Knight-Arcanum', 110, { models: 1, wizard: 1 }),
    unit('Yndrasta, the Celestial Spear', 270, { models: 1 }),
  ],
};

const GW_APP = `My Hammers 1990/2000 pts
Stormcast Eternals | Thunderhead Host
Battle Formation - Thunderhead Host
Manifestation Lore - Morbid Conjuration

General's Regiment
Lord-Celestant (100)
• General
• Mirrorshield
Liberators (180)
• Reinforced
Regiment 1
Knight Arcanum (110)
2x Liberators (180)
Yndrasta the Celestial Spear (270 pts)
Faction Terrain
Bogus Unit Name (999)`;

describe('list parser', () => {
  const list = parseList(GW_APP, sce);

  it('matches units, including fuzzy names and multiples', () => {
    expect(list.units.map((u) => u.name)).toEqual([
      'Lord-Celestant',
      'Liberators',
      'Knight-Arcanum',
      'Liberators',
      'Liberators',
      'Yndrasta, the Celestial Spear',
    ]);
  });

  it('detects reinforced units by bullet or by points', () => {
    expect(list.units[1]!.reinforced).toBe(true);
    expect(list.units[3]!.reinforced).toBe(false);
    expect(list.units[3]!.points).toBe(90);
  });

  it('reports unmatched lines and list metadata', () => {
    expect(list.unmatched).toEqual(['Bogus Unit Name (999)']);
    expect(list.manifestationLore).toBe('Morbid Conjuration');
    expect(list.formation).toBe('Thunderhead Host');
    expect(listPoints(list)).toBe(100 + 180 + 110 + 180 + 270);
  });

  it('resolves battletome rules for the list', () => {
    expect(list.rules?.battleTraits.map((a) => a.name)).toEqual(['Scions of the Storm']);
    expect(list.rules?.formation?.name).toBe('Thunderhead Host');
    // Only one spell lore in the battletome, so it's assumed when not named.
    expect(list.rules?.spellLore?.abilities).toEqual([spell]);
    // Morbid Conjuration is a universal lore, not in this battletome.
    expect(list.rules?.manifestationLore).toBeUndefined();
    const named = parseList(
      'Spell Lore - Lore of the Storm\nManifestation Lore: Manifestations of the Storm',
      sce,
    );
    expect(named.spellLore).toBe('Lore of the Storm');
    expect(named.rules?.manifestationLore?.name).toBe('Manifestations of the Storm');
  });

  it('detects the faction from the header', () => {
    expect(
      detectFaction(GW_APP, [
        { id: 'stormcast-eternals', name: 'Stormcast Eternals' },
        { id: 'seraphon', name: 'Seraphon' },
      ]),
    ).toBe('stormcast-eternals');
  });

  it('scores similar names highly', () => {
    expect(similarity('Knight Arcanum', 'Knight-Arcanum')).toBe(1);
    expect(similarity('Liberators', 'Vindictors')).toBeLessThan(0.5);
  });
});
