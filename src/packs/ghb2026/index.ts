// General's Handbook 2026-27 battlepack: battleplans (maps + rules) and battle tactics,
// extracted from Wahapedia by scripts/ghb/build_ghb.py into ghb.json. Battleplans are
// filed by their name's slug ("Into the Fire" -> "into-the-fire").
import type { AbilityData } from '../../data/types';
import type {
  Battleplan,
  BattleTacticsCard,
  ObjectiveKind,
  TerrainLocation,
  Territory,
} from '../types';
import raw from './ghb.json';

interface RawBattleplan {
  id: string;
  name: string;
  number: number;
  table: number;
  imageUrl: string | null;
  sourceUrl: string;
  twist: string;
  abilities: AbilityData[];
  scoring: string[];
  notes: string[];
  board: { width: number; height: number };
  deployment: { attacker: Territory; defender: Territory };
  objectives: { id: string; kind: string; x: number; y: number }[];
  terrain: { kind: string; size: string; x: number; y: number }[];
}

const data = raw as unknown as {
  source: { name: string; url: string };
  battleplans: RawBattleplan[];
  battleTactics: BattleTacticsCard[];
};

export const GHB_SOURCE = data.source;

export const GHB_BATTLEPLANS: Record<string, Battleplan> = Object.fromEntries(
  data.battleplans.map((b) => [
    b.id,
    {
      id: b.id,
      name: b.name,
      number: b.number,
      verified: true,
      board: b.board,
      deployment: b.deployment,
      objectives: b.objectives.map((o) => ({ ...o, kind: o.kind as ObjectiveKind })),
      terrain: b.terrain as TerrainLocation[],
      twist: b.twist,
      abilities: b.abilities,
      scoring: b.scoring,
      notes: b.notes,
      imageUrl: b.imageUrl ?? undefined,
      sourceUrl: b.sourceUrl,
    } satisfies Battleplan,
  ]),
);

export const GHB_BATTLE_TACTICS: BattleTacticsCard[] = data.battleTactics;

export const battleplanSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Look a battleplan up by its name as printed in a tournament pack. */
export function battleplanByName(name: string): Battleplan | undefined {
  return GHB_BATTLEPLANS[battleplanSlug(name)];
}
