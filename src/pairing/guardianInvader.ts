// OTTD Teams 2026 pairing: two guardian/invader stages, then the leftover game.
//
// Stage 1 (slot A): guardians → two invaders each → each captain picks one enemy
//   invader for their guardian; the rejected invader returns to its owner's hand.
// Stage 2 (slot B): same again from three cards (the two invaders are forced).
// The two invaders rejected in stage 2 play each other on slot C.
import {
  other,
  type Move,
  type Pairing,
  type PairingProtocol,
  type Side,
  type StepSpec,
} from './types';

export interface GIState {
  stage: 1 | 2;
  step: 'guardian' | 'invaders' | 'choose' | 'done';
  hand: Record<Side, number[]>;
  guardian: Partial<Record<Side, number>>;
  invaders: Partial<Record<Side, number[]>>;
  pairings: Pairing[];
}

const SLOTS = ['A', 'B', 'C'] as const;

function combinations(pool: number[], k: number): number[][] {
  if (k === 0) return [[]];
  const out: number[][] = [];
  pool.forEach((x, i) => {
    for (const rest of combinations(pool.slice(i + 1), k - 1)) out.push([x, ...rest]);
  });
  return out;
}

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const without = (xs: number[], remove: number[]) => xs.filter((x) => !remove.includes(x));
const sameMove = (a: Move, b: Move) =>
  a.length === b.length && sorted(a).every((x, i) => x === sorted(b)[i]);

export const guardianInvader: PairingProtocol<GIState> = {
  id: 'guardian-invader-v1',

  initial(teamSize) {
    if (teamSize !== 5) throw new Error('guardian-invader-v1 requires teams of 5');
    const all = [0, 1, 2, 3, 4];
    return {
      stage: 1,
      step: 'guardian',
      hand: { A: [...all], B: [...all] },
      guardian: {},
      invaders: {},
      pairings: [],
    };
  },

  currentStep(s): StepSpec {
    const slot = SLOTS[s.stage - 1]!;
    switch (s.step) {
      case 'guardian':
        return { kind: 'guardian', slot, simultaneous: true, count: 1 };
      case 'invaders':
        return { kind: 'invaders', slot, simultaneous: true, count: 2 };
      case 'choose':
        return { kind: 'choose', slot, simultaneous: true, count: 1 };
      default:
        return { kind: 'done', slot: 'C', simultaneous: true, count: 0 };
    }
  },

  legalMoves(s, side) {
    switch (s.step) {
      case 'guardian':
        return s.hand[side].map((i) => [i]);
      case 'invaders':
        return combinations(sorted(s.hand[side]), 2);
      case 'choose':
        return sorted(s.invaders[other(side)] ?? []).map((i) => [i]);
      default:
        return [];
    }
  },

  apply(s, moves) {
    for (const side of ['A', 'B'] as const) {
      if (!this.legalMoves(s, side).some((m) => sameMove(m, moves[side]))) {
        throw new Error(`illegal ${s.step} move for ${side}: [${moves[side].join(',')}]`);
      }
    }
    const next: GIState = {
      ...s,
      hand: { A: [...s.hand.A], B: [...s.hand.B] },
      guardian: { ...s.guardian },
      invaders: { ...s.invaders },
      pairings: [...s.pairings],
    };
    if (s.step === 'guardian') {
      for (const side of ['A', 'B'] as const) {
        next.guardian[side] = moves[side][0]!;
        next.hand[side] = without(next.hand[side], moves[side]);
      }
      next.step = 'invaders';
    } else if (s.step === 'invaders') {
      for (const side of ['A', 'B'] as const) {
        next.invaders[side] = sorted(moves[side]);
        next.hand[side] = without(next.hand[side], moves[side]);
      }
      next.step = 'choose';
    } else if (s.step === 'choose') {
      const slot = SLOTS[s.stage - 1]!;
      const chosenB = moves.A[0]!; // A picks which B invader faces A's guardian
      const chosenA = moves.B[0]!;
      next.pairings.push({ a: s.guardian.A!, b: chosenB, slot, guardian: 'A' });
      next.pairings.push({ a: chosenA, b: s.guardian.B!, slot, guardian: 'B' });
      const rejectedA = s.invaders.A!.find((i) => i !== chosenA)!;
      const rejectedB = s.invaders.B!.find((i) => i !== chosenB)!;
      next.guardian = {};
      next.invaders = {};
      if (s.stage === 1) {
        next.hand.A = sorted([...next.hand.A, rejectedA]);
        next.hand.B = sorted([...next.hand.B, rejectedB]);
        next.stage = 2;
        next.step = 'guardian';
      } else {
        next.pairings.push({ a: rejectedA, b: rejectedB, slot: 'C', guardian: null });
        next.step = 'done';
      }
    }
    return next;
  },

  isTerminal: (s) => s.step === 'done',

  pairings: (s) => s.pairings,

  key(s) {
    const g = (side: Side) => s.guardian[side] ?? '-';
    const inv = (side: Side) => (s.invaders[side] ?? []).join('');
    return `${s.stage}${s.step[0]}|${s.hand.A.join('')}/${s.hand.B.join('')}|${g('A')}${g('B')}|${inv('A')}/${inv('B')}`;
  },
};
