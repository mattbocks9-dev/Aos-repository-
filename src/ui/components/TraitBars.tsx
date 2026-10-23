import type { BattleplanTraits } from '../../packs/traits';

const LABELS: Record<keyof BattleplanTraits, string> = {
  mobility: 'Distance to objectives',
  objectiveSpread: 'Objective spread',
  controlPressure: 'Objective count',
  shootingLanes: "No-man's land",
  centreFocus: 'Centre focus',
  attackerEdge: 'Attacker edge',
};

export function TraitBars({ traits }: { traits: BattleplanTraits }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {(Object.keys(LABELS) as (keyof BattleplanTraits)[]).map((k) => {
        const v = traits[k];
        const pct = k === 'attackerEdge' ? (v + 1) * 50 : v * 100;
        return (
          <div key={k}>
            <dt className="muted">{LABELS[k]}</dt>
            <dd className="mt-0.5 h-1.5 rounded bg-black/40">
              <div
                className="h-full rounded"
                style={{ width: `${Math.max(4, pct)}%`, background: 'var(--gold)' }}
              />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
