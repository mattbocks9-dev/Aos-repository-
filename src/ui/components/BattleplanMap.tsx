import type { Battleplan } from '../../packs/types';

/** Top-down battleplan diagram: deployment zones, objectives and their 3" control range. */
export function BattleplanMap({ plan, compact = false }: { plan: Battleplan; compact?: boolean }) {
  const { width, height } = plan.board;
  const centroid = (poly: { x: number; y: number }[]) => ({
    x: poly.reduce((a, p) => a + p.x, 0) / poly.length,
    y: poly.reduce((a, p) => a + p.y, 0) / poly.length,
  });
  const atk = centroid(plan.deployment.attacker);
  const def = centroid(plan.deployment.defender);
  const pts = (poly: { x: number; y: number }[]) => poly.map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <figure className="relative">
      <svg
        viewBox={`-1 -1 ${width + 2} ${height + 2}`}
        className="w-full rounded-md"
        role="img"
        aria-label={`${plan.name} map`}
      >
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="#2b2a22"
          stroke="#5a5040"
          strokeWidth="0.3"
        />
        <line
          x1={width / 2}
          y1="0"
          x2={width / 2}
          y2={height}
          stroke="#5a5040"
          strokeWidth="0.15"
          strokeDasharray="1 1"
        />
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#5a5040"
          strokeWidth="0.15"
          strokeDasharray="1 1"
        />
        <polygon
          points={pts(plan.deployment.attacker)}
          fill="var(--them)"
          fillOpacity="0.28"
          stroke="var(--them)"
          strokeWidth="0.3"
        />
        <polygon
          points={pts(plan.deployment.defender)}
          fill="var(--you)"
          fillOpacity="0.28"
          stroke="var(--you)"
          strokeWidth="0.3"
        />
        {plan.objectives.map((o) => (
          <g key={o.id}>
            <circle
              cx={o.x}
              cy={o.y}
              r="3"
              fill="none"
              stroke="var(--gold)"
              strokeOpacity="0.5"
              strokeWidth="0.25"
              strokeDasharray="0.6 0.4"
            />
            <circle cx={o.x} cy={o.y} r="1.2" fill={o.special ? '#9b6be0' : 'var(--gold)'} />
          </g>
        ))}
        {!compact && (
          <>
            <text x={atk.x} y={atk.y + 0.8} textAnchor="middle" fontSize="2.4" fill="var(--them)">
              Attacker
            </text>
            <text x={def.x} y={def.y + 0.8} textAnchor="middle" fontSize="2.4" fill="var(--you)">
              Defender
            </text>
          </>
        )}
      </svg>
      {!plan.verified && !compact && (
        <figcaption className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-amber-300">
          Placeholder layout
        </figcaption>
      )}
    </figure>
  );
}
