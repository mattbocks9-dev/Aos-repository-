import type { ListProfile } from '../data/listAnalysis';
import { guardianInvader as P } from '../pairing/guardianInvader';
import type { BattleplanTraits } from '../packs/traits';
import { NpcCaptain, type CaptainSetup } from './captain';

const profile = (p: Partial<ListProfile>): ListProfile => ({
  points: 2000,
  units: 10,
  models: 40,
  heroes: 3,
  monsters: 0,
  meleeVsElite: 20,
  meleeVsHorde: 30,
  rangedVsElite: 5,
  rangedVsHorde: 8,
  effectiveWounds: 200,
  control: 40,
  mobility: 6,
  magic: 2,
  avgSave: 4,
  avgHealth: 2,
  archetype: 'Melee',
  ...p,
});
const traits: BattleplanTraits = {
  mobility: 0.5,
  objectiveSpread: 0.5,
  controlPressure: 0.6,
  shootingLanes: 0.5,
  centreFocus: 0.3,
  attackerEdge: 0,
};

const setup = (difficulty: CaptainSetup['difficulty']): CaptainSetup => ({
  npc: [
    profile({ mobility: 10 }),
    profile({ rangedVsElite: 30 }),
    profile({}),
    profile({ effectiveWounds: 400 }),
    profile({ control: 80 }),
  ],
  user: [
    profile({}),
    profile({ meleeVsElite: 40 }),
    profile({ models: 90, control: 90 }),
    profile({ magic: 6 }),
    profile({ mobility: 3 }),
  ],
  npcNames: ['N0', 'N1', 'N2', 'N3', 'N4'],
  userNames: ['U0', 'U1', 'U2', 'U3', 'U4'],
  slots: { A: traits, B: { ...traits, shootingLanes: 1 }, C: { ...traits, objectiveSpread: 1 } },
  slotNames: { A: 'Into the Fire', B: 'Bloodstained Coasts', C: 'Avalanche of Ash' },
  difficulty,
});

let seed = 1;
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

describe('NPC captain', () => {
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    it(`plays a full legal game on ${difficulty}`, () => {
      const captain = new NpcCaptain(P, setup(difficulty), rng);
      let s = P.initial(5);
      while (!P.isTerminal(s)) {
        const npc = captain.decide(s);
        expect(npc.reasoning.length).toBeGreaterThan(10);
        const user = P.legalMoves(s, 'A')[0]!;
        s = P.apply(s, { A: user, B: npc.move });
      }
      expect(P.pairings(s)).toHaveLength(5);
    });
  }

  it('reports its expected edge from the start', () => {
    const captain = new NpcCaptain(P, setup('hard'), rng);
    expect(Number.isFinite(captain.expectedEdge(P.initial(5)))).toBe(true);
  });

  it('builds a full 3x5x5 matchup table', () => {
    const captain = new NpcCaptain(P, setup('hard'), rng);
    expect(Object.keys(captain.table)).toEqual(['A', 'B', 'C']);
    expect(captain.table.A!.flat()).toHaveLength(25);
  });
});
