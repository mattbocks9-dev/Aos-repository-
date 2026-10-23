import type { TournamentPack } from '../types';
import { GHB_BATTLE_TACTICS, GHB_BATTLEPLANS, GHB_SOURCE } from '../ghb2026';

export const ottd2026: TournamentPack = {
  id: 'ottd-2026',
  name: 'Old Town Throwdown Teams 2026',
  teamSize: 5,
  pointsLimit: 2000,
  protocol: 'guardian-invader-v1',
  slots: ['A', 'B', 'C'],
  // OTTD uses the General's Handbook 2026-27 battleplans and battle tactics.
  battleplans: GHB_BATTLEPLANS,
  battleTactics: GHB_BATTLE_TACTICS,
  rulesSource: GHB_SOURCE,
  rounds: [
    {
      round: 1,
      battleplans: { A: 'into-the-fire', B: 'bloodstained-coasts', C: 'avalanche-of-ash' },
    },
    {
      round: 2,
      battleplans: {
        A: 'caverns-of-slaughter',
        B: 'whats-yours-is-ours',
        C: 'escape-from-the-coast',
      },
    },
    {
      round: 3,
      battleplans: { A: 'warped-ruins', B: 'treacherous-ground', C: 'curse-of-the-gnaw' },
    },
    {
      round: 4,
      battleplans: { A: 'escape-from-the-coast', B: 'power-of-the-realms', C: 'seize-the-embers' },
    },
    {
      round: 5,
      battleplans: { A: 'whats-yours-is-ours', B: 'bloodstained-coasts', C: 'treacherous-ground' },
    },
  ],
  teamRules: [
    {
      id: 'unique-faction',
      description:
        'Each team member must choose a different faction (Armies of Renown count as their base faction).',
    },
    {
      id: 'no-shared-warscrolls',
      description: 'Teams cannot share warscrolls across team members.',
    },
    {
      id: 'unique-manifestation-lore',
      description: 'Team members cannot duplicate Manifestation Lores.',
    },
    { id: 'points', description: 'Each army is 2,000 points.' },
  ],
  pairingSummary: [
    'Both captains secretly place one faction face down as their Guardian, then reveal.',
    'Both captains secretly place two factions as Invaders; they are revealed and handed to the opposing captain.',
    'Each captain secretly picks one enemy Invader to face their Guardian. Those two games play on Battleplan A; the other Invaders return to hand.',
    'Repeat with the remaining three factions for Battleplan B.',
    'The two Invaders left over from the second step play each other on Battleplan C.',
  ],
};
