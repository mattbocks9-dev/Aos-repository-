import { readFileSync } from 'node:fs';
import { listPoints, parseList } from './listParser';
import { SAMPLE_NPC_TEAM, SAMPLE_USER_TEAM } from './samples';
import { validateTeam, type Team } from './team';
import type { FactionData } from './types';

const faction = (id: string) =>
  JSON.parse(readFileSync(`public/data/factions/${id}.json`, 'utf8')) as FactionData;

describe('sample teams', () => {
  it('cost enhancements and formations from the catalogue', () => {
    const alex = SAMPLE_USER_TEAM.players[0]!;
    const l = parseList(alex.listText, faction(alex.factionId));
    expect(l.units[0]!.enhancements?.map((e) => [e.name, e.points])).toEqual([
      ['Envoy of the Heavens', 20],
      ['Mirrorshield', 0],
    ]);
    const dee = SAMPLE_USER_TEAM.players[3]!;
    const d = parseList(dee.listText, faction(dee.factionId));
    expect(
      d.units.flatMap((u) => u.enhancements ?? []).map((e) => [e.name, e.table, e.points]),
    ).toEqual([
      ['Coatl Familiar', 'Artefacts of Power', 20],
      ['Armour Cruncher', 'Monstrous Traits', 10],
    ]);
    const eli = SAMPLE_USER_TEAM.players[4]!;
    expect(parseList(eli.listText, faction(eli.factionId)).rules?.formation).toMatchObject({
      name: 'Coven of Blood',
      points: 20,
    });
  });

  for (const sample of [SAMPLE_USER_TEAM, SAMPLE_NPC_TEAM]) {
    it(`${sample.name} parses cleanly against the real catalogue and is legal`, () => {
      const team: Team = {
        name: sample.name,
        players: sample.players.map((p) => ({
          ...p,
          list: parseList(p.listText, faction(p.factionId)),
        })),
      };
      for (const p of team.players) {
        expect(p.list.unmatched, p.name).toEqual([]);
        expect(p.list.pointsMismatches, p.name).toBeUndefined();
        for (const u of p.list.units) expect(u.unit, `${p.name}: ${u.name}`).toBeDefined();
        expect(p.list.rules?.manifestationLore, `${p.name} lore`).toBeDefined();
        expect(listPoints(p.list), p.name).toBeLessThanOrEqual(2000);
        expect(listPoints(p.list), p.name).toBeGreaterThan(1700);
        expect(p.list.rules?.formation, `${p.name} formation ${p.list.formation}`).toBeDefined();
      }
      expect(validateTeam(team, 2000, (id) => id)).toEqual([]);
    });
  }
});
