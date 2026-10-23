export const edgeClass = (v: number) =>
  v > 1 ? 'text-[var(--good)]' : v < -1 ? 'text-[var(--bad)]' : 'muted';
export const fmtEdge = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
