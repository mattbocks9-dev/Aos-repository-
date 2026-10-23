import { analyseList } from '../../data/listAnalysis';
import { listPoints } from '../../data/listParser';
import type { Player } from '../../data/team';

export function ListViewer({
  player,
  factionName,
  onClose,
}: {
  player: Player;
  factionName: string;
  onClose: () => void;
}) {
  const profile = analyseList(player.list);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${player.name}'s list`}
    >
      <div
        className="panel max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-b-none sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="heading text-lg">{player.name}</h2>
            <p className="muted text-sm">
              {factionName} · {listPoints(player.list)} pts
            </p>
          </div>
          <button className="btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mb-3 text-sm">
          <span className="chip mr-1">{profile.archetype}</span>
          {player.list.manifestationLore && (
            <span className="chip">{player.list.manifestationLore}</span>
          )}
        </p>
        <dl className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
          {[
            ['Models', profile.models],
            ['Control', profile.control],
            ['Avg move', profile.mobility.toFixed(1) + '"'],
            ['Melee dmg', profile.meleeVsElite.toFixed(0)],
            ['Ranged dmg', profile.rangedVsElite.toFixed(0)],
            ['Eff. wounds', profile.effectiveWounds.toFixed(0)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-black/30 p-2">
              <dt className="muted">{k}</dt>
              <dd className="text-base font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="divide-y divide-[var(--line)] text-sm">
          {player.list.units.map((u, i) => (
            <li key={i} className="flex justify-between py-1.5">
              <span>
                {u.name}
                {u.reinforced && <span className="muted"> · reinforced</span>}
              </span>
              <span className="muted">{u.points}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
