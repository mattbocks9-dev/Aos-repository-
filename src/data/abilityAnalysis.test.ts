import { abilityFeatures, castChance } from './abilityAnalysis';
import type { AbilityData } from './types';

const ab = (effect: string, extra: Partial<AbilityData> = {}): AbilityData => ({
  name: 'X',
  kind: 'activated',
  effect,
  ...extra,
});

describe('ability analysis', () => {
  it('computes the chance to cast on 2D6', () => {
    expect(castChance(7)).toBeCloseTo(21 / 36);
    expect(castChance(2)).toBe(1);
    expect(castChance(13)).toBe(0);
  });

  it('reads flat and conditional mortal damage', () => {
    expect(
      abilityFeatures([ab('Inflict D3 mortal damage on the target.')], 1).mortalDamage,
    ).toBeCloseTo(2);
    expect(
      abilityFeatures([ab('Roll a dice. On a 3+, inflict D6 mortal damage on the target.')], 1)
        .mortalDamage,
    ).toBeCloseTo((4 / 6) * 3.5);
    expect(
      abilityFeatures(
        [
          ab(
            'Roll a dice for each model in this unit. For each 4+, inflict 1 mortal damage on the target.',
          ),
        ],
        10,
      ).mortalDamage,
    ).toBeCloseTo(5);
  });

  it('discounts spells by casting chance and once-per-battle abilities by game length', () => {
    const spell = ab('Inflict 3 mortal damage on the target.', { kind: 'spell', castingValue: 7 });
    expect(abilityFeatures([spell], 1).mortalDamage).toBeCloseTo(3 * castChance(7));
    const once = ab('Inflict 5 mortal damage on the target.', {
      timing: 'Once Per Battle, Any Combat Phase',
    });
    expect(abilityFeatures([once], 1).mortalDamage).toBeCloseTo(1);
  });

  it('ignores death-throes damage and keeps only the best spell per caster', () => {
    const death = ab(
      'When this unit is destroyed, inflict D6 mortal damage on each unit within 3".',
    );
    expect(abilityFeatures([death], 1).mortalDamage).toBe(0);
    const s1 = ab('Inflict 1 mortal damage.', { kind: 'spell', castingValue: 5 });
    const s2 = ab('Inflict D6 mortal damage.', { kind: 'spell', castingValue: 7 });
    expect(abilityFeatures([s1, s2], 1).mortalDamage).toBeCloseTo(
      Math.max(1 * castChance(5), 3.5 * castChance(7)),
    );
  });

  it('detects deep strike, healing and conditional wards', () => {
    const f = abilityFeatures(
      [
        ab('Set up this unit anywhere on the battlefield more than 9" from all enemy units.', {
          timing: 'Deployment Phase',
        }),
        ab('Heal (D3) this unit.'),
        ab('While this unit is contesting an objective, it has Ward (5+).', { kind: 'passive' }),
      ],
      1,
    );
    expect(f.deepStrike).toBe(true);
    expect(f.healing).toBeCloseTo(2);
    expect(f.conditionalWard).toBe(5);
    expect(f.notable).toEqual([]);
  });

  it('detects redeploys and edge entry as deep strike', () => {
    for (const effect of [
      'Remove this unit from the battlefield and set it up again wholly within 6" of the battlefield edge and more than 9" from all enemy units.',
      'Set up this unit on the battlefield wholly within 9" of a battlefield edge and more than 9" from all enemy units.',
      'Remove the target from the battlefield and set it up again on the battlefield more than 9" from all enemy units.',
    ]) {
      expect(abilityFeatures([ab(effect)], 1).deepStrike, effect).toBe(true);
    }
    expect(
      abilityFeatures(
        [ab('If this unit is more than 9" from all enemy units, it can move up to D6".')],
        1,
      ).deepStrike,
    ).toBe(false);
  });

  it('does not count replacement-unit or manifestation-only effects', () => {
    const f = abilityFeatures(
      [
        ab('Set up a replacement unit on the battlefield more than 9" from all enemy units.'),
        ab('This unit has Ward (4+) against mortal damage inflicted by Manifestations.', {
          kind: 'passive',
        }),
      ],
      1,
    );
    expect(f.deepStrike).toBe(false);
    expect(f.conditionalWard).toBe(0);
  });
});
