import { listPoints, type ArmyList } from './listParser';

export interface Player {
  name: string;
  factionId: string;
  listText: string;
  list: ArmyList;
}

export interface Team {
  name: string;
  players: Player[];
}

export interface TeamIssue {
  rule: string;
  message: string;
}

/** Checks a team against the OTTD-style team composition rules. Issues are warnings. */
export function validateTeam(
  team: Team,
  pointsLimit: number,
  factionName: (id: string) => string,
): TeamIssue[] {
  const issues: TeamIssue[] = [];
  const seen = new Map<string, string>();
  for (const p of team.players) {
    if (!p.factionId) continue;
    const prev = seen.get(p.factionId);
    if (prev) {
      issues.push({
        rule: 'unique-faction',
        message: `${prev} and ${p.name} both play ${factionName(p.factionId)}.`,
      });
    } else seen.set(p.factionId, p.name);
  }

  const warscrolls = new Map<string, string>();
  for (const p of team.players) {
    for (const name of new Set(p.list.units.map((u) => u.name))) {
      const prev = warscrolls.get(name);
      if (prev && prev !== p.name) {
        issues.push({
          rule: 'no-shared-warscrolls',
          message: `${prev} and ${p.name} both use ${name}.`,
        });
      } else warscrolls.set(name, p.name);
    }
  }

  const lores = new Map<string, string>();
  for (const p of team.players) {
    const lore = p.list.manifestationLore;
    if (!lore) continue;
    const prev = lores.get(lore.toLowerCase());
    if (prev)
      issues.push({
        rule: 'unique-manifestation-lore',
        message: `${prev} and ${p.name} both take ${lore}.`,
      });
    else lores.set(lore.toLowerCase(), p.name);
  }

  for (const p of team.players) {
    const seen = new Set<string>();
    for (const e of p.list.units.flatMap((u) => u.enhancements ?? [])) {
      if (seen.has(e.name)) {
        issues.push({
          rule: 'unique-enhancement',
          message: `${p.name}'s list takes ${e.name} more than once.`,
        });
      }
      seen.add(e.name);
    }
  }

  for (const p of team.players) {
    const pts = listPoints(p.list);
    if (pts > pointsLimit)
      issues.push({
        rule: 'points',
        message: `${p.name}'s list is ${pts} pts (limit ${pointsLimit}).`,
      });
  }
  return issues;
}
