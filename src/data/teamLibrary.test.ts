import { readFileSync } from 'node:fs';
import {
  libraryEntryFromTeam,
  parseSubmission,
  TEAM_LIBRARY,
  validateLibraryTeam,
  type LibraryTeam,
} from './teamLibrary';
import type { FactionData } from './types';

const faction = (id: string): FactionData | undefined => {
  try {
    return JSON.parse(readFileSync(`public/data/factions/${id}.json`, 'utf8')) as FactionData;
  } catch {
    return undefined;
  }
};

describe('shared team library', () => {
  it('has unique ids', () => {
    const ids = TEAM_LIBRARY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const team of TEAM_LIBRARY) {
    it(`"${team.name}" is a valid, legal team against the BSData catalogue`, () => {
      expect(validateLibraryTeam(team, faction)).toEqual([]);
    });
  }

  it('reports problems with a submitted team', () => {
    const base = TEAM_LIBRARY[0]!;
    const bad: LibraryTeam = {
      ...base,
      name: '',
      players: [
        { ...base.players[0]!, listText: base.players[0]!.listText + '\nMade Up Unit (100)' },
        { ...base.players[1]!, factionId: 'not-a-faction' },
        { ...base.players[2]!, factionId: base.players[0]!.factionId },
        base.players[3]!,
      ],
    };
    const errors = validateLibraryTeam(bad, faction);
    expect(errors).toContain('Team name is missing.');
    expect(errors).toContain('A team needs 5 players (found 4).');
    expect(errors).toContain(
      'Alex: unit not in the Stormcast Eternals catalogue: "Made Up Unit (100)".',
    );
    expect(errors).toContain('Bea: unknown faction "not-a-faction".');
    expect(errors.some((e) => e.includes('both play Stormcast Eternals'))).toBe(true);
  });

  it('parses a team from a GitHub issue form body', () => {
    const team = TEAM_LIBRARY[1]!;
    const body = [
      '### Team name',
      '',
      'Rot Pact v2',
      '',
      '### Team data',
      '',
      '```json',
      JSON.stringify(libraryEntryFromTeam({ name: team.name, players: team.players }), null, 2),
      '```',
    ].join('\n');
    const parsed = parseSubmission(body, 'some-user');
    expect(parsed.name).toBe('The Rot Pact');
    expect(parsed.id).toBe('the-rot-pact');
    expect(parsed.submittedBy).toBe('some-user');
    expect(parsed.players).toHaveLength(5);
    expect(parsed.players[0]).toEqual(team.players[0]);
  });

  it('rejects issue bodies without valid team data', () => {
    expect(() => parseSubmission('no json here', 'x')).toThrow(/No team data/);
    expect(() => parseSubmission('```json\n{"name": 3}\n```', 'x')).toThrow(/players/);
  });
});
