// The NPC captain: builds its view of every matchup, solves the pairing game,
// picks moves according to difficulty, and explains them.
import type { ListProfile } from '../data/listAnalysis';
import type { Move, Pairing, PairingProtocol, StepSpec } from '../pairing/types';
import type { BattleplanTraits } from '../packs/traits';
import {
  estimateMatchup,
  type MatchupEstimate,
  type MatchupWeights,
  DEFAULT_WEIGHTS,
} from './matchup';
import { createSolver, type PairingSolver } from './solver';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface CaptainSetup {
  /** NPC team profiles (side B) and user team profiles (side A). */
  npc: ListProfile[];
  user: ListProfile[];
  npcNames: string[];
  userNames: string[];
  /** Traits for each battleplan slot, e.g. { A: ..., B: ..., C: ... }. */
  slots: Record<string, BattleplanTraits>;
  slotNames: Record<string, string>;
  difficulty: Difficulty;
  weights?: MatchupWeights;
}

/** estimates[slot][b][a]: NPC player b vs user player a, from the NPC's view. */
export type MatchupTable = Record<string, MatchupEstimate[][]>;

export function buildMatchupTable(setup: CaptainSetup): MatchupTable {
  const table: MatchupTable = {};
  for (const [slot, traits] of Object.entries(setup.slots)) {
    table[slot] = setup.npc.map((b) =>
      setup.user.map((a) => estimateMatchup(b, a, traits, setup.weights ?? DEFAULT_WEIGHTS)),
    );
  }
  return table;
}

export interface CaptainDecision {
  move: Move;
  /** Shown to the player only after the simultaneous reveal. */
  reasoning: string;
}

const fmt = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;

function sample(probs: number[], rng: () => number): number {
  let r = rng();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i]!;
    if (r <= 0) return i;
  }
  return probs.length - 1;
}

function softmax(values: number[], temperature: number): number[] {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp((v - max) / temperature));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

export class NpcCaptain<S> {
  readonly table: MatchupTable;
  private solver: PairingSolver<S>;

  constructor(
    private protocol: PairingProtocol<S>,
    private setup: CaptainSetup,
    private rng: () => number = Math.random,
  ) {
    this.table = buildMatchupTable(setup);
    // Solver values are from side A (the user); the NPC is side B and minimises.
    this.solver = createSolver(protocol, (p) => -this.edge(p));
  }

  /** NPC's estimated edge for a pairing. */
  edge(p: Pairing): number {
    return this.table[p.slot]![p.b]![p.a]!.score;
  }

  /** NPC's expected total edge for the rest of the game under equilibrium play. */
  expectedEdge(s: S): number {
    return -this.solver.valueToGo(s);
  }

  decide(s: S): CaptainDecision {
    const game = this.solver.nodeGame(s);
    const { movesB, matrix, solution } = game;
    // Value of each NPC move against the user's equilibrium mix (NPC wants it low).
    const vsUser = movesB.map((_, j) =>
      matrix.reduce((sum, row, i) => sum + row[j]! * solution.row[i]!, 0),
    );
    let probs: number[];
    switch (this.setup.difficulty) {
      case 'hard':
        probs = solution.col;
        break;
      case 'normal':
        probs = softmax(
          vsUser.map((v) => -v),
          1.5,
        ).map((p, j) => 0.6 * solution.col[j]! + 0.4 * p);
        break;
      default: {
        // Easy: judges moves against a user who picks at random, and is noisy.
        const naive = movesB.map(
          (_, j) => matrix.reduce((sum, row) => sum + row[j]!, 0) / matrix.length,
        );
        probs = softmax(
          naive.map((v) => -v),
          4,
        );
      }
    }
    const j = sample(probs, this.rng);
    const move = movesB[j]!;
    return { move, reasoning: this.explain(s, move, -vsUser[j]!) };
  }

  private explain(s: S, move: Move, expected: number): string {
    const step: StepSpec = this.protocol.currentStep(s);
    const names = this.setup.npcNames;
    const users = this.setup.userNames;
    const bp = this.setup.slotNames[step.slot] ?? step.slot;
    const row = (b: number) => this.table[step.slot]![b]!;
    const outlook = `I expect ${fmt(expected)} from here.`;
    if (step.kind === 'guardian') {
      const b = move[0]!;
      const scores = row(b).map((m) => m.score);
      const good = scores.filter((x) => x > 1).length;
      const worst = scores.indexOf(Math.min(...scores));
      return `Guarding with ${names[b]} on ${bp}: favourable into ${good} of your 5, and its worst matchup (${users[worst]}, ${fmt(scores[worst]!)}) is one I can refuse. ${outlook}`;
    }
    if (step.kind === 'invaders') {
      const parts = move.map((b) => {
        const scores = row(b).map((m) => m.score);
        const best = scores.indexOf(Math.max(...scores));
        return `${names[b]} (best into ${users[best]}, ${fmt(scores[best]!)})`;
      });
      return `Sending ${parts.join(' and ')} as Invaders: whichever you take, the other comes back to me. ${outlook}`;
    }
    if (step.kind === 'choose') {
      const a = move[0]!;
      const guardian = this.protocol.guardian?.(s, 'B');
      if (guardian !== undefined) {
        const est = row(guardian)[a]!;
        const key = [...est.factors].sort((x, y) => Math.abs(y.value) - Math.abs(x.value))[0]!;
        return `${names[guardian]} takes ${users[a]} on ${bp} (${fmt(est.score)}), mostly on ${key.label.toLowerCase()}. ${outlook}`;
      }
    }
    return outlook;
  }
}
