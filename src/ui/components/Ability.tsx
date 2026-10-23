import type { AbilityData } from '../../data/types';

const KIND_LABEL: Record<AbilityData['kind'], string> = {
  passive: 'Passive',
  activated: 'Ability',
  spell: 'Spell',
  prayer: 'Prayer',
  command: 'Command',
};

export function Ability({ a }: { a: AbilityData }) {
  return (
    <div className="rounded-md bg-black/25 p-2">
      <p className="text-sm font-semibold">
        {a.name}
        <span className="muted ml-2 text-xs font-normal">
          {[KIND_LABEL[a.kind], a.timing, a.castingValue ? `CV ${a.castingValue}` : '']
            .filter(Boolean)
            .join(' · ')}
        </span>
      </p>
      {a.declare && <p className="muted mt-0.5 text-xs">{a.declare}</p>}
      <p className="mt-0.5 text-xs leading-relaxed">{a.effect}</p>
    </div>
  );
}
