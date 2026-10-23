import { Home } from '../ui/screens/Home';
import { PairingBoard } from '../ui/screens/PairingBoard';
import { Results } from '../ui/screens/Results';
import { RoundSetup } from '../ui/screens/RoundSetup';
import { TeamSetup } from '../ui/screens/TeamSetup';
import { useEffect } from 'react';
import { useApp, type Screen } from './store';
import { parsePlayer } from './teams';

const NAV: { screen: Screen; label: string }[] = [
  { screen: 'home', label: 'Home' },
  { screen: 'teams', label: 'Teams' },
  { screen: 'round', label: 'Round' },
];

export function App() {
  const { state, dispatch } = useApp();

  // Lists saved by older versions lack abilities/battletome rules: re-parse them once.
  useEffect(() => {
    for (const side of ['A', 'B'] as const) {
      const team = state.teams[side];
      if (team.players.some((p) => p.factionId && !p.list.rules)) {
        void Promise.all(team.players.map(parsePlayer)).then((players) =>
          dispatch({ type: 'setTeam', side, team: { ...team, players } }),
        );
      }
    }
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
    </div>
  );
}
