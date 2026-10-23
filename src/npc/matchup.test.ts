import type { ListProfile } from '../data/listAnalysis';
import type { BattleplanTraits } from '../packs/traits';
import { estimateMatchup } from './matchup';

const profile = (p: Partial<ListProfile>): ListProfile => ({
  points: 2000,
  units: 10,
  models: 40,
  heroes: 3,
  monsters: 0,
  meleeVsElite: 20,
  meleeVsHorde: 30,
  rangedVsElite: 5,
  rangedVsHorde: 8,
  effectiveWounds: 200,
  control: 40,
  mobility: 6,
  magic: 2,
  avgSave: 4,
  avgHealth: 2,
  archetype: 'Melee',
  abilityDamage: 0,
  deepStrikers: 0,
  notable: [],
  ...p,
});
const traits: BattleplanTraits = {
  mobility: 0.5,
  objectiveSpread: 0.5,
  controlPressure: 0.6,
  shootingLanes: 0.5,
  centreFocus: 0.3,
  attackerEdge: 0,
};

describe('matchup model', () => {
  it('scores a mirror at zero and is antisymmetric', () => {
    const a = profile({});
    const b = profile({ rangedVsElite: 25, rangedVsHorde: 30, mobility: 9, control: 20 });
    expect(estimateMatchup(a, a, traits).score).toBeCloseTo(0);
    expect(estimateMatchup(a, b, traits).score).toBeCloseTo(-estimateMatchup(b, a, traits).score);
  });

  it('stays within -10..10', () => {
    const s = estimateMatchup(
      profile({ meleeVsElite: 500, meleeVsHorde: 500 }),
      profile({ effectiveWounds: 20 }),
      traits,
    ).score;
    expect(s).toBeLessThanOrEqual(10);
    expect(s).toBeGreaterThan(8);
  });

  it('values a gunline more on maps with long shooting lanes', () => {
    const gun = profile({ meleeVsElite: 5, meleeVsHorde: 8, rangedVsElite: 20, rangedVsHorde: 30 });
    const melee = profile({});
    const open = estimateMatchup(gun, melee, { ...traits, shootingLanes: 1 }).score;
    const tight = estimateMatchup(gun, melee, { ...traits, shootingLanes: 0 }).score;
    expect(open).toBeGreaterThan(tight);
  });

  it('values unit count and heroes for battle tactics', () => {
    const wide = profile({ units: 16, heroes: 5, effectiveWounds: 200 });
    const narrow = profile({ units: 7, heroes: 2, effectiveWounds: 200 });
    const est = estimateMatchup(wide, narrow, traits);
    const tactics = est.factors.find((f) => f.key === 'tactics')!;
    expect(tactics.label).toBe('Battle tactics');
    expect(tactics.value).toBeGreaterThan(0);
  });

  it('values speed more on spread-out maps', () => {
    const fast = profile({ mobility: 10 });
    const slow = profile({ mobility: 4 });
    const spread = estimateMatchup(fast, slow, {
      ...traits,
      objectiveSpread: 1,
      mobility: 1,
    }).score;
    const tight = estimateMatchup(fast, slow, { ...traits, objectiveSpread: 0, mobility: 0 }).score;
    expect(spread).toBeGreaterThan(tight);
  });
});
