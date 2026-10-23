// Pure helpers that turn BSData (BattleScribe / New Recruit) catalogue XML into
// the compact faction JSON the app ships with. Kept free of fs/network so it can
// be unit tested against small fixtures.
import { XMLParser } from 'fast-xml-parser';
import type {
  AbilityData,
  AbilityKind,
  FactionData,
  FactionRules,
  RuleOption,
  UnitData,
  WeaponData,
} from '../src/data/types';
export { diceAverage } from '../src/data/dice';

type Node = Record<string, unknown>;

const ARRAY_TAGS = new Set([
  'selectionEntry',
  'entryLink',
  'categoryLink',
  'profile',
  'characteristic',
  'cost',
  'constraint',
  'catalogueLink',
  'selectionEntryGroup',
  'attribute',
  'modifier',
  'condition',
  'conditionGroup',
  'forceEntry',
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
  parseAttributeValue: false,
  parseTagValue: false,
  isArray: (name) => ARRAY_TAGS.has(name),
});

export interface ParsedCatalogue {
  id: string;
  name: string;
  library: boolean;
  root: Node;
  links: { targetId: string; name: string }[];
}

export function parseCatalogue(xml: string): ParsedCatalogue {
  const doc = parser.parse(xml) as Node;
  const root = doc.catalogue as Node;
  const links = (((root.catalogueLinks as Node | undefined)?.catalogueLink as Node[]) ?? []).map(
    (l) => ({ targetId: String(l.targetId), name: String(l.name) }),
  );
  return {
    id: String(root.id),
    name: String(root.name),
    library: String(root.library) === 'true',
    root,
    links,
  };
}

function children(node: Node | undefined, container: string, tag: string): Node[] {
  const c = node?.[container] as Node | undefined;
  return (c?.[tag] as Node[] | undefined) ?? [];
}

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  const t = (v as Node)['#text'];
  return t == null ? '' : String(t).trim();
}

function characteristics(profile: Node): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of children(profile, 'characteristics', 'characteristic')) {
    out[String(c.name)] = text(c);
  }
  return out;
}

/** Walk every selectionEntry (recursively) and index it by id. */
export function indexEntries(cats: ParsedCatalogue[]): Map<string, Node> {
  const index = new Map<string, Node>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const n = node as Node;
    for (const [key, value] of Object.entries(n)) {
      if (key === 'selectionEntry' && Array.isArray(value)) {
        for (const e of value as Node[]) {
          if (e.id) index.set(String(e.id), e);
        }
      }
      if (typeof value === 'object') visit(value);
    }
  };
  cats.forEach((c) => visit(c.root));
  return index;
}

function collectProfiles(node: unknown, out: Node[] = []): Node[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((n) => collectProfiles(n, out));
    return out;
  }
  const n = node as Node;
  for (const [key, value] of Object.entries(n)) {
    if (key === 'profile' && Array.isArray(value)) out.push(...(value as Node[]));
    else if (typeof value === 'object') collectProfiles(value, out);
  }
  return out;
}

const num = (s: string | undefined): number => {
  const m = /-?\d+(\.\d+)?/.exec(s ?? '');
  return m ? Number(m[0]) : 0;
};

function modelCount(entry: Node): number {
  let total = 0;
  for (const child of children(entry, 'selectionEntries', 'selectionEntry')) {
    if (child.type !== 'model') continue;
    const min = children(child, 'constraints', 'constraint').find(
      (c) => c.type === 'min' && c.field === 'selections' && c.scope === 'parent',
    );
    total += min ? Number(min.value) : 1;
  }
  return Math.max(total, 1);
}

/** BSData wraps keywords as **^^Keyword^^**. */
export const stripMarkup = (s: string): string => s.replace(/\*\*|\^\^/g, '');

function weapon(profile: Node, kind: 'melee' | 'ranged'): WeaponData {
  const c = characteristics(profile);
  return {
    name: String(profile.name),
    kind,
    range: kind === 'ranged' ? num(c.Rng) : 0,
    attacks: c.Atk ?? '0',
    hit: num(c.Hit),
    wound: num(c.Wnd),
    rend: num(c.Rnd),
    damage: c.Dmg ?? '0',
    ability: c.Ability && c.Ability !== '-' ? stripMarkup(c.Ability) : undefined,
  };
}

const ABILITY_KINDS: Record<string, AbilityKind> = {
  'Ability (Passive)': 'passive',
  'Ability (Activated)': 'activated',
  'Ability (Spell)': 'spell',
  'Ability (Prayer)': 'prayer',
  'Ability (Command)': 'command',
};

