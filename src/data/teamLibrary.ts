// Shared team library: curated teams everyone can load from a dropdown. New teams are
// submitted as GitHub issues and added by scripts/add-team.ts once a maintainer approves.
import library from './team-library.json';
import { parseList, listPoints } from './listParser';
import { validateTeam } from './team';
import type { FactionData } from './types';

export interface LibraryPlayer {
  name: string;
  factionId: string;
  listText: string;
}

export interface LibraryTeam {
  id: string;
  name: string;
  notes?: string;
  submittedBy?: string;
  players: LibraryPlayer[];
}

export const TEAM_LIBRARY: LibraryTeam[] = (library as { teams: LibraryTeam[] }).teams;

export const teamSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** The shareable form of a team: names, factions and pasted lists only (points come from the catalogue). */
export function libraryEntryFromTeam(team: {
  name: string;
  players: LibraryPlayer[];
}): LibraryTeam {
  return {
    id: teamSlug(team.name),
    name: team.name,
    players: team.players.map(({ name, factionId, listText }) => ({ name, factionId, listText })),
  };
}

export function validateLibraryTeam(
  team: LibraryTeam,
  factionById: (id: string) => FactionData | undefined,
  { teamSize = 5, pointsLimit = 2000 } = {},
): string[] {
  const errors: string[] = [];
  if (!team.name.trim()) errors.push('Team name is missing.');
  if (team.players.length !== teamSize) {
    errors.push(`A team needs ${teamSize} players (found ${team.players.length}).`);
  }
  const parsed = team.players.map((p) => {
    const faction = factionById(p.factionId);
    if (!p.name.trim()) errors.push('A player name is missing.');
    if (!faction) {
      errors.push(`${p.name}: unknown faction "${p.factionId}".`);
      return { ...p, list: { units: [], unmatched: [] } };
    }
    const list = parseList(p.listText, faction);
    if (!list.units.length) errors.push(`${p.name}: the list has no units.`);
    for (const line of list.unmatched) {
      errors.push(`${p.name}: unit not in the ${faction.name} catalogue: "${line}".`);
    }
    for (const m of list.pointsMismatches ?? [])
      errors.push(`${p.name}: points differ from the catalogue: ${m}.`);
    const pts = listPoints(list);
    if (pts > pointsLimit)
      errors.push(`${p.name}: ${pts} pts is over the ${pointsLimit} pt limit.`);
    return { ...p, list };
  });
  for (const issue of validateTeam(
    { name: team.name, players: parsed },
    Infinity,
    (id) => factionById(id)?.name ?? id,
  )) {
    errors.push(issue.message);
  }
  return errors;
}

/** Pull the team JSON out of a submission issue body. */
export function parseSubmission(body: string, submittedBy: string): LibraryTeam {
  const block = /```(?:json)?\s*([\s\S]*?)```/.exec(body)?.[1] ?? /(\{[\s\S]*\})/.exec(body)?.[1];
  if (!block) throw new Error('No team data found in the issue.');
  let data: unknown;
  try {
    data = JSON.parse(block);
  } catch {
    throw new Error('The team data is not valid JSON.');
  }
  const d = data as Partial<LibraryTeam>;
  if (typeof d.name !== 'string' || !Array.isArray(d.players)) {
    throw new Error('The team data needs a "name" and a list of "players".');
  }
  const players = d.players.map((p: Partial<LibraryPlayer>) => ({
    name: String(p.name ?? ''),
    factionId: String(p.factionId ?? ''),
    listText: String(p.listText ?? ''),
  }));
  return { ...libraryEntryFromTeam({ name: d.name, players }), submittedBy };
}
