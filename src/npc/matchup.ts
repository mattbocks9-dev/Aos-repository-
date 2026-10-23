// Estimates how one list fares against another on a given battleplan.
// The score is an "edge" from -10 (hopeless) to +10 (near-certain win) for `me`.
import type { ListProfile } from '../data/listAnalysis';
import type { BattleplanTraits } from '../packs/traits';

export interface MatchupWeights {
  attrition: number;
  control: number;
  mobility: number;
  durabilityOnCentre: number;
  magic: number;
  /** Divisor inside tanh: bigger = scores spread less. */
  softness: number;
}

export const DEFAULT_WEIGHTS: MatchupWeights = {
  attrition: 4,
  control: 2,
  mobility: 2.5,
  durabilityOnCentre: 1.5,
  magic: 0.8,
  softness: 6,
};

export interface Factor {
  key: keyof Omit<MatchupWeights, 'softness'>;
  label: string;
  value: number;
}

export interface MatchupEstimate {
  score: number;
  factors: Factor[];
}

const safeLog = (a: number, b: number) => Math.log(Math.max(a, 0.01) / Math.max(b, 0.01));

/** Damage this list deals per turn to the given opponent, weighted by the map's shooting lanes. */
export function damageInto(me: ListProfile, them: ListProfile, t: BattleplanTraits): number {
  // Interpolate between the elite (3+) and horde (5+) figures by the target's average save.
  const k = Math.min(1, Math.max(0, (them.avgSave - 3) / 2));
  const melee = me.meleeVsElite + k * (me.meleeVsHorde - me.meleeVsElite);
  const ranged = me.rangedVsElite + k * (me.rangedVsHorde - me.rangedVsElite);
  // Mortal damage from abilities and spells ignores saves, so it isn't scaled by the target.
  return (
    melee * (1 - 0.3 * t.shootingLanes) + ranged * (0.8 + 0.4 * t.shootingLanes) + me.abilityDamage
  );
}

export function estimateMatchup(
  me: ListProfile,
  them: ListProfile,
  t: BattleplanTraits,
  w: MatchupWeights = DEFAULT_WEIGHTS,
): MatchupEstimate {
  const myRate = damageInto(me, them, t) / Math.max(them.effectiveWounds, 1);
  const theirRate = damageInto(them, me, t) / Math.max(me.effectiveWounds, 1);
  const factors: Factor[] = [
    { key: 'attrition', label: 'Damage race', value: w.attrition * safeLog(myRate, theirRate) },
    {
      key: 'control',
      label: 'Objective control',
      value: w.control * (0.5 + t.controlPressure) * safeLog(me.control, them.control),
    },
    {
      key: 'mobility',
      label: 'Speed to objectives',
      value:
        (w.mobility * ((t.mobility + t.objectiveSpread) / 2) * (me.mobility - them.mobility)) / 4,
    },
    {
      key: 'durabilityOnCentre',
      label: 'Holding the centre',
      value:
        w.durabilityOnCentre * t.centreFocus * safeLog(me.effectiveWounds, them.effectiveWounds),
    },
    { key: 'magic', label: 'Magic & prayers', value: (w.magic * (me.magic - them.magic)) / 4 },
  ];
  const raw = factors.reduce((s, f) => s + f.value, 0);
  return { score: 10 * Math.tanh(raw / w.softness), factors };
}
