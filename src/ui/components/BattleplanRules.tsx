import type { Battleplan, BattleTacticsCard } from '../../packs/types';
import { Ability } from './Ability';

/** Twist, abilities, scoring and errata for a battleplan. */
export function BattleplanRules({ plan }: { plan: Battleplan }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer py-1 font-semibold">Rules: twist &amp; scoring</summary>
      <div className="space-y-2 pt-1">
        {plan.twist && (
          <p className="text-xs leading-relaxed">
            <span className="font-semibold" style={{ color: 'var(--gold)' }}>
              Twist:{' '}
            </span>
            {plan.twist}
          </p>
        )}
        {plan.abilities.map((a) => (
          <Ability key={a.name} a={a} />
        ))}
        {plan.scoring.length > 0 && (
          <div>
            <p className="label mb-1">Scoring (end of each of your turns)</p>
            <ul className="list-disc space-y-0.5 pl-5 text-xs">
              {plan.scoring.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {plan.notes.map((n) => (
          <p key={n} className="muted text-xs">
            FAQ / errata: {n}
          </p>
        ))}
      </div>
    </details>
  );
}

export function BattleTactics({ cards }: { cards: BattleTacticsCard[] }) {
  return (
    <details className="panel p-3">
      <summary className="cursor-pointer font-semibold">
        Battle tactics cards{' '}
        <span className="muted text-xs font-normal">({cards.length}, pick 2 per army)</span>
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <article key={card.name} className="rounded-lg bg-black/20 p-3 text-xs">
            <h4 className="heading text-sm">
              {card.number}. {card.name}
            </h4>
            <p className="muted mt-0.5 italic">{card.flavour}</p>
            {card.setup && <p className="mt-1">{card.setup}</p>}
            <ol className="mt-2 space-y-1.5">
              {card.tactics.map((t) => (
                <li key={t.type}>
                  <span className="font-semibold" style={{ color: 'var(--gold)' }}>
                    {t.type}: {t.name}
                  </span>{' '}
                  <span className="muted">({t.victoryPoints} VP)</span>
                  <br />
                  {t.condition}
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </details>
  );
}
