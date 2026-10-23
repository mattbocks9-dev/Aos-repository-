import { readFileSync } from 'node:fs';
import { listPoints, parseList } from './listParser';
import { SAMPLE_NPC_TEAM, SAMPLE_USER_TEAM } from './samples';
import { validateTeam, type Team } from './team';
import type { FactionData } from './types';

const faction = (id: string) =>
  JSON.parse(readFileSync(`public/data/factions/${id}.json`, 'utf8')) as FactionData;

describe('sample teams', () => {
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
        expect(listPoints(p.list), p.name).toBeGreaterThan(1700);
      }
      expect(validateTeam(team, 2000, (id) => id)).toEqual([]);
    });
  }
});
