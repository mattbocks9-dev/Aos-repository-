import { useState } from 'react';
import type { Battleplan, ObjectiveKind, Territory } from '../../packs/types';

const OBJECTIVE_FILL: Record<ObjectiveKind, string> = {
  'Sun Seekers': '#d9a62b',
  'Golden Lions': '#c8281e',
  Heldenhain: '#1a1a1a',
  'Scions of the Comet': '#1f5fd1',
};

const TERRAIN_FILL = { area: '#a08c6a', obscuring: '#4f7a3a', placeOfPower: '#7aa6c8' } as const;
const TERRAIN_LABEL = {
  area: 'Area terrain or obstacle',
  obscuring: 'Obscuring terrain',
  placeOfPower: 'Place of Power',
} as const;

function centroid(t: Territory) {
  // Largest rectangle's centre keeps the label inside the territory.
  const area = (poly: { x: number; y: number }[]) =>
    (Math.max(...poly.map((p) => p.x)) - Math.min(...poly.map((p) => p.x))) *
    (Math.max(...poly.map((p) => p.y)) - Math.min(...poly.map((p) => p.y)));
  const big = [...t].sort((a, b) => area(b) - area(a))[0] ?? [];
  return {
    x: big.reduce((a, p) => a + p.x, 0) / Math.max(big.length, 1),
    y: big.reduce((a, p) => a + p.y, 0) / Math.max(big.length, 1),
  };
}

/** The battleplan drawn from its extracted geometry: territories, objectives and terrain. */
export function DrawnMap({ plan, compact = false }: { plan: Battleplan; compact?: boolean }) {
  const { width, height } = plan.board;
  const pts = (poly: { x: number; y: number }[]) => poly.map((p) => `${p.x},${p.y}`).join(' ');
  const atk = centroid(plan.deployment.attacker);
  const def = centroid(plan.deployment.defender);
  return (
    <svg
      viewBox={`-0.5 -0.5 ${width + 1} ${height + 1}`}
      className="w-full rounded-md"
      role="img"
      aria-label={`${plan.name} map`}
    >
      <rect x="0" y="0" width={width} height={height} fill="#8f8a80" />
      {plan.deployment.attacker.map((poly, i) => (
        <polygon key={`a${i}`} points={pts(poly)} fill="#8a3a36" />
      ))}
      {plan.deployment.defender.map((poly, i) => (
        <polygon key={`d${i}`} points={pts(poly)} fill="#2f6b78" />
      ))}
      {[15, 30, 45].map((x) => (
        <line
          key={x}
          x1={x}
          y1="0"
          x2={x}
          y2={height}
          stroke="#000"
          strokeOpacity="0.35"
          strokeWidth="0.15"
          strokeDasharray={x === 30 ? undefined : '0.6 0.6'}
        />
      ))}
      {[11, 22, 33].map((y) => (
        <line
          key={y}
          x1="0"
          y1={y}
          x2={width}
          y2={y}
          stroke="#000"
          strokeOpacity="0.35"
          strokeWidth="0.15"
          strokeDasharray={y === 22 ? undefined : '0.6 0.6'}
        />
      ))}
      <rect x="0" y="0" width={width} height={height} fill="none" stroke="#000" strokeWidth="0.3" />
      {plan.terrain.map((t, i) => {
        const r = t.size === 'medium' ? 3.6 : 2.2;
        return (
          <g key={`t${i}`}>
            <title>{`${TERRAIN_LABEL[t.kind]} (${t.size})`}</title>
            {t.kind === 'placeOfPower' ? (
              <polygon
                points={`${t.x},${t.y - r} ${t.x + r},${t.y} ${t.x},${t.y + r} ${t.x - r},${t.y}`}
                fill={TERRAIN_FILL[t.kind]}
                stroke="#e8d9a8"
                strokeWidth="0.3"
              />
            ) : t.kind === 'area' ? (
              <rect
                x={t.x - r * 0.85}
                y={t.y - r * 0.6}
                width={r * 1.7}
                height={r * 1.2}
                rx="0.6"
                fill={TERRAIN_FILL[t.kind]}
                stroke="#e8d9a8"
                strokeWidth="0.3"
              />
            ) : (
              <circle
                cx={t.x}
                cy={t.y}
                r={r * 0.8}
                fill={TERRAIN_FILL[t.kind]}
                stroke="#e8d9a8"
                strokeWidth="0.3"
              />
            )}
          </g>
        );
      })}
      {plan.objectives.map((o) => (
        <g key={o.id}>
          <title>{`${o.kind} objective`}</title>
          <circle
            cx={o.x}
            cy={o.y}
            r="3.4"
            fill={OBJECTIVE_FILL[o.kind]}
            fillOpacity="0.35"
            stroke="#e8c45a"
            strokeWidth="0.35"
          />
          <circle
            cx={o.x}
            cy={o.y}
            r="1.1"
            fill={OBJECTIVE_FILL[o.kind]}
            stroke="#e8c45a"
            strokeWidth="0.3"
          />
        </g>
      ))}
      {!compact && (
        <>
          <text
            x={atk.x}
            y={atk.y + 0.8}
            textAnchor="middle"
            fontSize="2.4"
            fontWeight="700"
            fill="#fff"
            fillOpacity="0.85"
          >
            Attacker
          </text>
          <text
            x={def.x}
            y={def.y + 0.8}
            textAnchor="middle"
            fontSize="2.4"
            fontWeight="700"
            fill="#fff"
            fillOpacity="0.85"
          >
            Defender
          </text>
        </>
      )}
    </svg>
  );
}

/** Battleplan map: the original GHB picture (from its source) or the drawn version. */
export function BattleplanMap({ plan, compact = false }: { plan: Battleplan; compact?: boolean }) {
  const [view, setView] = useState<'original' | 'drawn'>(plan.imageUrl ? 'original' : 'drawn');
  const [failed, setFailed] = useState(false);
  if (compact) return <DrawnMap plan={plan} compact />;
  const showOriginal = view === 'original' && plan.imageUrl && !failed;
  return (
    <figure className="space-y-1">
      {showOriginal ? (
        <img
          src={plan.imageUrl}
          alt={`${plan.name} battleplan map`}
          className="aspect-[60/44] w-full rounded-md bg-black/30 object-contain"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <DrawnMap plan={plan} />
      )}
      <figcaption className="flex items-center justify-between gap-2 text-[11px]">
        {plan.imageUrl && !failed ? (
          <div className="flex gap-1" role="group" aria-label="Map view">
            {(['original', 'drawn'] as const).map((v) => (
              <button
                key={v}
                className={`rounded px-2 py-0.5 ${view === v ? 'bg-[var(--panel-2)] font-semibold' : 'muted'}`}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {v === 'original' ? 'Original map' : 'Drawn'}
              </button>
            ))}
          </div>
        ) : (
          <span className="muted">
            {plan.verified ? 'Drawn from the battleplan map' : 'Placeholder layout'}
          </span>
        )}
        {plan.sourceUrl && (
          <a className="muted underline" href={plan.sourceUrl} target="_blank" rel="noreferrer">
            Source
          </a>
        )}
      </figcaption>
    </figure>
  );
}
