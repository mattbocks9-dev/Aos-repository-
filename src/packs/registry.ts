import { ottd2026 } from './ottd2026/pack';
import type { TournamentPack } from './types';

export const PACKS: TournamentPack[] = [ottd2026];

export function getPack(id: string): TournamentPack {
  const pack = PACKS.find((p) => p.id === id);
  if (!pack) throw new Error(`unknown pack ${id}`);
  return pack;
}
