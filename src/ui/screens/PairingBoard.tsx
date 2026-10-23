import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, type LogEntry } from '../../app/store';
import { useCatalog } from '../../app/useCatalog';
import { analyseList } from '../../data/listAnalysis';
import type { Player } from '../../data/team';
import type { CaptainSetup, MatchupTable } from '../../npc/captain';
import { createNpcClient, type NpcClient } from '../../npc/client';
import type { GIState } from '../../pairing/guardianInvader';
import { getProtocol } from '../../pairing/registry';
import type { Move, Side } from '../../pairing/types';
import { getPack } from '../../packs/registry';
import { battleplanTraits } from '../../packs/traits';
import { BattleplanMap } from '../components/BattleplanMap';
import { FactionArt } from '../components/FactionArt';
import { ListViewer } from '../components/ListViewer';
import { edgeClass, fmtEdge } from '../format';

const STEP_TEXT = {
  guardian: 'Choose your Guardian',
  invaders: 'Choose two Invaders',
  choose: 'Pick which enemy Invader faces your Guardian',
  done: 'Pairing complete',
} as const;

function PlayerCard({
  player,
  side,
  selected,
  disabled,
  onClick,
  onInfo,
  badge,
  small = false,
}: {
  player: Player;
  side: Side;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onInfo: () => void;
  badge?: string;
  small?: boolean;
}) {
  const { faction } = useCatalog();
  const f = faction(player.factionId);
  const colour = side === 'A' ? 'var(--you)' : 'var(--them)';
  return (
    <div
      className={`relative flex flex-col ${small ? 'w-[72px] sm:w-[96px]' : 'w-[30%] min-w-[96px] max-w-[132px]'} overflow-hidden rounded-lg border-2 transition ${
        selected ? '-translate-y-1 shadow-lg shadow-black/50' : ''
      } ${disabled ? 'opacity-40' : ''}`}
      style={{ borderColor: selected ? 'var(--gold)' : colour, background: 'var(--panel-2)' }}
    >
      <button
        className="text-left disabled:cursor-default"
        onClick={onClick}
        disabled={!onClick || disabled}
        aria-pressed={onClick ? !!selected : undefined}
        aria-label={`${player.name}, ${f?.name ?? ''}`}
      >
        <FactionArt
          factionId={player.factionId}
          name={f?.name ?? ''}
          grandAlliance={f?.grandAlliance ?? ''}
          className="aspect-[4/5] w-full"
        />
        <span className="block px-1.5 pt-1 text-xs font-semibold leading-tight">{player.name}</span>
        <span className="muted block truncate px-1.5 pb-1 text-[11px]">{f?.name}</span>
      </button>
      <button
        className="absolute right-1 top-1 h-7 w-7 rounded-full bg-black/70 text-xs"
        onClick={onInfo}
        aria-label={`View ${player.name}'s list`}
      >
        i
      </button>
      {badge && (
        <span
          className="absolute left-1 top-1 rounded bg-black/75 px-1 text-[10px] font-bold uppercase"
          style={{ color: colour }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

export function PairingBoard() {
  const { state, dispatch } = useApp();
  const { faction } = useCatalog();
  const pack = getPack(state.packId);
  const protocol = getProtocol(pack.protocol);
  const round = pack.rounds.find((r) => r.round === state.round) ?? pack.rounds[0]!;
  const { A: teamA, B: teamB } = state.teams;

  const [s, setS] = useState<GIState>(() => protocol.initial(pack.teamSize));
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(true);
  const [table, setTable] = useState<MatchupTable>();
  const [start, setStart] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [viewing, setViewing] = useState<Player>();
  const [hints, setHints] = useState(false);
  const client = useRef<NpcClient>();

  const label = (p: Player) => `${p.name} (${faction(p.factionId)?.name ?? '?'})`;

  const setup: CaptainSetup = useMemo(
    () => ({
      npc: teamB.players.map((p) => analyseList(p.list)),
      user: teamA.players.map((p) => analyseList(p.list)),
      npcNames: teamB.players.map((p) => p.name),
      userNames: teamA.players.map((p) => p.name),
      slots: Object.fromEntries(
        pack.slots.map((slot) => [
          slot,
          battleplanTraits(pack.battleplans[round.battleplans[slot]!]!),
        ]),
      ),
      slotNames: Object.fromEntries(
        pack.slots.map((slot) => [slot, pack.battleplans[round.battleplans[slot]!]!.name]),
      ),
      difficulty: state.difficulty,
    }),
    [teamA, teamB, pack, round, state.difficulty],
  );

  useEffect(() => {
    const c = createNpcClient(pack.protocol, setup);
    client.current = c;
    let live = true;
    void (async () => {
      const t = await c.init();
      const e = await c.expectedEdge(protocol.initial(pack.teamSize));
      if (!live) return;
      setTable(t);
      setStart(e);
      setBusy(false);
    })();
    return () => {
      live = false;
      c.dispose();
    };
  }, [setup, pack, protocol]);

  const step = protocol.currentStep(s);
  const legal = protocol.legalMoves(s, 'A');
  const pool = [...new Set(legal.flat())].sort((a, b) => a - b);
  const pickSide: Side = step.kind === 'choose' ? 'B' : 'A';
  const forced = legal.length === 1;
  const effective = forced ? legal[0]! : selected;
  const plan = pack.battleplans[round.battleplans[step.slot] ?? round.battleplans.C!]!;

  const gA = protocol.guardian?.(s, 'A');
  const gB = protocol.guardian?.(s, 'B');

  const toggle = (i: number) => {
    if (forced) return;
    setSelected((cur) =>
      cur.includes(i)
        ? cur.filter((x) => x !== i)
        : step.count === 1
          ? [i]
          : cur.length < step.count
            ? [...cur, i]
            : cur,
    );
  };

  const lockIn = async () => {
    if (!client.current || effective.length !== step.count) return;
    setBusy(true);
    const move: Move = [...effective].sort((a, b) => a - b);
    const npc = await client.current.decide(s);
    const next = protocol.apply(s, { A: move, B: npc.move });
    const names = (team: typeof teamA, ids: number[]) =>
      ids.map((i) => label(team.players[i]!)).join(', ');
    const choosing = step.kind === 'choose';
    const entry: LogEntry = {
      step: `${STEP_TEXT[step.kind]} · ${plan.name}`,
      you: choosing
        ? `${names(teamB, move)} faces ${teamA.players[gA!]!.name}`
        : names(teamA, move),
      npc: choosing
        ? `${names(teamA, npc.move)} faces ${teamB.players[gB!]!.name}`
        : names(teamB, npc.move),
      reasoning: npc.reasoning,
    };
    setLog((l) => [entry, ...l]);
    setS(next);
    setSelected([]);
    setBusy(false);
  };

  const finish = () => {
    if (!table) return;
    dispatch({
      type: 'finish',
      result: {
        pairings: protocol
          .pairings(s)
          .map((p) => ({ ...p, npcEdge: table[p.slot]![p.b]![p.a]!.score })),
        startExpectation: start,
        log: [...log].reverse(),
      },
    });
  };

  const terminal = protocol.isTerminal(s);
  const pairings = protocol.pairings(s);
  const invA = s.invaders.A ?? [];
  const invB = s.invaders.B ?? [];
  const latest = log[0];

  return (
    <div className="space-y-4 pb-28">
      <section className="panel flex gap-3 p-3">
        <div className="w-28 shrink-0 sm:w-40">
          <BattleplanMap plan={plan} compact />
        </div>
        <div className="min-w-0">
          <p className="label">
            Round {round.round} · Battleplan {step.slot}
          </p>
          <h2 className="heading text-lg leading-tight">{plan.name}</h2>
          <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--gold)' }}>
            {busy && !table ? 'Opponent captain is studying the lists…' : STEP_TEXT[step.kind]}
          </p>
        </div>
      </section>

      {latest && (
        <section className="panel border-[var(--gold)]/40 p-3 text-sm" aria-live="polite">
          <p className="label mb-1">Revealed: {latest.step}</p>
          <p>
            <span style={{ color: 'var(--you)' }}>You:</span> {latest.you}
          </p>
          <p>
            <span style={{ color: 'var(--them)' }}>{teamB.name}:</span> {latest.npc}
          </p>
          <p className="muted mt-1 italic">“{latest.reasoning}”</p>
        </section>
      )}

      {(gA !== undefined || gB !== undefined) && (
        <section className="grid grid-cols-2 gap-3">
          <div>
            <p className="label mb-1">Your table</p>
            <div className="flex flex-wrap gap-2">
              {gA !== undefined && (
                <PlayerCard
                  player={teamA.players[gA]!}
                  side="A"
                  badge="Guardian"
                  small
                  onInfo={() => setViewing(teamA.players[gA])}
                />
              )}
              {invA.map((i) => (
                <PlayerCard
                  key={i}
                  player={teamA.players[i]!}
                  side="A"
                  badge="Invader"
                  small
                  onInfo={() => setViewing(teamA.players[i])}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-1">Their table</p>
            <div className="flex flex-wrap gap-2">
              {gB !== undefined && (
                <PlayerCard
                  player={teamB.players[gB]!}
                  side="B"
                  badge="Guardian"
                  small
                  onInfo={() => setViewing(teamB.players[gB])}
                />
              )}
              {step.kind !== 'choose' &&
                invB.map((i) => (
                  <PlayerCard
                    key={i}
                    player={teamB.players[i]!}
                    side="B"
                    badge="Invader"
                    small
                    onInfo={() => setViewing(teamB.players[i])}
                  />
                ))}
            </div>
          </div>
        </section>
      )}

      {!terminal && (
        <section>
          <p className="label mb-2">
            {step.kind === 'choose'
              ? `Their Invaders: who faces ${teamA.players[gA!]!.name}?`
              : forced
                ? 'Your last two cards go in as Invaders'
                : `Your hand: pick ${step.count}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {pool.map((i) => {
              const team = pickSide === 'A' ? teamA : teamB;
              return (
                <PlayerCard
                  key={i}
                  player={team.players[i]!}
                  side={pickSide}
                  selected={effective.includes(i)}
                  onClick={() => toggle(i)}
                  onInfo={() => setViewing(team.players[i])}
                />
              );
            })}
          </div>
          {step.kind !== 'choose' && (
            <p className="muted mt-3 text-xs">
              Opponent's hand: {s.hand.B.map((i) => teamB.players[i]!.name).join(', ') || '—'}
            </p>
          )}
        </section>
      )}

      {pairings.length > 0 && (
        <section className="panel p-3">
          <p className="label mb-2">Locked games</p>
          <ul className="space-y-1 text-sm">
            {pairings.map((p, k) => (
              <li key={k} className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span>
                  <span style={{ color: 'var(--you)' }}>{teamA.players[p.a]!.name}</span> vs{' '}
                  <span style={{ color: 'var(--them)' }}>{teamB.players[p.b]!.name}</span>
                </span>
                <span className="muted text-xs">
                  {pack.battleplans[round.battleplans[p.slot]!]!.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {table && !terminal && (
        <section>
          <button
            className="btn w-full text-sm"
            onClick={() => setHints(!hints)}
            aria-expanded={hints}
          >
            {hints ? 'Hide' : 'Show'} the NPC's matchup estimates (hint)
          </button>
          {hints && (
            <div className="panel mt-2 overflow-x-auto p-2">
              <p className="muted mb-2 text-xs">
                Your edge on {plan.name}, as the opponent captain sees it (−10…+10).
              </p>
              <table className="w-full text-center text-xs">
                <thead>
                  <tr>
                    <th />
                    {teamB.players.map((p, j) => (
                      <th key={j} className="px-1 font-semibold" style={{ color: 'var(--them)' }}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamA.players.map((p, i) => (
                    <tr key={i}>
                      <th className="px-1 text-left font-semibold" style={{ color: 'var(--you)' }}>
                        {p.name}
                      </th>
                      {teamB.players.map((_, j) => {
                        const v = -table[step.slot]![j]![i]!.score;
                        return (
                          <td key={j} className={`px-1 py-1 ${edgeClass(v)}`}>
                            {fmtEdge(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--line)] bg-[var(--bg)]/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          {terminal ? (
            <button className="btn-primary w-full min-h-[52px]" onClick={finish}>
              See results
            </button>
          ) : (
            <button
              className="btn-primary w-full min-h-[52px]"
              disabled={busy || effective.length !== step.count}
              onClick={() => void lockIn()}
            >
              {busy
                ? 'Opponent is thinking…'
                : `Lock in & reveal (${effective.length}/${step.count})`}
            </button>
          )}
        </div>
      </div>

      {viewing && (
        <ListViewer
          player={viewing}
          factionName={faction(viewing.factionId)?.name ?? ''}
          onClose={() => setViewing(undefined)}
        />
      )}
    </div>
  );
}
