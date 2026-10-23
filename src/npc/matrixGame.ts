// Mixed-strategy equilibrium of a small zero-sum matrix game.
// The row player maximises, the column player minimises.

export interface MatrixSolution {
  value: number;
  row: number[];
  col: number[];
}

function pureSaddle(m: number[][]): MatrixSolution | null {
  const rows = m.length;
  const cols = m[0]!.length;
  const rowMin = m.map((r) => Math.min(...r));
  const colMax = Array.from({ length: cols }, (_, j) => Math.max(...m.map((r) => r[j]!)));
  const maximin = Math.max(...rowMin);
  const minimax = Math.min(...colMax);
  if (Math.abs(maximin - minimax) > 1e-9) return null;
  const i = rowMin.indexOf(maximin);
  const j = colMax.indexOf(minimax);
  const onehot = (n: number, k: number) => Array.from({ length: n }, (_, x) => (x === k ? 1 : 0));
  return { value: maximin, row: onehot(rows, i), col: onehot(cols, j) };
}

/**
 * Regret matching+ with alternating updates and linearly weighted averaging.
 * Converges quickly for the ≤6×6 games pairing produces.
 */
function regretMatching(m: number[][], iterations: number): MatrixSolution {
  const rows = m.length;
  const cols = m[0]!.length;
  const rRegret = new Array<number>(rows).fill(0);
  const cRegret = new Array<number>(cols).fill(0);
  const rSum = new Array<number>(rows).fill(0);
  const cSum = new Array<number>(cols).fill(0);
  const strategy = (regret: number[]) => {
    const total = regret.reduce((a, b) => a + b, 0);
    return total > 0 ? regret.map((r) => r / total) : regret.map(() => 1 / regret.length);
  };
  for (let t = 1; t <= iterations; t++) {
    const c = strategy(cRegret);
    const rowVals = m.map((r) => r.reduce((s, v, j) => s + v * c[j]!, 0));
    const r = strategy(rRegret);
    const rv = rowVals.reduce((s, v, i) => s + v * r[i]!, 0);
    for (let i = 0; i < rows; i++) rRegret[i] = Math.max(0, rRegret[i]! + rowVals[i]! - rv);
    const r2 = strategy(rRegret);
    const colVals = Array.from({ length: cols }, (_, j) =>
      m.reduce((s, row, i) => s + row[j]! * r2[i]!, 0),
    );
    const cv = colVals.reduce((s, v, j) => s + v * c[j]!, 0);
    for (let j = 0; j < cols; j++) cRegret[j] = Math.max(0, cRegret[j]! + cv - colVals[j]!);
    for (let i = 0; i < rows; i++) rSum[i]! += t * r2[i]!;
    for (let j = 0; j < cols; j++) cSum[j]! += t * c[j]!;
  }
  const norm = (xs: number[]) => {
    const total = xs.reduce((a, b) => a + b, 0);
    return xs.map((x) => x / total);
  };
  const row = norm(rSum);
  const col = norm(cSum);
  const value = m.reduce((s, r, i) => s + r.reduce((t, v, j) => t + v * row[i]! * col[j]!, 0), 0);
  return { value, row, col };
}

export function solveMatrixGame(m: number[][], iterations = 1500): MatrixSolution {
  if (!m.length || !m[0]!.length) throw new Error('empty matrix');
  if (m.length === 1 || m[0]!.length === 1) {
    const flat = m.length === 1 ? m[0]! : m.map((r) => r[0]!);
    const best = m.length === 1 ? Math.min(...flat) : Math.max(...flat);
    const k = flat.indexOf(best);
    const onehot = (n: number) => Array.from({ length: n }, (_, x) => (x === k ? 1 : 0));
    return m.length === 1
      ? { value: best, row: [1], col: onehot(flat.length) }
      : { value: best, row: onehot(flat.length), col: [1] };
  }
  return pureSaddle(m) ?? regretMatching(m, iterations);
}
