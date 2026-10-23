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
  ...extra,
});

const sce: FactionData = {
  id: 'stormcast-eternals',
  name: 'Stormcast Eternals',
  grandAlliance: 'Order',
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
