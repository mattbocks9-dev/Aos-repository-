// Pure helpers that turn BSData (BattleScribe / New Recruit) catalogue XML into
// the compact faction JSON the app ships with. Kept free of fs/network so it can
// be unit tested against small fixtures.
import { XMLParser } from 'fast-xml-parser';
import type { FactionData, UnitData, WeaponData } from '../src/data/types';
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
  };
}

function pointsOf(node: Node): number {
  const cost = children(node, 'costs', 'cost').find((c) => c.typeId === 'points');
  return cost ? Number(cost.value) : 0;
}

/** Build the playable unit roster of one faction catalogue. */
export function buildFaction(
  faction: ParsedCatalogue,
  index: Map<string, Node>,
  meta: { id: string; grandAlliance: string },
): FactionData {
  const units = new Map<string, UnitData>();
  const consider = (target: Node | undefined, points: number) => {
    if (!target || target.type !== 'unit' || points <= 0) return;
    const unit = extractUnit(target, points);
    if (unit && !units.has(unit.name)) units.set(unit.name, unit);
  };
  for (const link of children(faction.root, 'entryLinks', 'entryLink')) {
    const target = index.get(String(link.targetId));
    consider(target, pointsOf(link) || (target ? pointsOf(target) : 0));
  }
  for (const entry of children(faction.root, 'sharedSelectionEntries', 'selectionEntry')) {
    consider(entry, pointsOf(entry));
  }
  return {
    id: meta.id,
    name: faction.name,
    grandAlliance: meta.grandAlliance,
    units: [...units.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
