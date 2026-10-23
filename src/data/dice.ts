/** Average of a dice expression like "D6", "2D3+1", "3". */
export function diceAverage(expr: string | undefined): number {
  if (!expr) return 0;
  let total = 0;
  for (const term of expr.replace(/\s/g, '').toUpperCase().split('+')) {
    const m = /^(\d*)D(\d+)$/.exec(term);
    if (m) total += (Number(m[1] || 1) * (Number(m[2]) + 1)) / 2;
    else total += Number(/\d+(\.\d+)?/.exec(term)?.[0] ?? 0);
  }
  return total;
}
