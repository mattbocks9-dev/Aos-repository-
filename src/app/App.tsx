import { LegalFooter } from '../ui/components/LegalFooter';
import { Home } from '../ui/screens/Home';
import { PairingBoard } from '../ui/screens/PairingBoard';
import { Results } from '../ui/screens/Results';
import { RoundSetup } from '../ui/screens/RoundSetup';
import { TeamSetup } from '../ui/screens/TeamSetup';
import { useEffect } from 'react';
import type { Team } from '../data/team';
import { useApp, type Screen } from './store';
import { parsePlayer } from './teams';

const NAV: { screen: Screen; label: string }[] = [
  { screen: 'home', label: 'Home' },
  { screen: 'teams', label: 'Teams' },
  { screen: 'round', label: 'Round' },
];

export function App() {
  const { state, dispatch } = useApp();

  // Saved teams keep the pasted list text; re-read it on every load so parser and catalogue
  // fixes always apply to lists people saved earlier.
  useEffect(() => {
    const hasLists = [state.teams.A, state.teams.B].some((t) =>
      t.players.some((p) => p.factionId || p.listText.trim()),
    );
    if (!hasLists) return;
    const reparse = (team: Team) =>
      Promise.all(team.players.map(parsePlayer)).then((players) => ({ ...team, players }));
    void Promise.all([reparse(state.teams.A), reparse(state.teams.B)]).then(([A, B]) =>
      dispatch({ type: 'reparsed', teams: { A, B } }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center justify-between gap-3">
        <button className="text-left" onClick={() => dispatch({ type: 'go', screen: 'home' })}>
          <h1 className="heading text-xl leading-none" style={{ color: 'var(--gold)' }}>
            Pairing Trainer
          </h1>
          <p className="muted text-xs">Age of Sigmar teams</p>
        </button>
        <nav className="flex gap-1" aria-label="Main">
          {NAV.map((n) => (
            <button
              key={n.screen}
              className={`rounded-md px-3 py-2 text-sm ${state.screen === n.screen ? 'bg-[var(--panel-2)] font-semibold' : 'muted'}`}
              aria-current={state.screen === n.screen ? 'page' : undefined}
              onClick={() => dispatch({ type: 'go', screen: n.screen })}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {state.screen === 'home' && <Home />}
        {state.screen === 'teams' && <TeamSetup />}
        {state.screen === 'round' && <RoundSetup />}
        {state.screen === 'pairing' && <PairingBoard key={`${state.round}-${state.difficulty}`} />}
        {state.screen === 'results' && <Results />}
      </main>
      {state.screen !== 'pairing' && <LegalFooter />}
    </div>
  );
}
