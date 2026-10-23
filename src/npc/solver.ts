// Backward induction over a pairing protocol's simultaneous-move game tree.
// Values are from side A's point of view (A maximises, B minimises).
import type { Move, Pairing, PairingProtocol } from '../pairing/types';
import { solveMatrixGame, type MatrixSolution } from './matrixGame';

export interface NodeGame {
  movesA: Move[];
  movesB: Move[];
  /** matrix[i][j] = immediate reward + value-to-go after A plays movesA[i], B plays movesB[j]. */
  matrix: number[][];
  solution: MatrixSolution;
}

export interface PairingSolver<S> {
  /** Equilibrium value of the remaining game, excluding pairings already locked. */
  valueToGo(s: S): number;
  nodeGame(s: S): NodeGame;
}

export function createSolver<S>(
  protocol: PairingProtocol<S>,
  payoff: (p: Pairing) => number,
): PairingSolver<S> {
  const memo = new Map<string, number>();

  const reward = (before: S, after: S) =>
    protocol
      .pairings(after)
      .slice(protocol.pairings(before).length)
      .reduce((sum, p) => sum + payoff(p), 0);

  function nodeGame(s: S): NodeGame {
    const movesA = protocol.legalMoves(s, 'A');
    const movesB = protocol.legalMoves(s, 'B');
    const matrix = movesA.map((A) =>
      movesB.map((B) => {
        const next = protocol.apply(s, { A, B });
        return reward(s, next) + valueToGo(next);
      }),
    );
    return { movesA, movesB, matrix, solution: solveMatrixGame(matrix) };
  }

  function valueToGo(s: S): number {
    if (protocol.isTerminal(s)) return 0;
    const key = protocol.key(s);
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const v = nodeGame(s).solution.value;
    memo.set(key, v);
    return v;
  }

  return { valueToGo, nodeGame };
}
