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
  abilities: [],
  ...extra,
});

describe('list analysis', () => {
  it('adds ability and lore mortal damage, deep strike and conditional wards', () => {
    const mage = unit('Mage', {
      models: 1,
      health: 5,
      wizard: 2,
      keywords: ['HERO'],
      abilities: [
        {
          name: 'Blink',
          kind: 'activated',
          effect: 'Set up this unit anywhere on the battlefield more than 9" from all enemy units.',
        },
      ],
    });
    const guards = unit('Guards', {
      abilities: [
        {
          name: 'Brace',
          kind: 'passive',
          effect: 'While contesting an objective, this unit has Ward (5+).',
        },
      ],
    });
    const base: ArmyList = {
      unmatched: [],
      units: [
        { name: 'Mage', points: 150, reinforced: false, unit: mage },
        { name: 'Guards', points: 100, reinforced: false, unit: guards },
      ],
    };
    const withLore: ArmyList = {
      ...base,
      rules: {
        battleTraits: [],
        spellLore: {
          name: 'Lore',
          abilities: [
            {
              name: 'Smite',
              kind: 'spell',
              castingValue: 2,
              effect: 'Inflict 3 mortal damage on the target.',
            },
          ],
        },
      },
    };
    const plain = analyseList(base);
    const lore = analyseList(withLore);
    expect(plain.abilityDamage).toBe(0);
    expect(lore.abilityDamage).toBeCloseTo(6); // 3 per cast, guaranteed cast, WIZARD (2) casts twice
    expect(lore.notable).toEqual(['Smite']);
    expect(plain.deepStrikers).toBe(1);
    const noWard = analyseList({
      ...base,
      units: [{ ...base.units[1]!, unit: { ...guards, abilities: [] } }],
    });
    const ward = analyseList({ ...base, units: [base.units[1]!] });
    expect(ward.effectiveWounds).toBeGreaterThan(noWard.effectiveWounds);
  });

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
