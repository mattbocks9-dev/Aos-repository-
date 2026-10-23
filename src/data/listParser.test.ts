import { detectFaction, listPoints, parseList, pointsBreakdown, similarity } from './listParser';
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
      { name: 'Priced Host', points: 20, abilities: [] },
    ],
    heroicTraits: [
      { name: 'Envoy of the Heavens', points: 20, abilities: [] },
      { name: 'Staunch Defender', abilities: [] },
    ],
    artefacts: [{ name: 'Mirrorshield', abilities: [] }],
    enhancementTables: [
      { name: 'Scars of War', options: [{ name: 'Uncaged Lightning', points: 20, abilities: [] }] },
    ],
    spellLores: [
      { name: 'Lore of the Storm', abilities: [spell] },
      { name: 'Lore of Costs', points: 10, abilities: [] },
    ],
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
    // With only one spell lore in the battletome, it's assumed when not named.
    const oneLore: FactionData = {
      ...sce,
      rules: { ...sce.rules, spellLores: [sce.rules.spellLores[0]!] },
    };
    expect(parseList(GW_APP, oneLore).rules?.spellLore?.abilities).toEqual([spell]);
    expect(list.rules?.spellLore).toBeUndefined();
    // Morbid Conjuration is a universal lore, not in this battletome.
    expect(list.rules?.manifestationLore).toBeUndefined();
    const named = parseList(
      'Spell Lore - Lore of the Storm\nManifestation Lore: Manifestations of the Storm',
      sce,
    );
    expect(named.spellLore).toBe('Lore of the Storm');
    expect(named.rules?.manifestationLore?.name).toBe('Manifestations of the Storm');
  });

  it('takes points only from the catalogue, flagging typed numbers that disagree', () => {
    const l = parseList('Liberators (95)\nLiberators\n• Reinforced\nKnight-Arcanum (110)', sce);
    expect(l.units.map((u) => u.points)).toEqual([90, 180, 110]);
    expect(l.pointsMismatches).toEqual(['Liberators: list says 95, catalogue says 90']);
    expect(listPoints(l)).toBe(380);
  });

  it('adds manifestation lore points from the catalogue', () => {
    const withLore: FactionData = {
      ...sce,
      rules: {
        ...sce.rules,
        manifestationLores: [{ name: 'Morbid Conjuration', points: 20, abilities: [] }],
      },
    };
    const l = parseList('Manifestation Lore - Morbid Conjuration\nLiberators (90)', withLore);
    expect(listPoints(l)).toBe(110);
  });

  it('adds enhancement points to the unit they are on, from the catalogue', () => {
    const l = parseList(
      [
        'Lord-Celestant (120)',
        '• General',
        '• Envoy of the Heavens',
        '• Mirrorshield',
        'Knight-Arcanum (110)',
        '• Uncaged Lightning (20)',
        '• Grandhammer',
      ].join('\n'),
      sce,
    );
    expect(l.units[0]).toMatchObject({
      points: 120,
      enhancements: [
        { name: 'Envoy of the Heavens', table: 'Heroic Traits', points: 20 },
        { name: 'Mirrorshield', table: 'Artefacts of Power', points: 0 },
      ],
    });
    // The list wrote the unit's own cost and the enhancement's separately: both agree with the catalogue.
    expect(l.units[1]).toMatchObject({
      points: 130,
      enhancements: [{ name: 'Uncaged Lightning', table: 'Scars of War', points: 20 }],
    });
    expect(l.pointsMismatches).toBeUndefined();
    expect(listPoints(l)).toBe(250);
  });

  it('accepts enhancement prefixes and flags unit totals that match neither way', () => {
    const l = parseList(
      ['Lord-Celestant (150)', '• Heroic Trait: Envoy of the Heavens (20)'].join('\n'),
      sce,
    );
    expect(l.units[0]!.enhancements?.map((e) => e.name)).toEqual(['Envoy of the Heavens']);
    expect(l.pointsMismatches).toEqual([
      'Lord-Celestant: list says 150, catalogue says 120 (100 + 20 enhancements)',
    ]);
  });

  it('adds battle formation and lore points', () => {
    const l = parseList(
      ['Battle Formation - Priced Host', 'Spell Lore - Lore of Costs', 'Liberators (90)'].join(
        '\n',
      ),
      sce,
    );
    expect(l.rules?.formation?.name).toBe('Priced Host');
    expect(listPoints(l)).toBe(90 + 20 + 10);
    expect(pointsBreakdown(l)).toEqual({
      units: 90,
      enhancements: 0,
      formation: 20,
      lores: 10,
      total: 120,
    });
  });

  it('recognises a formation written on its own line with points', () => {
    const l = parseList(['Priced Host (20)', 'Liberators (90)'].join('\n'), sce);
    expect(l.formation).toBe('Priced Host');
    expect(l.unmatched).toEqual([]);
    expect(listPoints(l)).toBe(110);
  });

  it('still detects reinforced units when an enhancement is included in the line', () => {
    const l = parseList(['Liberators (200)', '• Uncaged Lightning'].join('\n'), sce);
    expect(l.units[0]).toMatchObject({ reinforced: true, points: 200 });
    expect(l.pointsMismatches).toBeUndefined();
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
