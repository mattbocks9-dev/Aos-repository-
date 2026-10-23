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
  /** Battle tactic cards named in the list (e.g. "Battle Tactic Cards: Siege of Ashes, ..."). */
  battleTactics?: string[];
  factionTerrain?: string;
  /** The total the export itself states ("1990/2000 pts", "[2000pts]"), checked against the catalogue. */
  declaredPoints?: number;
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

/** Splits trailing points off a line: "X (20 Points)", "X [20pts]", "X - 20 pts", "X: 20pts", "X 20pts", "X20". */
export function splitPoints(text: string): { text: string; points?: number } {
  const patterns = [
    /^(.*?)\s*[([]\s*(\d+)\s*(?:pts?|points)?\s*[)\]]\s*(?:pts?|points)?$/i,
    /^(.*?)\s*(?:-|:|\u2013|\u2014)\s*(\d+)\s*(?:pts?|points)$/i,
    /^(.*?)\s+(\d+)\s*(?:pts?|points)$/i,
    // Some app exports glue the points onto the name: "Alarielle the Everqueen620".
    /^(.{3,}?[A-Za-z)'\u2019\]])(\d{2,4})$/,
  ];
  for (const re of patterns) {
    const m = re.exec(text.trim());
    if (m && m[1]) return { text: m[1].trim(), points: Number(m[2]) };
  }
  return { text: text.trim() };
}

interface UnitLine {
  count: number;
  name: string;
  points?: number;
  /** Items written after the points, e.g. "Unit [130pts]: General, Some Artefact". */
  inline: string[];
}

function parseUnitLine(body: string): UnitLine {
  let rest = body;
  let inline: string[] = [];
  const withItems = /^(.*?[)\]])\s*:\s*(.+)$/.exec(rest);
  if (withItems) {
    rest = withItems[1]!;
    inline = withItems[2]!
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  const { text, points } = splitPoints(rest);
  let name = text;
  let count = 1;
  const before = /^(\d+)\s*x\s+(.+)$/i.exec(name);
  const after = /^(.+?)\s+x\s*(\d+)$/i.exec(name);
  if (before) [count, name] = [Number(before[1]), before[2]!];
  else if (after) [name, count] = [after[1]!, Number(after[2])];
  return { count, name: name.trim(), points, inline };
}

const BULLET = /^\s*[\u2022\u2013*-]\s*/;
const HEADER =
  /\b(\d{3,4})\s*\/\s*(\d{3,4})\b|^(general'?s )?regiment|^auxiliary|^faction terrain|^\+.*\+$/i;
const DECLARED = /\b(\d{3,4})\s*\/\s*\d{3,4}\s*(?:pts?|points)?\b|^\+\+.*\[(\d{3,4})\s*pts?\]/i;

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
  let inFactionTerrain = false;

  /** A bullet or inline item under a unit: Reinforced, an enhancement, or something we ignore. */
  const applyItem = (unit: ListUnit, item: string): boolean => {
    if (/^reinforced$/i.test(item)) {
      unit.reinforced = true;
      return true;
    }
    const enhancement = matchOption(
      splitPoints(item.replace(ENHANCEMENT_PREFIX, '')).text,
      enhancements,
    );
    if (!enhancement) return /^general$/i.test(item);
    (unit.enhancements ??= []).push({
      name: enhancement.option.name,
      table: enhancement.table,
      points: enhancement.option.points ?? 0,
    });
    return true;
  };
  /** Inline items are comma-separated, but some enhancement names contain commas: try longest joins first. */
  const applyInline = (unit: ListUnit, items: string[]) => {
    for (let i = 0; i < items.length; ) {
      let used = 1;
      for (let k = items.length; k > i; k--) {
        if (applyItem(unit, items.slice(i, k).join(', '))) {
          used = k - i;
          break;
        }
      }
      i += used;
    }
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const declared = DECLARED.exec(line);
    if (declared && list.declaredPoints === undefined) {
      list.declaredPoints = Number(declared[1] ?? declared[2]);
    }

    const lore = /^(manifestation|spell|prayer) lore\s*(?:-|:|\u2013)\s*(.+)$/i.exec(line);
    if (lore) {
      const key = `${lore[1]!.toLowerCase()}Lore` as
        | 'manifestationLore'
        | 'spellLore'
        | 'prayerLore';
      list[key] = splitPoints(lore[2]!).text;
      continue;
    }
    const formation = /^battle formation\s*(?:-|:|\u2013)\s*(.+)$/i.exec(line);
    if (formation) {
      list.formation = splitPoints(formation[1]!).text;
      continue;
    }
    const tactics = /^battle tactics?(?: cards?)?\s*(?:-|:|\u2013)\s*(.+)$/i.exec(line);
    if (tactics) {
      list.battleTactics = tactics[1]!
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      continue;
    }
    // Older app exports: "Faction Name | Battle Formation".
    const pipe = line.split('|').map((x) => x.trim());
    if (faction && pipe.length === 2 && normalise(pipe[0]!) === normalise(faction.name)) {
      list.formation ??= splitPoints(pipe[1]!).text;
      continue;
    }

    const isBullet = BULLET.test(line);
    const body = line.replace(BULLET, '');
    if (isBullet) {
      if (last) applyItem(last, body);
      continue; // weapon options and other notes
    }
    if (/^faction terrain$/i.test(body)) {
      inFactionTerrain = true;
      continue;
    }
    if (HEADER.test(body)) continue;
    if (inFactionTerrain) {
      inFactionTerrain = false;
      // Faction terrain is free and listed without points; anything with points is a unit line.
      if (splitPoints(body).points === undefined) {
        list.factionTerrain = body;
        continue;
      }
    }
    // A battle formation on its own line, e.g. "Maw-Cult Fanatics (10 Points)".
    const plain = splitPoints(body).text;
    const formationLine = formations.find((f) => normalise(f.option.name) === normalise(plain));
    if (formationLine) {
      list.formation = formationLine.option.name;
      continue;
    }

    const parsed = parseUnitLine(body);
    // A line without points only counts when it names a catalogue unit exactly.
    const exact = faction?.units.find((u) => normalise(u.name) === normalise(parsed.name));
    if (parsed.points === undefined && !exact) continue;
    const unit = exact ?? (faction ? matchUnit(parsed.name, faction) : undefined);
    if (!unit) {
      list.unmatched.push(body);
      last = undefined;
      continue;
    }
    for (let i = 0; i < parsed.count; i++) {
      last = {
        name: unit.name,
        points: unit.points,
        listedPoints:
          parsed.points === undefined ? undefined : Math.round(parsed.points / parsed.count),
        // Reinforced is detected from bullets/inline items, or from the points once enhancements are known.
        reinforced: false,
        unit,
      };
      list.units.push(last);
      applyInline(last, parsed.inline);
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
  if (faction?.rules) list.rules = resolveRules(list, faction);
  if (list.declaredPoints !== undefined && list.units.length) {
    const total = listPoints(list);
    if (total !== list.declaredPoints) {
      mismatches.push(`List total: list says ${list.declaredPoints}, catalogue says ${total}`);
    }
  }
  if (mismatches.length) list.pointsMismatches = mismatches;
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
