import { useState } from 'react';
import { REPO_URL } from '../../app/config';
import { teamFromSample } from '../../app/teams';
import { loadFaction } from '../../data/catalog';
import type { Team } from '../../data/team';
import { libraryEntryFromTeam, TEAM_LIBRARY, validateLibraryTeam } from '../../data/teamLibrary';
import type { FactionData } from '../../data/types';

// GitHub issue-form URLs can prefill fields, but very long URLs get rejected.
const MAX_PREFILL = 6000;

export function submissionUrl(team: Team, json: string): string {
  const params = new URLSearchParams({
    template: 'team-submission.yml',
    title: `Team: ${team.name}`,
    'team-name': team.name,
  });
  if (encodeURIComponent(json).length < MAX_PREFILL) params.set('team-data', json);
  return `${REPO_URL}/issues/new?${params.toString()}`;
}

export function TeamLibraryBar({ team, onLoad }: { team: Team; onLoad: (t: Team) => void }) {
  const [status, setStatus] = useState<string>();
  const [errors, setErrors] = useState<string[]>([]);
  const [json, setJson] = useState<string>();

  const load = async (id: string) => {
    const entry = TEAM_LIBRARY.find((t) => t.id === id);
    if (!entry) return;
    const hasWork = team.players.some((p) => p.listText.trim());
    if (hasWork && !window.confirm(`Replace "${team.name}" with "${entry.name}"?`)) return;
    onLoad(await teamFromSample(entry));
    setStatus(`Loaded "${entry.name}".`);
    setErrors([]);
    setJson(undefined);
  };

  const submit = async () => {
    const entry = libraryEntryFromTeam(team);
    const factions = new Map<string, FactionData>();
    await Promise.all(
      [...new Set(entry.players.map((p) => p.factionId).filter(Boolean))].map(async (id) => {
        try {
          factions.set(id, await loadFaction(id));
        } catch {
          // Unknown faction: reported by the validator.
        }
      }),
    );
    const problems = validateLibraryTeam(entry, (id) => factions.get(id));
    setErrors(problems);
    if (problems.length) {
      setStatus('Fix these before submitting:');
      setJson(undefined);
      return;
    }
    const text = JSON.stringify(entry, null, 2);
    setJson(text);
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      // Clipboard blocked: the JSON is shown below to copy by hand.
    }
    window.open(submissionUrl(team, text), '_blank', 'noopener');
    setStatus(
      copied
        ? 'Team data copied. A GitHub issue form has opened: paste it into "Team data" if it is empty, then submit. It appears for everyone once approved.'
        : 'A GitHub issue form has opened: copy the team data below into "Team data", then submit.',
    );
  };

  return (
    <section className="panel space-y-2 p-3">
      <label className="label" htmlFor="team-library">
        Load a saved team (shared library)
      </label>
      <select
        id="team-library"
        className="input"
        value=""
        onChange={(e) => void load(e.target.value)}
      >
        <option value="">Choose a team…</option>
        {TEAM_LIBRARY.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.submittedBy ? ` (by ${t.submittedBy})` : ''}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn text-sm" onClick={() => void submit()}>
          Submit this team to the shared library
        </button>
        <span className="muted text-xs">
          Needs a free GitHub account; teams appear once approved.
        </span>
      </div>
      {status && (
        <p className="text-sm" role="status">
          {status}
        </p>
      )}
      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-amber-300">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {json && (
        <textarea
          className="input h-28 font-mono text-xs"
          readOnly
          value={json}
          aria-label="Team data"
        />
      )}
    </section>
  );
}
