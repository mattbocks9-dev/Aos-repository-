// Real-world export formats, parsed against the real BSData catalogue.
import { readFileSync } from 'node:fs';
import { detectFaction, listPoints, parseList, pointsBreakdown } from './listParser';
import type { FactionData, FactionIndex } from './types';

const index = JSON.parse(readFileSync('public/data/index.json', 'utf8')) as FactionIndex;
const faction = (id: string) =>
  JSON.parse(readFileSync(`public/data/factions/${id}.json`, 'utf8')) as FactionData;
const parse = (text: string) => {
  const id = detectFaction(text, index.factions);
  expect(id).toBe('ogor-mawtribes');
  return parseList(text, faction(id!));
};

const EXPECTED_UNITS = [
  ['Redd the Maw, High Slaughtermaster', 420],
  ['Cleavers', 220],
  ['Gluttons', 420],
  ['Gorger Mawpack', 240],
  ['Gutseers', 200],
  ['Bloodpelt Hunter', 130],
  ['Hunters with Sabrefangs', 340],
];

describe('GW app export (the most common format)', () => {
  const list = parse(readFileSync('e2e/fixtures/lists/gw-app-ogors.txt', 'utf8'));

  it('reads every unit, reinforcement and enhancement', () => {
    expect(list.units.map((u) => [u.name, u.points])).toEqual(EXPECTED_UNITS);
    expect(list.units.filter((u) => u.reinforced).map((u) => u.name)).toEqual([
      'Gluttons',
      'Hunters with Sabrefangs',
    ]);
    expect(list.units[5]!.enhancements?.map((e) => e.name)).toEqual([
      'A Choice Cut',
      'Dreaded Far and Wide',
    ]);
    expect(list.unmatched).toEqual([]);
  });

  it('reads the formation, lores (with their points), battle tactics and faction terrain', () => {
    expect(list.rules?.formation).toMatchObject({ name: 'Maw-Cult Fanatics', points: 10 });
    expect(list.rules?.spellLore?.name).toBe('Lore of Gut Magic');
    expect(list.rules?.manifestationLore).toMatchObject({ name: 'Morbid Conjuration', points: 20 });
    expect(list.battleTactics).toEqual(['Siege of Ashes', 'Blazing Onslaught']);
    expect(list.factionTerrain).toBe('Mawpit');
  });

  it('adds up to the 2000 points the app reports, from the catalogue alone', () => {
    expect(list.declaredPoints).toBe(2000);
    expect(pointsBreakdown(list)).toEqual({
      units: 1970,
      enhancements: 0,
      formation: 10,
      lores: 20,
      total: 2000,
    });
    expect(list.pointsMismatches).toBeUndefined();
  });

  it("ignores the app's footer lines", () => {
    expect(list.formation).toBe('Maw-Cult Fanatics');
  });
});

describe('other export formats', () => {
  it('New Recruit / BattleScribe text export', () => {
    const list = parse(
      [
        '++ Army Roster (Ogor Mawtribes) [2000pts] ++',
        '',
        '+ Configuration +',
        'Battle Formation: Maw-Cult Fanatics',
        'Spell Lore: Lore of Gut Magic',
        'Manifestation Lore: Morbid Conjuration',
        '',
        '+ Hero +',
        'Redd the Maw, High Slaughtermaster [420pts]: General',
        'Bloodpelt Hunter [130pts]: A Choice Cut, Dreaded Far and Wide',
        '',
        '+ Infantry +',
        'Cleavers [220pts]',
        'Gluttons [420pts]: Reinforced',
        'Gorger Mawpack [240pts]',
        'Gutseers [200pts]',
        'Hunters with Sabrefangs [340pts]: Reinforced',
        '',
        '++ Total: [2000pts] ++',
      ].join('\n'),
    );
    expect(list.units.map((u) => [u.name, u.points])).toEqual([
      ...EXPECTED_UNITS.slice(0, 1),
      EXPECTED_UNITS[5]!,
      ...EXPECTED_UNITS.slice(1, 5),
      EXPECTED_UNITS[6]!,
    ]);
    expect(
      list.units.find((u) => u.name === 'Bloodpelt Hunter')!.enhancements?.map((e) => e.name),
    ).toEqual(['A Choice Cut', 'Dreaded Far and Wide']);
    expect(list.units.find((u) => u.name === 'Gluttons')!.reinforced).toBe(true);
    expect(list.unmatched).toEqual([]);
    expect(list.declaredPoints).toBe(2000);
    expect(listPoints(list)).toBe(2000);
  });

  it('dash, colon and multiplier variants', () => {
    const list = parse(
      [
        'Ogor Mawtribes',
        'Bloodpelt Hunter - 130 pts',
        '  - A Choice Cut',
        '2 x Cleavers: 440 pts',
        'Gutseers 200pts',
        'Gorger Mawpack x1 (240)',
      ].join('\n'),
    );
    expect(list.units.map((u) => [u.name, u.points])).toEqual([
      ['Bloodpelt Hunter', 130],
      ['Cleavers', 220],
      ['Cleavers', 220],
      ['Gutseers', 200],
      ['Gorger Mawpack', 240],
    ]);
    expect(list.units[0]!.enhancements?.map((e) => e.name)).toEqual(['A Choice Cut']);
    expect(list.unmatched).toEqual([]);
  });

  it("flags a list whose stated total doesn't match the catalogue", () => {
    const list = parse(['Ogor Mawtribes 1990/2000 pts', 'Cleavers (220)'].join('\n'));
    expect(list.pointsMismatches).toEqual(['List total: list says 1990, catalogue says 220']);
  });
});

