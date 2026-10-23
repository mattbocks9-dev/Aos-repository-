// Adds an approved team submission (a GitHub issue) to src/data/team-library.json.
// Run by .github/workflows/team-submission.yml with the issue body in ISSUE_BODY.
// Exits non-zero and writes the reasons to add-team-result.md if the team is invalid.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseSubmission, validateLibraryTeam, type LibraryTeam } from '../src/data/teamLibrary';
import type { FactionData } from '../src/data/types';

const LIBRARY = 'src/data/team-library.json';

export function addToLibrary(library: LibraryTeam[], team: LibraryTeam): LibraryTeam[] {
  const same = library.findIndex((t) => t.id === team.id && t.submittedBy === team.submittedBy);
  if (same >= 0) return library.map((t, i) => (i === same ? team : t));
  let id = team.id;
  for (let n = 2; library.some((t) => t.id === id); n++) id = `${team.id}-${n}`;
  return [...library, { ...team, id }];
}

function notesFrom(body: string): string | undefined {
  const m = /### Notes \(optional\)\s*([\s\S]*?)(?=\n### |$)/.exec(body);
  const text = m?.[1]?.trim();
  return text && text !== '_No response_' ? text : undefined;
}

function main() {
  const body = process.env.ISSUE_BODY ?? '';
  const author = process.env.ISSUE_AUTHOR ?? 'unknown';
  const faction = (id: string): FactionData | undefined => {
    const path = `public/data/factions/${id}.json`;
    return /^[a-z0-9-]+$/.test(id) && existsSync(path)
      ? (JSON.parse(readFileSync(path, 'utf8')) as FactionData)
      : undefined;
  };
  let team: LibraryTeam;
  try {
    team = parseSubmission(body, author);
  } catch (e) {
    writeFileSync('add-team-result.md', `Could not read the team: ${(e as Error).message}\n`);
    process.exit(1);
  }
  const notes = notesFrom(body);
  if (notes) team.notes = notes.slice(0, 500);
  const errors = validateLibraryTeam(team, faction);
  if (errors.length) {
    writeFileSync(
      'add-team-result.md',
      `This team can't be added yet:\n\n${errors.map((e) => `- ${e}`).join('\n')}\n`,
    );
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(LIBRARY, 'utf8')) as { teams: LibraryTeam[] };
  data.teams = addToLibrary(data.teams, team);
  writeFileSync(LIBRARY, JSON.stringify(data, null, 2) + '\n');
  const added = data.teams.find((t) => t.name === team.name && t.submittedBy === author)!;
  writeFileSync(
    'add-team-result.md',
    `Added **${added.name}** to the shared library (id \`${added.id}\`).\n`,
  );
  console.log(`added ${added.id}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
