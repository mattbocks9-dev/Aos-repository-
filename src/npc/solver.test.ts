import { guardianInvader as P } from '../pairing/guardianInvader';
import { createSolver } from './solver';

describe('pairing tree solver', () => {
  it('values a game of all-equal matchups at zero', () => {
    const solver = createSolver(P, () => 0);
    expect(solver.valueToGo(P.initial(5))).toBe(0);
  });

  it('values a constant per-game edge at five games', () => {
    const solver = createSolver(P, () => 2);
    expect(solver.valueToGo(P.initial(5))).toBeCloseTo(10);
  });

  it('is symmetric: mirrored teams are worth about zero', () => {
    // A[i] vs B[j] edge = s[i] - s[j]: player strength only, so pairing can't help either side.
    const strength = [5, 3, 0, -2, -6];
    const solver = createSolver(P, (p) => strength[p.a]! - strength[p.b]!);
    expect(solver.valueToGo(P.initial(5))).toBeCloseTo(0, 1);
  });

  it('lets the other captain dodge a single bad matchup', () => {
    // B can guard with B0 and never pick A0, so the A0-B0 game never happens.
    const solver = createSolver(P, (p) => (p.a === 0 && p.b === 0 ? 10 : 0));
    expect(solver.valueToGo(P.initial(5))).toBeCloseTo(0);
  });

  it('forces a favourable matchup the opponent cannot cover', () => {
    // A0 beats B0..B3; only B4 can absorb it, so A should bank at least one win.
    const solver = createSolver(P, (p) => (p.a === 0 && p.b < 4 ? 10 : 0));
    const v = solver.valueToGo(P.initial(5));
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThanOrEqual(10);
  });

  it('solves the full tree quickly', () => {
    const grid = Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 5 }, (_, j) => Math.sin(i * 3 + j * 7) * 5),
    );
    const t0 = performance.now();
    const solver = createSolver(P, (p) => grid[p.a]![p.b]! + (p.slot === 'C' ? 1 : 0));
    const game = solver.nodeGame(P.initial(5));
    expect(game.matrix).toHaveLength(5);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(game.solution.row.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});
