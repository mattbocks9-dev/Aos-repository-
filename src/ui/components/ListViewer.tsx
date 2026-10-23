import { useState } from 'react';
import { analyseList } from '../../data/listAnalysis';
import { listPoints, pointsBreakdown } from '../../data/listParser';
import type { Player } from '../../data/team';
import type { AbilityData, RuleOption } from '../../data/types';
import { Ability } from './Ability';

function RuleSection({ title, abilities }: { title: string; abilities: AbilityData[] }) {
  const [open, setOpen] = useState(false);
  if (!abilities.length) return null;
  return (
    <div>
      <button
        className="flex w-full items-center justify-between py-2 text-left text-sm font-semibold"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="muted text-xs">
          {abilities.length} {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 pb-2">
          {abilities.map((a) => (
            <Ability key={a.name} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

const option = (label: string, o: RuleOption | undefined) =>
  o ? { title: `${label}: ${o.name}`, abilities: o.abilities } : null;

function PointsLine({ player }: { player: Player }) {
  const b = pointsBreakdown(player.list);
  const parts = [
    `units ${b.units}`,
    b.enhancements ? `enhancements ${b.enhancements}` : '',
    b.formation ? `formation ${b.formation}` : '',
    b.lores ? `lores ${b.lores}` : '',
  ].filter(Boolean);
  return (
    <p className="muted mb-2 text-xs">
      Points: {parts.join(' + ')} = {b.total}
    </p>
  );
}

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
  const [openUnit, setOpenUnit] = useState<number>();
  const rules = player.list.rules;
  const sections = [
    rules?.battleTraits.length ? { title: 'Battle traits', abilities: rules.battleTraits } : null,
    option('Battle formation', rules?.formation),
    option('Spell lore', rules?.spellLore),
    option('Prayer lore', rules?.prayerLore),
    option('Manifestation lore', rules?.manifestationLore),
  ].filter((s) => s !== null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${player.name}'s list`}
    >
      <div
        className="panel max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-b-none sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="heading text-lg">{player.name}</h2>
            <p className="muted text-sm">
              {factionName} · {listPoints(player.list)} pts
              {player.list.formation ? ` · ${player.list.formation}` : ''}
            </p>
          </div>
          <button className="btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <PointsLine player={player} />
        <p className="mb-3 flex flex-wrap gap-1 text-sm">
          <span className="chip">{profile.archetype}</span>
          {player.list.manifestationLore && (
            <span className="chip">{player.list.manifestationLore}</span>
          )}
          {player.list.battleTactics?.map((t) => (
            <span key={t} className="chip">
              Tactics: {t}
            </span>
          ))}
          {player.list.factionTerrain && <span className="chip">{player.list.factionTerrain}</span>}
          {profile.deepStrikers > 0 && (
            <span className="chip">{profile.deepStrikers} deep strike</span>
          )}
        </p>
        <dl className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
          {[
            ['Models', profile.models],
            ['Control', profile.control],
            ['Avg move', profile.mobility.toFixed(1) + '"'],
            ['Melee dmg', profile.meleeVsElite.toFixed(0)],
            ['Ranged dmg', profile.rangedVsElite.toFixed(0)],
            ['Mortals', profile.abilityDamage.toFixed(0)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-black/30 p-2">
              <dt className="muted">{k}</dt>
              <dd className="text-base font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {profile.notable.length > 0 && (
          <p className="muted mb-3 text-xs">Key damage abilities: {profile.notable.join(', ')}</p>
        )}

        {sections.length > 0 && (
          <section className="mb-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {sections.map((s) => (
              <RuleSection key={s.title} title={s.title} abilities={s.abilities} />
            ))}
          </section>
        )}

        <p className="label mb-1">Units (tap for warscroll)</p>
        <ul className="divide-y divide-[var(--line)] text-sm">
          {player.list.units.map((u, i) => {
            const open = openUnit === i;
            const unit = u.unit;
            return (
              <li key={i}>
                <button
                  className="flex w-full justify-between py-2 text-left"
                  onClick={() => setOpenUnit(open ? undefined : i)}
                  aria-expanded={open}
                >
                  <span>
                    {u.name}
                    {u.reinforced && <span className="muted"> · reinforced</span>}
                    {(u.enhancements ?? []).map((e) => (
                      <span key={e.name} className="block text-xs" style={{ color: 'var(--gold)' }}>
                        + {e.name}
                        <span className="muted">
                          {' '}
                          ({e.table}
                          {e.points ? `, ${e.points} pts` : ''})
                        </span>
                      </span>
                    ))}
                  </span>
                  <span className="muted">{u.points}</span>
                </button>
                {open && unit && (
                  <div className="space-y-1.5 pb-3">
                    <p className="muted text-xs">
                      Move {unit.move}" · Health {unit.health} · Save {unit.save}+ · Control{' '}
                      {unit.control}
                      {unit.ward ? ` · Ward ${unit.ward}+` : ''}
                      {unit.wizard ? ` · Wizard (${unit.wizard})` : ''}
                      {unit.priest ? ` · Priest (${unit.priest})` : ''} ·{' '}
                      {(() => {
                        const n = unit.models * (u.reinforced ? 2 : 1);
                        return `${n} model${n === 1 ? '' : 's'}`;
                      })()}
                    </p>
                    {unit.weapons.length > 0 && (
                      <table className="w-full text-left text-xs">
                        <thead className="muted">
                          <tr>
                            <th className="font-normal">Weapon</th>
                            <th className="font-normal">Rng</th>
                            <th className="font-normal">A</th>
                            <th className="font-normal">Hit</th>
                            <th className="font-normal">Wnd</th>
                            <th className="font-normal">Rnd</th>
                            <th className="font-normal">D</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unit.weapons.map((w) => (
                            <tr key={w.name + w.kind}>
                              <td className="pr-1">{w.name}</td>
                              <td>{w.kind === 'ranged' ? `${w.range}"` : '—'}</td>
                              <td>{w.attacks}</td>
                              <td>{w.hit}+</td>
                              <td>{w.wound}+</td>
                              <td>{w.rend || '—'}</td>
                              <td>{w.damage}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {(unit.abilities ?? []).map((a) => (
                      <Ability key={a.name} a={a} />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="muted mt-3 text-[11px]">Unit and rules data: BSData age-of-sigmar-4th.</p>
      </div>
    </div>
  );
}
