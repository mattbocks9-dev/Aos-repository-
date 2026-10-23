import { useApp } from '../../app/store';
import { useCatalog } from '../../app/useCatalog';
import { getPack } from '../../packs/registry';
import { BattleplanMap } from '../components/BattleplanMap';
import { FactionArt } from '../components/FactionArt';
import { edgeClass, fmtEdge } from '../format';

export function Results() {
  const { state, dispatch } = useApp();
  const { faction } = useCatalog();
  const pack = getPack(state.packId);
  const round = pack.rounds.find((r) => r.round === state.round) ?? pack.rounds[0]!;
  const result = state.result;
  if (!result) return null;
  const { A, B } = state.teams;

  const total = result.pairings.reduce((s, p) => s - p.npcEdge, 0);
  const expected = -result.startExpectation;
  const delta = total - expected;

  return (
    <div className="space-y-4">
      <section className="panel text-center">
        <p className="label">Projected for {A.name}</p>
        <p className={`heading text-4xl ${edgeClass(total)}`}>{fmtEdge(total)}</p>
        <p className="muted mt-1 text-sm">
          Sum of your five matchup edges, as estimated by the opponent captain (−10…+10 each).
        </p>
        <p className="mt-3 text-sm">
          Before pairing, best play from both sides was worth <strong>{fmtEdge(expected)}</strong>{' '}
          to you.{' '}
          {Math.abs(delta) < 0.5 ? (
            <span>You matched it.</span>
          ) : delta > 0 ? (
            <span className="text-[var(--good)]">You beat that by {delta.toFixed(1)}.</span>
          ) : (
            <span className="text-[var(--bad)]">You gave away {(-delta).toFixed(1)}.</span>
          )}
        </p>
      </section>

      <section className="space-y-2">
        {result.pairings.map((p, k) => {
          const plan = pack.battleplans[round.battleplans[p.slot]!]!;
          const pa = A.players[p.a]!;
          const pb = B.players[p.b]!;
          const fa = faction(pa.factionId);
          const fb = faction(pb.factionId);
          const edge = -p.npcEdge;
          return (
            <article key={k} className="panel flex items-center gap-3 p-3">
              <FactionArt
                factionId={pa.factionId}
                name={fa?.name ?? ''}
                grandAlliance={fa?.grandAlliance ?? ''}
                className="h-14 w-11 shrink-0 rounded"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  <span style={{ color: 'var(--you)' }}>{pa.name}</span> vs{' '}
                  <span style={{ color: 'var(--them)' }}>{pb.name}</span>
                </p>
                <p className="muted truncate text-xs">
                  {fa?.name} vs {fb?.name}
                </p>
                <p className="muted truncate text-xs">
                  {plan.name} ·{' '}
                  {p.guardian === 'A'
                    ? 'your Guardian'
                    : p.guardian === 'B'
                      ? 'their Guardian'
                      : 'leftovers'}
                </p>
              </div>
              <div className="w-16 shrink-0">
                <BattleplanMap plan={plan} compact />
              </div>
              <span className={`w-12 shrink-0 text-right font-semibold ${edgeClass(edge)}`}>
                {fmtEdge(edge)}
              </span>
              <FactionArt
                factionId={pb.factionId}
                name={fb?.name ?? ''}
                grandAlliance={fb?.grandAlliance ?? ''}
                className="hidden h-14 w-11 shrink-0 rounded sm:block"
              />
            </article>
          );
        })}
      </section>

      <section className="panel">
        <p className="label mb-2">Opponent captain's reasoning</p>
        <ol className="space-y-2 text-sm">
          {result.log.map((e, i) => (
            <li key={i}>
              <p className="font-semibold">{e.step}</p>
              <p className="muted">
                You: {e.you} · Them: {e.npc}
              </p>
              <p className="italic">“{e.reasoning}”</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-2 sm:grid-cols-3">
        <button className="btn-primary" onClick={() => dispatch({ type: 'go', screen: 'pairing' })}>
          Pair again
        </button>
        <button className="btn" onClick={() => dispatch({ type: 'go', screen: 'round' })}>
          Change round
        </button>
        <button className="btn" onClick={() => dispatch({ type: 'go', screen: 'teams' })}>
          Edit teams
        </button>
      </div>
    </div>
  );
}
