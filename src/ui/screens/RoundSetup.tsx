import { useApp } from '../../app/store';
import type { Difficulty } from '../../npc/captain';
import { getPack } from '../../packs/registry';
import { battleplanTraits } from '../../packs/traits';
import { BattleplanMap } from '../components/BattleplanMap';
import { TraitBars } from '../components/TraitBars';

const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: 'Reads lists, but plays as if you pick at random.' },
  { id: 'normal', label: 'Normal', hint: 'Mostly optimal, with some human-like tendencies.' },
  { id: 'hard', label: 'Hard', hint: 'Game-theory optimal mixed strategy. Unexploitable.' },
];

export function RoundSetup() {
  const { state, dispatch } = useApp();
  const pack = getPack(state.packId);
  const round = pack.rounds.find((r) => r.round === state.round) ?? pack.rounds[0]!;

  return (
    <div className="space-y-4">
      <section>
        <p className="label mb-2">Which round are you pairing for?</p>
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Tournament round">
          {pack.rounds.map((r) => (
            <button
              key={r.round}
              role="radio"
              aria-checked={r.round === state.round}
              className={r.round === state.round ? 'btn-primary' : 'btn'}
              onClick={() => dispatch({ type: 'setRound', round: r.round })}
            >
              R{r.round}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {pack.slots.map((slot) => {
          const plan = pack.battleplans[round.battleplans[slot]!]!;
          return (
            <article key={slot} className="panel space-y-3 p-3">
              <header>
                <p className="label">
                  Battleplan {slot} · {slot === 'C' ? '1 game (leftovers)' : '2 games'}
                </p>
                <h3 className="heading text-lg">{plan.name}</h3>
              </header>
              <BattleplanMap plan={plan} />
              <TraitBars traits={battleplanTraits(plan)} />
            </article>
          );
        })}
      </section>

      <section>
        <p className="label mb-2">Opponent captain</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Difficulty">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              role="radio"
              aria-checked={state.difficulty === d.id}
              className={state.difficulty === d.id ? 'btn-primary' : 'btn'}
              onClick={() => dispatch({ type: 'setDifficulty', difficulty: d.id })}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="muted mt-2 text-sm">
          {DIFFICULTIES.find((d) => d.id === state.difficulty)?.hint}
        </p>
      </section>

      <button
        className="btn-primary w-full min-h-[56px] text-lg"
        onClick={() => dispatch({ type: 'go', screen: 'pairing' })}
      >
        Start pairing vs {state.teams.B.name}
      </button>
    </div>
  );
}