const clean = (s: string | undefined) => (s ? stripMarkup(s).replace(/\s+/g, ' ').trim() : '');

function attributes(profile: Node): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of children(profile, 'attributes', 'attribute')) out[String(a.name)] = text(a);
  return out;
}

export function extractAbility(profile: Node): AbilityData | null {
  const kind = ABILITY_KINDS[String(profile.typeName)];
  if (!kind) return null;
  const c = characteristics(profile);
  const a = attributes(profile);
  const ability: AbilityData = { name: String(profile.name), kind, effect: clean(c.Effect) };
  const category = a.Type || a['Parent Node'];
  if (category) ability.category = category;
  if (c.Timing) ability.timing = clean(c.Timing);
  const value = c['Casting Value'] ?? c['Chanting Value'];
  if (value) ability.castingValue = num(value);
  if (c.Declare) ability.declare = clean(c.Declare);
  // Keep key order stable for snapshotting: name, kind, category, timing, castingValue, declare, effect.
  const { effect, ...rest } = ability;
  return { ...rest, effect };
}

function abilitiesOf(node: unknown): AbilityData[] {
  const seen = new Set<string>();
  const out: AbilityData[] = [];
  for (const p of collectProfiles(node)) {
    const a = extractAbility(p);
    if (a && !seen.has(a.name)) {
      seen.add(a.name);
      out.push(a);
    }
  }
  return out;
}

export function extractUnit(entry: Node, points: number): UnitData | null {
  const profiles = collectProfiles(entry);
  const unitProfile = profiles.find((p) => p.typeName === 'Unit');
  if (!unitProfile) return null;
  const stats = characteristics(unitProfile);
  const keywords = children(entry, 'categoryLinks', 'categoryLink').map((c) => String(c.name));
  const seen = new Set<string>();
  const weapons: WeaponData[] = [];
  for (const p of profiles) {
    const kind =
      p.typeName === 'Melee Weapon' ? 'melee' : p.typeName === 'Ranged Weapon' ? 'ranged' : null;
    if (!kind || seen.has(`${kind}:${p.name}`)) continue;
    seen.add(`${kind}:${p.name}`);
    weapons.push(weapon(p, kind));
  }
  const kw = (prefix: string) => {
    const k = keywords.find((x) => x.startsWith(prefix));
    return k ? num(k) : 0;
  };
  return {
    name: String(entry.name),
    points,
    move: num(stats.Move),
    health: num(stats.Health),
    save: num(stats.Save) || 7,
    control: num(stats.Control),
    models: modelCount(entry),
    ward: kw('WARD'),
    wizard: kw('WIZARD'),
    priest: kw('PRIEST'),
    keywords: keywords.filter((k) => !/^(WARD|WIZARD|PRIEST) \(/.test(k)),
    weapons,
    abilities: abilitiesOf(entry),
  };
}

/** Index every selectionEntryGroup by id (for entryLinks of type selectionEntryGroup). */
export function indexGroups(cats: ParsedCatalogue[]): Map<string, Node> {
  const index = new Map<string, Node>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    for (const [key, value] of Object.entries(node as Node)) {
      if (key === 'selectionEntryGroup' && Array.isArray(value)) {
        for (const g of value as Node[]) if (g.id) index.set(String(g.id), g);
      }
      if (typeof value === 'object') visit(value);
    }
  };
  cats.forEach((c) => visit(c.root));
  return index;
}

function findAll(node: unknown, pred: (tag: string, n: Node) => boolean, out: Node[] = []): Node[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((n) => findAll(n, pred, out));
    return out;
  }
  for (const [key, value] of Object.entries(node as Node)) {
    if (Array.isArray(value)) {
      for (const v of value)
        if (v && typeof v === 'object' && pred(key, v as Node)) out.push(v as Node);
    }
    if (typeof value === 'object') findAll(value, pred, out);
  }
  return out;
}

const isHidden = (n: Node) => String(n.hidden) === 'true';

/**
 * The newest "General's Handbook" force in the game system: the matched-play roster type.
 * Season options (e.g. extra battle formations) are hidden unless a roster uses it.
 */
export function matchedPlayForceId(gstXml: string): string | undefined {
  const root = (parser.parse(gstXml) as Node).gameSystem as Node;
  const year = (f: Node) => Number(/General.s Handbook (\d{4})/.exec(String(f.name))?.[1] ?? 0);
  const forces = children(root, 'forceEntries', 'forceEntry')
    .filter((f) => year(f) > 0)
    .sort((a, b) => year(a) - year(b));
  const latest = forces[forces.length - 1];
  return latest ? String(latest.id) : undefined;
}

