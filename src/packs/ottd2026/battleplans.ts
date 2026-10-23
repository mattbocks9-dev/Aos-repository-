// Battleplans used by OTTD Teams 2026.
//
// IMPORTANT: the geometry and scoring here are placeholders built from three generic
// AoS 4 layouts and flagged `verified: false`. They will be replaced with data
// extracted from the General's Handbook once it is supplied.
import type { Battleplan, Objective, Point } from '../types';

const BOARD = { width: 60, height: 44 };

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

type Layout = Pick<Battleplan, 'deployment' | 'objectives'>;

/** Long-edge deployment, 6 objectives in two staggered lines. */
const lines: Layout = {
  deployment: { attacker: rect(0, 0, 60, 10), defender: rect(0, 34, 60, 44) },
  objectives: [
    { id: 'o1', x: 12, y: 14 },
    { id: 'o2', x: 30, y: 16 },
    { id: 'o3', x: 48, y: 14 },
    { id: 'o4', x: 12, y: 30 },
    { id: 'o5', x: 30, y: 28 },
    { id: 'o6', x: 48, y: 30 },
  ],
};

/** Short-edge deployment, objectives strung down the centre line. */
const corridor: Layout = {
  deployment: { attacker: rect(0, 0, 14, 44), defender: rect(46, 0, 60, 44) },
  objectives: [
    { id: 'o1', x: 22, y: 10 },
    { id: 'o2', x: 22, y: 34 },
    { id: 'o3', x: 30, y: 22 },
    { id: 'o4', x: 38, y: 10 },
    { id: 'o5', x: 38, y: 34 },
  ],
};

/** Diagonal corner deployment with a contested centre. */
const diagonal: Layout = {
  deployment: {
    attacker: [
      { x: 0, y: 0 },
      { x: 26, y: 0 },
      { x: 0, y: 20 },
    ],
    defender: [
      { x: 60, y: 44 },
      { x: 34, y: 44 },
      { x: 60, y: 24 },
    ],
  },
  objectives: [
    { id: 'o1', x: 30, y: 22 },
    { id: 'o2', x: 14, y: 30 },
    { id: 'o3', x: 46, y: 14 },
    { id: 'o4', x: 8, y: 38 },
    { id: 'o5', x: 52, y: 6 },
  ],
};

const STANDARD_SCORING = [
  'Score VP at the end of each turn for objectives you control.',
  'Score VP for completing battle tactics.',
];

function plan(
  id: string,
  name: string,
  layout: Layout,
  extra: Partial<Battleplan> = {},
): Battleplan {
  const objectives: Objective[] = layout.objectives.map((o) => ({ ...o }));
  return {
    id,
    name,
    verified: false,
    board: BOARD,
    deployment: layout.deployment,
    objectives,
    scoring: STANDARD_SCORING,
    ...extra,
  };
}

export const OTTD_BATTLEPLANS: Record<string, Battleplan> = Object.fromEntries(
  [
    plan('into-the-fire', 'Into the Fire', lines),
    plan('bloodstained-coasts', 'Bloodstained Coasts', corridor),
    plan('avalanche-of-ash', 'Avalanche of Ash', diagonal),
    plan('caverns-of-slaughter', 'Caverns of Slaughter', corridor),
    plan('whats-yours-is-ours', "What's Yours is Ours", lines),
    plan('escape-from-the-coast', 'Escape from the Coast', diagonal),
    plan('warped-ruins', 'Warped Ruins', lines),
    plan('treacherous-ground', 'Treacherous Ground', diagonal),
    plan('curse-of-the-gnaw', 'Curse of the Gnaw', corridor),
    plan('power-of-the-realms', 'Power of the Realms', lines),
    plan('seize-the-embers', 'Seize the Embers', diagonal),
  ].map((bp) => [bp.id, bp]),
);
