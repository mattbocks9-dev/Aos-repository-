// The two quick-play teams are the first entries of the shared team library.
import { TEAM_LIBRARY, type LibraryPlayer, type LibraryTeam } from './teamLibrary';

export type SamplePlayer = LibraryPlayer;
export type SampleTeam = LibraryTeam;

const byId = (id: string) => {
  const team = TEAM_LIBRARY.find((t) => t.id === id);
  if (!team) throw new Error(`team library is missing ${id}`);
  return team;
};

export const SAMPLE_USER_TEAM: SampleTeam = byId('hammers-of-lake-forest');
export const SAMPLE_NPC_TEAM: SampleTeam = byId('the-rot-pact');