/** Whether an option is hidden for a matched-play roster (applying hide/unhide modifiers keyed on that force). */
function hiddenInMatchedPlay(n: Node, force: string | undefined): boolean {
  let hidden = isHidden(n);
  if (!force) return hidden;
  for (const m of children(n, 'modifiers', 'modifier')) {
    if (m.field !== 'hidden') continue;
    const onForce = findAll(m, (tag) => tag === 'condition').some(
      (c) => c.childId === force && c.type === 'instanceOf',
    );
    if (onForce) hidden = String(m.value) === 'true';
  }
  return hidden;
}

type Resolver = { entries: Map<string, Node>; groups: Map<string, Node>; force?: string };

/** Abilities of an option, following its links into other entries/groups (e.g. a lore → its spells). */
function resolvedAbilities(n: Node, r: Resolver, depth = 0): AbilityData[] {
  const out = abilitiesOf(n);
  if (depth > 3) return out;
  for (const l of findAll(n, (tag) => tag === 'entryLink')) {
    const target =
      l.type === 'selectionEntryGroup'
        ? r.groups.get(String(l.targetId))
        : r.entries.get(String(l.targetId));
    if (!target) continue;
    for (const a of resolvedAbilities(target, r, depth + 1)) {
      if (!out.some((x) => x.name === a.name)) out.push(a);
    }
  }
  return out;
}

function option(name: string, n: Node, r: Resolver): RuleOption {
  const points = pointsOf(n);
  return points > 0
    ? { name, points, abilities: resolvedAbilities(n, r) }
    : { name, abilities: resolvedAbilities(n, r) };
}

/**
 * The options inside a battletome group. Only the faction's own, visible options count:
 * links to shared groups (generic or realm-specific tables) and hidden legacy groups are skipped.
 */
