// Parses army lists pasted from the GW AoS app, New Recruit or BCP into units
// matched against the BSData catalogue.
import type { AbilityData, FactionData, RuleOption, UnitData } from './types';

export interface ListUnit {
  name: string;
  points: number;
  reinforced: boolean;
  /** Catalogue entry, when the name was matched. */
  unit?: UnitData;
}

export interface ArmyList {
  factionId?: string;
  units: ListUnit[];
  /** Lines that looked like units but matched nothing in the catalogue. */
  unmatched: string[];
  manifestationLore?: string;
  spellLore?: string;
  prayerLore?: string;
  formation?: string;
  /** Battletome rules this list brings, resolved from the faction catalogue. */
  rules?: ListRules;
}

export interface ListRules {
  battleTraits: AbilityData[];
  formation?: RuleOption;
  spellLore?: RuleOption;
  prayerLore?: RuleOption;
  manifestationLore?: RuleOption;
}

/** Pick the named option, or the only option when the list doesn't name one. */
function pickOption(options: RuleOption[], name: string | undefined): RuleOption | undefined {
  if (name) {
    const n = normalise(name);
    return (
      options.find((o) => normalise(o.name) === n) ??
      options.find((o) => similarity(o.name, name) > 0.8)
    );
  }
  return options.length === 1 ? options[0] : undefined;
}

export function resolveRules(list: ArmyList, faction: FactionData): ListRules {
  const r = faction.rules;
  return {
    battleTraits: r.battleTraits,
    formation: pickOption(r.formations, list.formation),
    spellLore: pickOption(r.spellLores, list.spellLore),
    prayerLore: pickOption(r.prayerLores, list.prayerLore),
    manifestationLore: list.manifestationLore
      ? pickOption(r.manifestationLores, list.manifestationLore)
      : undefined,
  };
}

export const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  const t = normalise(s).replace(/ /g, '');
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** Dice coefficient on character bigrams (0..1). */
export function similarity(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  x.forEach((g) => y.has(g) && shared++);
  return (2 * shared) / (x.size + y.size);
}

export function matchUnit(name: string, faction: FactionData): UnitData | undefined {
  const n = normalise(name);
  const exact = faction.units.find((u) => normalise(u.name) === n);
  if (exact) return exact;
  let best: UnitData | undefined;
  let bestScore = 0.82;
  for (const u of faction.units) {
    const s = similarity(name, u.name);
    if (s > bestScore) {
      best = u;
      bestScore = s;
    }
  }
  return best;
}

export function detectFaction(text: string, factions: { id: string; name: string }[]) {
  const t = normalise(text.split('\n').slice(0, 6).join(' '));
  return [...factions]
    .sort((a, b) => b.name.length - a.name.length)
    .find((f) => t.includes(normalise(f.name)))?.id;
}

const UNIT_LINE =
  /^(?:(\d+)\s*x\s+)?(.+?)\s*[([]\s*(\d+)\s*(?:pts?|points)?\s*[)\]]\s*(?:pts?|points)?\s*$/i;
const BULLET = /^\s*[\u2022\u2013*-]\s*/;
const HEADER =
  /\b(\d{3,4})\s*\/\s*(\d{3,4})\b|^(general'?s )?regiment|^auxiliary|^faction terrain/i;

export function parseList(text: string, faction: FactionData | undefined): ArmyList {
  const list: ArmyList = { factionId: faction?.id, units: [], unmatched: [] };
  let last: ListUnit | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const lore = /^(manifestation|spell|prayer) lore\s*(?:-|:|\u2013)\s*(.+)$/i.exec(line);
    if (lore) {
      const key = `${lore[1]!.toLowerCase()}Lore` as
        | 'manifestationLore'
        | 'spellLore'
        | 'prayerLore';
      list[key] = lore[2]!.trim();
      continue;
    }
    const formation = /^battle formation\s*(?:-|:|\u2013)\s*(.+)$/i.exec(line);
    if (formation) {
      list.formation = formation[1]!.trim();
      continue;
    }
    if (faction && line.includes('|')) {
      list.formation ??= line.split('|')[1]?.trim();
      continue;
    }

    const isBullet = BULLET.test(line);
    const body = line.replace(BULLET, '');
    if (isBullet) {
      if (last && /^reinforced$/i.test(body)) last.reinforced = true;
      continue; // enhancements, weapon options, General, etc.
    }
    if (HEADER.test(body)) continue;

    const m = UNIT_LINE.exec(body);
    if (!m) continue;
    const count = Number(m[1] ?? 1);
    const name = m[2]!.trim();
    const points = Number(m[3]);
    const unit = faction ? matchUnit(name, faction) : undefined;
    if (!unit) {
      list.unmatched.push(body);
      last = undefined;
      continue;
    }
    for (let i = 0; i < count; i++) {
      last = {
        name: unit.name,
        points: count > 1 ? Math.round(points / count) : points,
        // Paying double the base cost means a reinforced unit.
        reinforced: points / count >= unit.points * 2,
        unit,
      };
      list.units.push(last);
    }
  }
  if (faction?.rules) list.rules = resolveRules(list, faction);
  return list;
}

export const listPoints = (list: ArmyList) => list.units.reduce((s, u) => s + u.points, 0);
