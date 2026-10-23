// Summarises an army list into the features the NPC captain reasons with.
// Damage figures are expected damage per full activation (all models swinging
// their best weapon), which is a deliberately simple but consistent yardstick.
import { abilityFeatures } from './abilityAnalysis';
import { diceAverage } from './dice';
import type { ArmyList } from './listParser';
import type { UnitData, WeaponData } from './types';

export interface ListProfile {
  points: number;
  units: number;
  models: number;
  heroes: number;
  monsters: number;
  /** Expected damage per turn against a 3+ save (elite) and a 5+ save (horde). */
  meleeVsElite: number;
  meleeVsHorde: number;
  rangedVsElite: number;
  rangedVsHorde: number;
  /** Wounds adjusted for save and ward, against rend 1. */
  effectiveWounds: number;
  /** Total control score on the table. */
  control: number;
  /** Points-weighted average move, with a bonus for FLY. */
  mobility: number;
  magic: number;
  /** Points-weighted average save (lower is better) and health per model. */
  avgSave: number;
  avgHealth: number;
  /** Mortal damage per battle round from abilities, spells and prayers (ignores saves). */
  abilityDamage: number;
  /** Units that can deep strike or redeploy. */
  deepStrikers: number;
  archetype: string;
  /** The list's standout damage abilities, for explanations. */
  notable: string[];
}

const p6 = (target: number) => Math.min(5 / 6, Math.max(1 / 6, (7 - target) / 6));

export function expectedDamage(w: WeaponData, targetSave: number, targetWard = 0): number {
  const hit = p6(w.hit || 4);
  const wound = p6(w.wound || 4);
  const save = Math.max(0, Math.min(5 / 6, (7 - (targetSave + Math.max(0, w.rend))) / 6));
  const ward = targetWard ? (7 - targetWard) / 6 : 0;
  return diceAverage(w.attacks) * hit * wound * (1 - save) * (1 - ward) * diceAverage(w.damage);
}

function best(u: UnitData, kind: 'melee' | 'ranged', save: number) {
  const ws = u.weapons.filter((w) => w.kind === kind && (kind === 'melee' || w.range >= 10));
  return ws.reduce((m, w) => Math.max(m, expectedDamage(w, save)), 0);
}

export function effectiveWounds(u: UnitData, models: number): number {
  const save = Math.max(0, Math.min(5 / 6, (7 - (u.save + 1)) / 6));
  const ward = u.ward ? (7 - u.ward) / 6 : 0;
  return (models * u.health) / ((1 - save) * (1 - ward));
}

function archetypeOf(p: Omit<ListProfile, 'archetype' | 'notable'>): string {
  const ranged = p.rangedVsElite / Math.max(1, p.meleeVsElite + p.rangedVsElite);
  const parts: string[] = [];
  if (p.models >= 70) parts.push('Horde');
  else if (p.avgHealth >= 4) parts.push('Elite');
  if (p.monsters >= 3) parts.push('Monster mash');
  if (ranged >= 0.45) parts.push('Gunline');
  else if (ranged >= 0.25) parts.push('Mixed arms');
  else parts.push('Melee');
  if (p.magic >= 4) parts.push('Caster');
  if (p.mobility >= 9 || p.deepStrikers >= 3) parts.push('Fast');
  if (p.abilityDamage >= 8) parts.push('Mortal wounds');
  return parts.join(' · ');
}

export function analyseList(list: ArmyList): ListProfile {
  const acc = {
    points: 0,
    units: 0,
    models: 0,
    heroes: 0,
    monsters: 0,
    meleeVsElite: 0,
    meleeVsHorde: 0,
    rangedVsElite: 0,
    rangedVsHorde: 0,
    effectiveWounds: 0,
    control: 0,
    mobility: 0,
    magic: 0,
    avgSave: 0,
    avgHealth: 0,
    abilityDamage: 0,
    deepStrikers: 0,
  };
  const notable: { name: string; dmg: number }[] = [];
  const spells = list.rules?.spellLore?.abilities ?? [];
  const prayers = list.rules?.prayerLore?.abilities ?? [];
  let weighted = 0;
  for (const lu of list.units) {
    const u = lu.unit;
    acc.points += lu.points;
    if (!u) continue;
    const models = u.models * (lu.reinforced ? 2 : 1);
    const w = Math.max(lu.points, 1);
    acc.units += 1;
    acc.models += models;
    if (u.keywords.includes('HERO')) acc.heroes += 1;
    if (u.keywords.includes('MONSTER')) acc.monsters += 1;
    acc.meleeVsElite += models * best(u, 'melee', 3);
    acc.meleeVsHorde += models * best(u, 'melee', 5);
    acc.rangedVsElite += models * best(u, 'ranged', 3);
    acc.rangedVsHorde += models * best(u, 'ranged', 5);
    // Casters also know the army's spell/prayer lore; one spell and one prayer a turn each.
    const abilities = [
      ...(u.abilities ?? []),
      ...(u.wizard ? spells : []),
      ...(u.priest ? prayers : []),
    ];
    const f = abilityFeatures(abilities, models);
    const casts = Math.max(1, Math.min(2, u.wizard));
    acc.abilityDamage += f.mortalDamage * (u.wizard ? casts : 1);
    if (f.deepStrike) acc.deepStrikers += 1;
    if (f.mortalDamage >= 1.5)
      notable.push(...f.notable.map((name) => ({ name, dmg: f.mortalDamage })));
    // Conditional wards count for half; healing is worth a few wounds over a game.
    const wardBoost =
      f.conditionalWard && !u.ward ? 1 / (1 - 0.5 * ((7 - f.conditionalWard) / 6)) : 1;
    acc.effectiveWounds += effectiveWounds(u, models) * wardBoost + 3 * f.healing;
    acc.control += models * u.control;
    acc.mobility += w * (u.move + (u.keywords.includes('FLY') ? 2 : 0));
    acc.magic += u.wizard + u.priest * 0.75;
    acc.avgSave += w * u.save;
    acc.avgHealth += w * u.health;
    weighted += w;
  }
  if (weighted) {
    acc.mobility /= weighted;
    // Deep strike is worth a few inches of threat range across the army.
    acc.mobility += Math.min(3, (acc.deepStrikers / Math.max(acc.units, 1)) * 6);
    acc.avgSave /= weighted;
    acc.avgHealth /= weighted;
  } else {
    acc.avgSave = 7;
  }
  const names = [...new Set(notable.sort((a, b) => b.dmg - a.dmg).map((n) => n.name))];
  return { ...acc, archetype: archetypeOf(acc), notable: names.slice(0, 3) };
}