function groupOptions(group: Node, r: Resolver): RuleOption[] {
  const out: RuleOption[] = [];
  const add = (n: Node | undefined, name?: string) => {
    if (!n || hiddenInMatchedPlay(n, r.force)) return;
    if (children(n, 'categoryLinks', 'categoryLink').some((c) => c.name === 'Legends')) return;
    const optName = name ?? String(n.name);
    if (!out.some((o) => o.name === optName)) out.push(option(optName, n, r));
  };
  for (const e of children(group, 'selectionEntries', 'selectionEntry')) add(e);
  for (const l of children(group, 'entryLinks', 'entryLink')) {
    if (l.type !== 'selectionEntryGroup') add(r.entries.get(String(l.targetId)), String(l.name));
  }
  for (const g of children(group, 'selectionEntryGroups', 'selectionEntryGroup')) {
    if (hiddenInMatchedPlay(g, r.force)) continue;
    for (const o of groupOptions(g, r)) if (!out.some((x) => x.name === o.name)) out.push(o);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const STANDARD_TABLES =
  /^(Battle Formations|Heroic Traits|Artefacts of Power|Spell Lores|Prayer Lores|Manifestation Lores|Battle Wounds|Paths)/;

export function buildRules(
  faction: ParsedCatalogue,
  entries: Map<string, Node>,
  groups: Map<string, Node>,
  force?: string,
): FactionRules {
  const groupNamed = (pred: (name: string) => boolean): RuleOption[] => {
    const found = findAll(
      faction.root,
      (tag, n) => tag === 'selectionEntryGroup' && pred(String(n.name)),
    );
    const opts: RuleOption[] = [];
    for (const g of found) {
      for (const o of groupOptions(g, { entries, groups, force }))
        if (!opts.some((x) => x.name === o.name)) opts.push(o);
    }
    return opts;
  };
  // Groups reached through a standard table (a lore's spells, a shared generic table) aren't
  // enhancement tables of their own.
  const linkedFromStandard = new Set(
    findAll(
      faction.root,
      (tag, n) => tag === 'selectionEntryGroup' && STANDARD_TABLES.test(String(n.name)),
    )
      .flatMap((g) => findAll(g, (tag) => tag === 'entryLink'))
      .map((l) => String(l.targetId)),
  );
  const traitEntries = findAll(
    faction.root,
    (tag, n) =>
      (tag === 'selectionEntry' || tag === 'entryLink') &&
      String(n.name).startsWith('Battle Traits'),
  ).map((n) => (n.targetId ? entries.get(String(n.targetId)) : n));
  return {
    battleTraits: abilitiesOf(traitEntries.filter(Boolean)),
    formations: groupNamed((n) => n.startsWith('Battle Formations')),
    heroicTraits: groupNamed((n) => n === 'Heroic Traits'),
    artefacts: groupNamed((n) => n === 'Artefacts of Power'),
    spellLores: groupNamed((n) => n === 'Spell Lores'),
    prayerLores: groupNamed((n) => n === 'Prayer Lores'),
    manifestationLores: groupNamed((n) => n === 'Manifestation Lores'),
    enhancementTables: children(faction.root, 'sharedSelectionEntryGroups', 'selectionEntryGroup')
      .filter(
        (g) =>
          !STANDARD_TABLES.test(String(g.name)) &&
          !linkedFromStandard.has(String(g.id)) &&
          !hiddenInMatchedPlay(g, force),
      )
      .map((g) => ({ name: String(g.name), options: groupOptions(g, { entries, groups, force }) }))
      .filter((t) => t.options.length > 0),
  };
}

const ALLIANCES = ['ORDER', 'CHAOS', 'DEATH', 'DESTRUCTION'] as const;

/** The Grand Alliance keyword most of a faction's units carry. */
export function grandAllianceOf(units: UnitData[]): string {
  const counts = ALLIANCES.map((a) => units.filter((u) => u.keywords.includes(a)).length);
  const best = ALLIANCES[counts.indexOf(Math.max(...counts))]!;
  return best[0] + best.slice(1).toLowerCase();
}

/**
 * Playable factions are the catalogue's own top-level, non-library catalogues.
 * Armies of Renown ("Faction - Army") count as their base faction under team rules,
 * and Legends, Regiments of Renown and Path to Glory aren't used at matched-play events.
 */
export function isPlayableFaction(cat: ParsedCatalogue): boolean {
  return (
    !cat.library &&
    !cat.name.includes(' - ') &&
    !/\[LEGENDS|Regiments of Renown|Path to Glory|Lores/i.test(cat.name)
  );
}

/** Manifestation lores any army may take, from the "❖ Lores" catalogue. */
export function universalManifestationLores(
  lores: ParsedCatalogue,
  entries: Map<string, Node>,
  groups: Map<string, Node>,
): RuleOption[] {
  const r: Resolver = { entries, groups };
  // Visible links in a "Manifestation Lore" group; faction-only lores are hidden until unlocked.
  const names = new Set(
    findAll(
      lores.root,
      (tag, n) => tag === 'selectionEntryGroup' && n.name === 'Manifestation Lore',
    )
      .flatMap((g) => children(g, 'entryLinks', 'entryLink'))
      .filter((l) => !isHidden(l))
      .map((l) => String(l.name)),
  );
  const out: RuleOption[] = [];
  for (const e of findAll(
    lores.root,
    (tag, n) => tag === 'selectionEntry' && n.type === 'upgrade',
  )) {
    const name = String(e.name);
    if (names.has(name) && !out.some((o) => o.name === name)) out.push(option(name, e, r));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function pointsOf(node: Node): number {
  const cost = children(node, 'costs', 'cost').find((c) => c.typeId === 'points');
  return cost ? Number(cost.value) : 0;
}

/** Build the playable unit roster of one faction catalogue. */
export function buildFaction(
  faction: ParsedCatalogue,
  index: Map<string, Node>,
  meta: { id: string; grandAlliance?: string },
  groups: Map<string, Node> = new Map(),
  force?: string,
): FactionData {
  const units = new Map<string, UnitData>();
  const consider = (target: Node | undefined, points: number) => {
    if (!target || target.type !== 'unit' || points <= 0) return;
    const unit = extractUnit(target, points);
    // Warhammer Legends units aren't used at matched-play events.
    if (unit?.keywords.includes('Legends')) return;
    if (unit && !units.has(unit.name)) units.set(unit.name, unit);
  };
  for (const link of children(faction.root, 'entryLinks', 'entryLink')) {
    const target = index.get(String(link.targetId));
    consider(target, pointsOf(link) || (target ? pointsOf(target) : 0));
  }
  for (const entry of children(faction.root, 'sharedSelectionEntries', 'selectionEntry')) {
    consider(entry, pointsOf(entry));
  }
  const roster = [...units.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    id: meta.id,
    name: faction.name,
    grandAlliance: meta.grandAlliance ?? grandAllianceOf(roster),
    units: roster,
    rules: buildRules(faction, index, groups, force),
  };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
