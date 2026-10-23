// Parses army lists pasted from the GW AoS app, New Recruit or BCP into units
// matched against the BSData catalogue.
import type { AbilityData, FactionData, RuleOption, UnitData } from './types';

export interface ListUnit {
  name: string;
  /** Always the catalogue cost (doubled when reinforced), never the pasted number. */
  points: number;
  /** The number typed in the pasted list, if any; only used to flag disagreements. */
  listedPoints?: number;
  reinforced: boolean;
  /** Catalogue entry, when the name was matched. */
  unit?: UnitData;
  /** Enhancements on this unit (heroic traits, artefacts, monstrous traits...), costed from the catalogue. */
  enhancements?: ListEnhancement[];
}

export interface ListEnhancement {
  name: string;
  /** The battletome table it comes from, e.g. "Heroic Traits". */
  table: string;
  points: number;
}

export interface ArmyList {
  factionId?: string;
  units: ListUnit[];
  /** Lines that looked like units but matched nothing in the catalogue. */
  unmatched: string[];
  /** Units whose pasted points disagree with the catalogue. */
  pointsMismatches?: string[];
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

/** Every enhancement a unit can take in this faction, with the table it belongs to. */
function enhancementOptions(faction: FactionData): { option: RuleOption; table: string }[] {
  const r = faction.rules;
  return [
    ...r.heroicTraits.map((option) => ({ option, table: 'Heroic Traits' })),
    ...r.artefacts.map((option) => ({ option, table: 'Artefacts of Power' })),
    ...(r.enhancementTables ?? []).flatMap((t) =>
      t.options.map((option) => ({ option, table: t.name })),
    ),
  ];
}

// "Heroic Trait: X", "Artefact - X", "Enhancement: X (20)" ...
const ENHANCEMENT_PREFIX =
  /^(?:heroic traits?|artefacts?(?: of power)?|enhancements?|monstrous traits?)\s*(?:-|:|\u2013)\s*/i;
const TRAILING_POINTS = /\s*[([]\s*\d+\s*(?:pts?|points)?\s*[)\]]\s*$/i;

function matchOption<T extends { option: RuleOption }>(name: string, options: T[]): T | undefined {
  const n = normalise(name);
  return (
    options.find((o) => normalise(o.option.name) === n) ??
    options.find((o) => similarity(o.option.name, name) > 0.85)
  );
}

export function parseList(text: string, faction: FactionData | undefined): ArmyList {
  const list: ArmyList = { factionId: faction?.id, units: [], unmatched: [] };
  const enhancements = faction?.rules ? enhancementOptions(faction) : [];
  const formations = (faction?.rules?.formations ?? []).map((option) => ({ option }));
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
      const enhancement =
        last &&
        matchOption(
          body.replace(ENHANCEMENT_PREFIX, '').replace(TRAILING_POINTS, ''),
          enhancements,
        );
      if (last && enhancement) {
        (last.enhancements ??= []).push({
          name: enhancement.option.name,
          table: enhancement.table,
          points: enhancement.option.points ?? 0,
        });
      }
      continue; // weapon options, General, etc.
    }
    if (HEADER.test(body)) continue;
    // A battle formation on its own line, e.g. "Coven of Blood (20)".
    const formationLine = matchOption(body.replace(TRAILING_POINTS, ''), formations);
    if (
      formationLine &&
      normalise(formationLine.option.name) === normalise(body.replace(TRAILING_POINTS, ''))
    ) {
      list.formation = formationLine.option.name;
      continue;
    }

    const m = UNIT_LINE.exec(body);
    // A bare unit name (no points) also counts, if it matches the catalogue exactly.
    const bare = !m && faction?.units.find((u) => normalise(u.name) === normalise(body));
    if (!m && !bare) continue;
    const count = m ? Number(m[1] ?? 1) : 1;
    const name = m ? m[2]!.trim() : body;
    const listed = m ? Number(m[3]) / count : undefined;
    const unit = bare || (faction ? matchUnit(name, faction) : undefined);
    if (!unit) {
      list.unmatched.push(body);
      last = undefined;
      continue;
    }
    for (let i = 0; i < count; i++) {
      last = {
        name: unit.name,
        points: unit.points,
        listedPoints: listed,
        // Paying double the base cost means a reinforced unit (re-checked once enhancements are known).
        reinforced: false,
        unit,
      };
      list.units.push(last);
    }
  }
  // Points always come from the catalogue: the unit (doubled when reinforced) plus its enhancements.
  // A pasted number is only checked, and may be written with or without the enhancements included.
  const mismatches: string[] = [];
  for (const u of list.units) {
    if (!u.unit) continue;
    const extra = (u.enhancements ?? []).reduce((s, e) => s + e.points, 0);
    if (
      !u.reinforced &&
      u.listedPoints !== undefined &&
      u.listedPoints - extra >= u.unit.points * 2
    ) {
      u.reinforced = true;
    }
    const base = u.unit.points * (u.reinforced ? 2 : 1);
    u.points = base + extra;
    if (u.listedPoints !== undefined && u.listedPoints !== u.points && u.listedPoints !== base) {
      const detail = extra ? ` (${base} + ${extra} enhancements)` : '';
      mismatches.push(
        `${u.name}: list says ${u.listedPoints}, catalogue says ${u.points}${detail}`,
      );
    }
  }
  if (mismatches.length) list.pointsMismatches = mismatches;
  if (faction?.rules) list.rules = resolveRules(list, faction);
  return list;
}

export interface PointsBreakdown {
  units: number;
  enhancements: number;
  formation: number;
  lores: number;
  total: number;
}

/** Army points from the catalogue: units, their enhancements, battle formation and lores. */
export function pointsBreakdown(list: ArmyList): PointsBreakdown {
  const enhancements = list.units.reduce(
    (s, u) => s + (u.enhancements ?? []).reduce((t, e) => t + e.points, 0),
    0,
  );
  const units = list.units.reduce((s, u) => s + u.points, 0) - enhancements;
  const r = list.rules;
  const formation = r?.formation?.points ?? 0;
  const lores =
    (r?.spellLore?.points ?? 0) +
    (r?.prayerLore?.points ?? 0) +
    (r?.manifestationLore?.points ?? 0);
  return { units, enhancements, formation, lores, total: units + enhancements + formation + lores };
}

export const listPoints = (list: ArmyList) => pointsBreakdown(list).total;