describe('GW app export with points written straight after the name', () => {
  // e.g. "Alarielle the Everqueen620" and "• Glamourweave - (20) Points"
  const text = readFileSync('e2e/fixtures/lists/gw-app-sylvaneth-aor.txt', 'utf8');
  const id = detectFaction(text, index.factions);
  const list = parseList(text, faction(id!));

  it('reads every unit and enhancement', () => {
    expect(id).toBe('sylvaneth');
    expect(list.units.map((u) => [u.name, u.points])).toEqual([
      ['Alarielle the Everqueen', 620],
      ['Belthanos, First Thorn of Kurnoth', 290],
      ['Drycha Hamadreth', 250],
      ['Dryads', 100],
      ['Dryads', 100],
      ['Spite-Revenants', 110],
      ['Spirit of Durthu', 340],
      ['Warsong Revenant', 190],
    ]);
    expect(list.units.flatMap((u) => u.enhancements ?? []).map((e) => [e.name, e.points])).toEqual([
      ['Aspect of Heartwood', 10],
      ['Glamourweave', 20],
      ['Realmroot Guide', 0],
    ]);
    expect(list.unmatched).toEqual([]);
  });

  it('reads the formation, lores, tactics and terrain, and totals 2000 from the catalogue', () => {
    expect(list.rules?.formation?.name).toBe('Lords of the Clan');
    expect(list.rules?.spellLore?.name).toBe('Lore of the Deepwood');
    expect(list.rules?.prayerLore?.name).toBe('Lore of the Spirit-Song');
    expect(list.rules?.manifestationLore?.name).toBe('Manifestations of the Deepwood');
    expect(list.battleTactics).toEqual(['Siege of Ashes', 'Legend of the Parch']);
    expect(list.factionTerrain).toBe('Awakened Wyldwood');
    expect(listPoints(list)).toBe(2000);
    expect(list.pointsMismatches).toBeUndefined();
  });

  it('does not mistake the roster number for points', () => {
    expect(list.declaredPoints).toBe(2000);
  });
});

describe('GW app header variants', () => {
  const lumineth = faction('lumineth-realm-lords');

  it('reads "Grand Alliance | Faction | Formation (points)" header lines', () => {
    const list = parseList(
      [
        'Shane Lambert',
        'Moo 290/2000 pts',
        '-----',
        'Grand Alliance Order | Lumineth Realm-lords | Aelementor Guardians (10 Points)',
        "General's Handbook 2026-27",
        'Drops: 3',
        'Alarith Stonemage (110)',
        'Vanari Auralan Wardens (170)',
        '• Reinforced',
      ].join('\n'),
      lumineth,
    );
    expect(list.unmatched).toEqual([]);
    expect(list.rules?.formation).toMatchObject({ name: 'Aelementor Guardians', points: 10 });
    expect(list.units.map((u) => u.name)).toEqual(['Alarith Stonemage', 'Vanari Auralan Wardens']);
  });

  it('splits battle tactic cards joined with "and"', () => {
    const list = parseList(
      'Battle Tactics Cards: Burning for Vengeance and Siege of Ashes',
      lumineth,
    );
    expect(list.battleTactics).toEqual(['Burning for Vengeance', 'Siege of Ashes']);
    const comma = parseList('Battle Tactic Cards: Legend of the Parch, Siege of Ashes', lumineth);
    expect(comma.battleTactics).toEqual(['Legend of the Parch', 'Siege of Ashes']);
  });

  it('never treats other pipe-separated lines (app footer) as units or formations', () => {
    const list = parseList(
      ['Alarith Stonemage (110)', 'App: 1.38.1 | Data: 483 | Build 12'].join('\n'),
      lumineth,
    );
    expect(list.unmatched).toEqual([]);
    expect(list.formation).toBeUndefined();
  });
});
