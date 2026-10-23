// Reads warscroll ability text (from BSData) into a few numbers the NPC can weigh.
// This is pattern matching, not a rules engine: it catches the common wordings
// for mortal damage, deep strike, healing and conditional wards.
import { diceAverage } from './dice';
import type { AbilityData } from './types';

export interface AbilityFeatures {
  /** Expected mortal damage per battle round from abilities and spells. */
  mortalDamage: number;
  deepStrike: boolean;
  /** Expected wounds healed per battle round. */
  healing: number;
  /** Best ward granted by abilities (0 if none), on top of the warscroll's keyword ward. */
  conditionalWard: number;
  /** Names of the abilities that contributed the most, for the NPC's explanations. */
  notable: string[];
}

const DICE = String.raw`(\d*D\d+(?:\+\d+)?|\d+)`;

/** Probability that 2D6 meets or beats a casting/chanting value. */
export function castChance(value: number): number {
  let hits = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b >= value) hits++;
  return hits / 36;
}

// "Set up this unit ... more than 9\" from all enemy units", "remove it ... and set it up again ...".
const DEEP_STRIKE =
  /set (?:up )?(?:this unit|it|them|the targets?|each target) (?:up )?(?:again )?[^.]*?more than 9" from all (?:other )?enemy units/i;

const p6 = (n: number) => Math.max(0, Math.min(1, (7 - n) / 6));

function mortalDamage(a: AbilityData, models: number): number {
  const text = a.effect;
  if (/when this unit is destroyed|is destroyed, before removing/i.test(text)) return 0;
  let dmg = 0;
  const perModel =
    /for each model in this unit\.? for each (\d)\+, inflict (\d+) mortal damage/i.exec(text);
  if (perModel) {
    dmg = models * p6(Number(perModel[1])) * Number(perModel[2]);
  } else {
    const flat = new RegExp(`inflict ${DICE} mortal damage`, 'i').exec(text);
    if (!flat) return 0;
    dmg = diceAverage(flat[1]);
    const gate = /on a (\d)\+,? inflict/i.exec(text);
    if (gate) dmg *= p6(Number(gate[1]));
  }
  const timing = a.timing ?? '';
  if (/once per battle/i.test(timing) || /once per battle/i.test(text)) dmg /= 5;
  if (/deployment/i.test(timing)) dmg /= 5;
  if ((a.kind === 'spell' || a.kind === 'prayer') && a.castingValue)
    dmg *= castChance(a.castingValue);
  return dmg;
}

export function abilityFeatures(abilities: AbilityData[], models: number): AbilityFeatures {
  const scored = abilities.map((a) => ({ a, dmg: mortalDamage(a, models) }));
  // A caster gets one spell (and one prayer) a turn: keep only the best of each.
  const best = (kind: AbilityData['kind']) =>
    Math.max(0, ...scored.filter((s) => s.a.kind === kind).map((s) => s.dmg));
  const other = scored
    .filter((s) => s.a.kind !== 'spell' && s.a.kind !== 'prayer')
    .reduce((sum, s) => sum + s.dmg, 0);

  let healing = 0;
  let conditionalWard = 0;
  let deepStrike = false;
  for (const a of abilities) {
    const heal = new RegExp(`Heal \\(${DICE}\\)`, 'i').exec(a.effect);
    if (heal) healing = Math.max(healing, diceAverage(heal[1]));
    const ward = /has Ward \((\d)\+\)/i.exec(a.effect);
    if (ward && !/against (mortal damage|damage inflicted by)/i.test(a.effect)) {
      const w = Number(ward[1]);
      conditionalWard = conditionalWard ? Math.min(conditionalWard, w) : w;
    }
    if (DEEP_STRIKE.test(a.effect) && !/replacement unit/i.test(a.effect)) {
      deepStrike = true;
    }
  }
  const notable = scored
    .filter((s) => s.dmg >= 1.5)
    .sort((x, y) => y.dmg - x.dmg)
    .map((s) => s.a.name);
  return {
    mortalDamage: other + best('spell') + best('prayer'),
    deepStrike,
    healing,
    conditionalWard,
    notable,
  };
}
