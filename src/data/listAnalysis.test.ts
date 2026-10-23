import { analyseList, effectiveWounds, expectedDamage } from './listAnalysis';
import type { ArmyList } from './listParser';
import type { UnitData, WeaponData } from './types';

const sword: WeaponData = {
  name: 'Sword',
  kind: 'melee',
  range: 0,
  attacks: '2',
  hit: 3,
  wound: 3,
  rend: 1,
  damage: '1',
};
const gun: WeaponData = {
  name: 'Gun',
  kind: 'ranged',
  range: 18,
  attacks: '2',
  hit: 4,
  wound: 3,
  rend: 1,
  damage: '2',
};

const unit = (name: string, extra: Partial<UnitData>): UnitData => ({
  name,
  points: 100,
  move: 5,
  health: 2,
  save: 4,
  control: 1,
  models: 5,
  ward: 0,
  wizard: 0,
  priest: 0,
  keywords: ['INFANTRY'],
  weapons: [sword],
  ...extra,
});

describe('list analysis', () => {
  it('computes expected damage with rend and ward', () => {
    // 2 attacks × 4/6 × 4/6 × (1 - 2/6 save at 3+ with rend 1 → 4+) × 1
    expect(expectedDamage(sword, 3)).toBeCloseTo(2 * (4 / 6) * (4 / 6) * (3 / 6));
    expect(expectedDamage(sword, 3, 5)).toBeCloseTo(expectedDamage(sword, 3) * (4 / 6));
  });

  it('computes effective wounds against rend 1', () => {
    expect(effectiveWounds(unit('x', { save: 3 }), 5)).toBeCloseTo(10 / (1 - 3 / 6));
  });

  it('summarises a list and labels its archetype', () => {
    const list: ArmyList = {
      unmatched: [],
      units: [
        {
          name: 'Gunners',
          points: 200,
          reinforced: true,
          unit: unit('Gunners', { weapons: [gun, sword] }),
        },
        {
          name: 'Hero',
          points: 100,
          reinforced: false,
          unit: unit('Hero', { models: 1, health: 6, keywords: ['HERO'], wizard: 2 }),
        },
      ],
    };
    const p = analyseList(list);
    expect(p).toMatchObject({
      points: 300,
      units: 2,
      models: 11,
      heroes: 1,
      magic: 2,
      control: 11,
    });
    expect(p.rangedVsElite).toBeCloseTo(10 * expectedDamage(gun, 3));
    expect(p.archetype).toContain('Gunline');
  });
});
