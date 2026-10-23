import { solveMatrixGame } from './matrixGame';

describe('matrix game solver', () => {
  it('finds pure saddle points', () => {
    const s = solveMatrixGame([
      [3, 1],
      [4, 2],
    ]);
    expect(s.value).toBe(2);
    expect(s.row).toEqual([0, 1]);
    expect(s.col).toEqual([0, 1]);
  });

  it('solves matching pennies as 50/50 with value 0', () => {
    const s = solveMatrixGame([
      [1, -1],
      [-1, 1],
    ]);
    expect(s.value).toBeCloseTo(0, 2);
    expect(s.row[0]).toBeCloseTo(0.5, 2);
    expect(s.col[0]).toBeCloseTo(0.5, 2);
  });

  it('solves rock-paper-scissors', () => {
    const s = solveMatrixGame([
      [0, -1, 1],
      [1, 0, -1],
      [-1, 1, 0],
    ]);
    expect(s.value).toBeCloseTo(0, 2);
    s.row.forEach((p) => expect(p).toBeCloseTo(1 / 3, 1));
  });

  it('solves an asymmetric 2x2 mixed game', () => {
    // Value = (ad - bc) / (a + d - b - c) = (2*3 - 0*1)/(2+3-0-1) = 1.5, p = (d-c)/(a+d-b-c) = 0.5
    const s = solveMatrixGame([
      [2, 0],
      [1, 3],
    ]);
    expect(s.value).toBeCloseTo(1.5, 2);
    expect(s.row[0]).toBeCloseTo(0.5, 1);
  });

  it('handles single rows and columns', () => {
    expect(solveMatrixGame([[1, 5, -2]]).value).toBe(-2);
    expect(solveMatrixGame([[1], [5], [-2]]).value).toBe(5);
  });
});
