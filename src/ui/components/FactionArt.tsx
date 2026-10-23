import { useState } from 'react';
import { useFactionArt } from '../../data/art';

const ALLIANCE: Record<string, { color: string; glyph: string }> = {
  Order: { color: '#3b6fb6', glyph: 'M16 4l3 8h8l-6 5 2 9-7-5-7 5 2-9-6-5h8z' },
  Chaos: { color: '#a3312a', glyph: 'M16 3v26M3 16h26M7 7l18 18M25 7L7 25' },
  Death: {
    color: '#5d6b5c',
    glyph: 'M16 5a8 8 0 0 0-8 8c0 3 2 5 3 6v4h10v-4c1-1 3-3 3-6a8 8 0 0 0-8-8zM12 14h2M18 14h2',
  },
  Destruction: { color: '#5f8a2c', glyph: 'M6 22l5-14 5 8 5-8 5 14z' },
};

const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

export function Crest({ name, grandAlliance }: { name: string; grandAlliance: string }) {
  const a = ALLIANCE[grandAlliance] ?? { color: '#6b5d50', glyph: '' };
  return (
    <svg viewBox="0 0 64 80" className="h-full w-full" role="img" aria-label={`${name} crest`}>
      <defs>
        <linearGradient id={`g-${grandAlliance}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a.color} />
          <stop offset="1" stopColor="#120f0d" />
        </linearGradient>
      </defs>
      <rect width="64" height="80" fill={`url(#g-${grandAlliance})`} />
      <path
        d={a.glyph}
        transform="translate(16 10)"
        fill="none"
        stroke="#f1e9df"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
      <text
        x="32"
        y="64"
        textAnchor="middle"
        fontFamily="Cinzel, serif"
        fontWeight="700"
        fontSize="18"
        fill="#f1e9df"
      >
        {initials(name)}
      </text>
    </svg>
  );
}

/** Faction picture: user art → public/covers/<id>.jpg → generated crest. */
export function FactionArt({
  factionId,
  name,
  grandAlliance,
  className = '',
}: {
  factionId: string;
  name: string;
  grandAlliance: string;
  className?: string;
}) {
  const custom = useFactionArt(factionId);
  const sources = [
    custom,
    factionId ? `${import.meta.env.BASE_URL}covers/${factionId}.jpg` : undefined,
  ].filter((s): s is string => !!s);
  const [failed, setFailed] = useState<string[]>([]);
  const src = sources.find((s) => !failed.includes(s));
  return (
    <div className={`overflow-hidden bg-black/30 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={`${name} artwork`}
          className="h-full w-full object-cover"
          onError={() => setFailed((f) => [...f, src])}
        />
      ) : (
        <Crest name={name || '?'} grandAlliance={grandAlliance} />
      )}
    </div>
  );
}
