import { guardianInvader as P, type GIState } from './guardianInvader';
import type { Move } from './types';

const play = (s: GIState, A: Move, B: Move) => P.apply(s, { A, B });

describe('OTTD guardian/invader protocol', () => {
  const start = P.initial(5);

  it('starts with both sides choosing a guardian from five', () => {
    expect(P.currentStep(start)).toMatchObject({ kind: 'guardian', slot: 'A', simultaneous: true });
    expect(P.legalMoves(start, 'A')).toEqual([[0], [1], [2], [3], [4]]);
  });

  it('offers every pair of the remaining four as invaders', () => {
    const s = play(start, [0], [4]);
    expect(P.currentStep(s).kind).toBe('invaders');
    const moves = P.legalMoves(s, 'A');
    expect(moves).toHaveLength(6);
    expect(moves.flat()).not.toContain(0);
  });

  it('lets each captain choose one of the opposing invaders', () => {
    let s = play(start, [0], [4]);
    s = play(s, [1, 2], [0, 1]);
    expect(P.currentStep(s).kind).toBe('choose');
    // A chooses among B's invaders, B among A's
    expect(P.legalMoves(s, 'A')).toEqual([[0], [1]]);
    expect(P.legalMoves(s, 'B')).toEqual([[1], [2]]);
  });

  it('runs the full game: 2 on A, 2 on B, 1 on C, everyone once', () => {
    let s = start;
    s = play(s, [0], [4]); // guardians
    s = play(s, [1, 2], [0, 1]); // invaders
    s = play(s, [1], [2]); // A takes B1 vs A0; B takes A2 vs B4; A1 and B0 return
    expect(s.pairings).toEqual([
      { a: 0, b: 1, slot: 'A', guardian: 'A' },
      { a: 2, b: 4, slot: 'A', guardian: 'B' },
    ]);
    expect(s.hand.A.sort()).toEqual([1, 3, 4]);
    expect(s.hand.B.sort()).toEqual([0, 2, 3]);

    s = play(s, [3], [3]); // stage-2 guardians
    expect(P.currentStep(s).kind).toBe('invaders');
    expect(P.legalMoves(s, 'A')).toEqual([[1, 4]]); // forced
    s = play(s, [1, 4], [0, 2]);
    s = play(s, [2], [4]); // A3 vs B2, B3 vs A4; rejected A1 & B0 play on C
    expect(P.isTerminal(s)).toBe(true);
    const pairs = P.pairings(s);
    expect(pairs.map((p) => p.slot)).toEqual(['A', 'A', 'B', 'B', 'C']);
    expect(pairs[4]).toEqual({ a: 1, b: 0, slot: 'C', guardian: null });
    expect(new Set(pairs.map((p) => p.a)).size).toBe(5);
    expect(new Set(pairs.map((p) => p.b)).size).toBe(5);
  });

  it('rejects illegal moves', () => {
    const s = play(start, [0], [4]);
    expect(() => play(s, [0, 1], [0, 1])).toThrow();
    expect(() => play(start, [7], [0])).toThrow();
  });

  it('keys states by what remains, ignoring locked pairings order', () => {
    const s = play(start, [0], [4]);
    expect(P.key(s)).toBe(P.key(play(start, [0], [4])));
    expect(P.key(s)).not.toBe(P.key(play(start, [1], [4])));
  });
});
