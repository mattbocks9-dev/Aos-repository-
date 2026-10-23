import { useState } from 'react';
import { useApp } from '../../app/store';
import { teamFromSample, teamReady } from '../../app/teams';
import { SAMPLE_NPC_TEAM, SAMPLE_USER_TEAM } from '../../data/samples';
import { getPack } from '../../packs/registry';

export function Home() {
  const { state, dispatch } = useApp();
  const pack = getPack(state.packId);
  const [loading, setLoading] = useState(false);
  const ready = teamReady(state.teams.A) && teamReady(state.teams.B);

  const quickPlay = async () => {
    setLoading(true);
    const [A, B] = await Promise.all([
      teamFromSample(SAMPLE_USER_TEAM),
      teamFromSample(SAMPLE_NPC_TEAM),
    ]);
    dispatch({ type: 'setTeam', side: 'A', team: A });
    dispatch({ type: 'setTeam', side: 'B', team: B });
    setLoading(false);
    dispatch({ type: 'go', screen: 'round' });
  };

  return (
    <div className="space-y-4">
      <section className="panel">
        <p className="label">Tournament pack</p>
        <h2 className="heading mt-1 text-xl">{pack.name}</h2>
        <p className="muted mt-1 text-sm">
          {pack.teamSize}-player teams · {pack.pointsLimit} pts · {pack.rounds.length} rounds
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          {pack.pairingSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        <button
          className="btn-primary min-h-[56px]"
          onClick={() => dispatch({ type: 'go', screen: 'teams' })}
        >
          Set up teams &amp; lists
        </button>
        <button className="btn min-h-[56px]" onClick={quickPlay} disabled={loading}>
          {loading ? 'Loading…' : 'Quick play with sample teams'}
        </button>
        {ready && (
          <button
            className="btn min-h-[56px] sm:col-span-2"
            onClick={() => dispatch({ type: 'go', screen: 'round' })}
          >
            Continue with {state.teams.A.name} vs {state.teams.B.name}
          </button>
        )}
      </section>
    </div>
  );
}
