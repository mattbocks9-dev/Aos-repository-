import { loadFaction } from '../data/catalog';
import { parseList } from '../data/listParser';
import type { SampleTeam } from '../data/samples';
import type { Player, Team } from '../data/team';

export async function parsePlayer(p: Omit<Player, 'list'>): Promise<Player> {
  const faction = p.factionId ? await loadFaction(p.factionId) : undefined;
  return { ...p, list: parseList(p.listText, faction) };
}

export async function teamFromSample(sample: SampleTeam): Promise<Team> {
  return { name: sample.name, players: await Promise.all(sample.players.map(parsePlayer)) };
}

export const teamReady = (team: Team) =>
  team.players.length === 5 && team.players.every((p) => p.factionId && p.list.units.length > 0);
