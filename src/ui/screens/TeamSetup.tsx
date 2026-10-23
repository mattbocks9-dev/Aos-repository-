import { useState } from 'react';
import { fileToDataUrl, setFactionArt } from '../../data/art';
import { detectFaction, listPoints } from '../../data/listParser';
import { analyseList } from '../../data/listAnalysis';
import { validateTeam, type Player, type Team } from '../../data/team';
import type { FactionIndex } from '../../data/types';
import { getPack } from '../../packs/registry';
import { useApp } from '../../app/store';
import { parsePlayer, teamReady } from '../../app/teams';
import { useCatalog } from '../../app/useCatalog';
import { FactionArt } from '../components/FactionArt';

const ALLIANCES = ['Order', 'Chaos', 'Death', 'Destruction'];

function FactionSelect({
  index,
  value,
  onChange,
  id,
}: {
  index: FactionIndex;
  value: string;
  onChange: (id: string) => void;
  id: string;
}) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose faction…</option>
      {ALLIANCES.map((ga) => (
        <optgroup key={ga} label={ga}>
          {index.factions
            .filter((f) => f.grandAlliance === ga)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

function ArtEditor({ factionId }: { factionId: string }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string>();
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-black/20 p-3 text-sm">
      <p className="muted">
        Use the battletome cover (or any image) for this faction. It is saved in this browser only.
      </p>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Paste image URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          className="btn"
          disabled={!url}
          onClick={() => void setFactionArt(factionId, url.trim()).then(() => setUrl(''))}
        >
          Save
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="btn cursor-pointer">
          Upload image
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                await setFactionArt(factionId, await fileToDataUrl(file));
                setError(undefined);
              } catch (err) {
                setError(String(err));
              }
            }}
          />
        </label>
        <button className="btn" onClick={() => void setFactionArt(factionId, null)}>
          Use crest
        </button>
      </div>
      {error && <p className="text-[var(--bad)]">{error}</p>}
    </div>
  );
}

function PlayerEditor({
  player,
  index,
  n,
  onChange,
}: {
  player: Player;
  index: FactionIndex;
  n: number;
  onChange: (p: Player) => void;
}) {
  const [open, setOpen] = useState(!player.factionId);
  const [showArt, setShowArt] = useState(false);
  const faction = index.factions.find((f) => f.id === player.factionId);
  const pts = listPoints(player.list);
  const update = async (patch: Partial<Player>) => {
    const next = { ...player, ...patch };
    if (patch.listText !== undefined && !next.factionId) {
      next.factionId = detectFaction(next.listText, index.factions) ?? '';
    }
    onChange(await parsePlayer(next));
  };
  return (
    <li className="panel p-3">
      <button
        className="flex w-full items-center gap-3 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <FactionArt
          factionId={player.factionId}
          name={faction?.name ?? '?'}
          grandAlliance={faction?.grandAlliance ?? ''}
          className="h-14 w-11 shrink-0 rounded"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{player.name}</span>
          <span className="muted block truncate text-sm">
            {faction
              ? `${faction.name} · ${pts} pts · ${player.list.units.length} units`
              : 'No faction yet'}
          </span>
        </span>
        <span className="muted" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`name-${n}`}>
                Player
              </label>
              <input
                id={`name-${n}`}
                className="input mt-1"
                value={player.name}
                onChange={(e) => onChange({ ...player, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor={`faction-${n}`}>
                Faction
              </label>
              <div className="mt-1">
                <FactionSelect
                  id={`faction-${n}`}
                  index={index}
                  value={player.factionId}
                  onChange={(factionId) => void update({ factionId })}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="label" htmlFor={`list-${n}`}>
              Army list (paste from the GW app, New Recruit or BCP)
            </label>
            <textarea
              id={`list-${n}`}
              className="input mt-1 h-40 font-mono text-sm"
              value={player.listText}
              placeholder={'Liberators (180)\n• Reinforced\nKnight-Arcanum (110)\n…'}
              onChange={(e) => onChange({ ...player, listText: e.target.value })}
              onBlur={() => void update({ listText: player.listText })}
            />
          </div>
          {player.list.units.length > 0 && (
            <p className="text-sm">
              <span className="chip mr-1">{analyseList(player.list).archetype}</span>
              <span className="muted">
                {player.list.units.length} units matched
                {player.list.rules?.formation ? ` · ${player.list.rules.formation.name}` : ''}
                {player.list.manifestationLore ? ` · ${player.list.manifestationLore}` : ''}
              </span>
            </p>
          )}
          {player.list.formation && player.list.rules && !player.list.rules.formation && (
            <p className="text-sm text-amber-300">
              Battle formation “{player.list.formation}” isn't in the {faction?.name} battletome.
            </p>
          )}
          {player.list.pointsMismatches && (
            <div className="rounded-lg border border-amber-700/60 bg-amber-900/20 p-2 text-sm">
              <p className="font-semibold text-amber-300">
                Points differ from the BSData catalogue (catalogue values are used):
              </p>
              <ul className="list-disc pl-5">
                {player.list.pointsMismatches.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {player.list.unmatched.length > 0 && (
            <div className="rounded-lg border border-amber-700/60 bg-amber-900/20 p-2 text-sm">
              <p className="font-semibold text-amber-300">
                Not found in the {faction?.name ?? 'faction'} catalogue:
              </p>
              <ul className="list-disc pl-5">
                {player.list.unmatched.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          )}
          {player.factionId && (
            <div>
              <button className="btn text-sm" onClick={() => setShowArt(!showArt)}>
                {showArt ? 'Done with artwork' : 'Set faction artwork'}
              </button>
              {showArt && <ArtEditor factionId={player.factionId} />}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function TeamSetup() {
  const { state, dispatch } = useApp();
  const { index, error, faction } = useCatalog();
  const [side, setSide] = useState<'A' | 'B'>('A');
  const pack = getPack(state.packId);
  const team = state.teams[side];
  const setTeam = (t: Team) => dispatch({ type: 'setTeam', side, team: t });

  if (error) return <p className="panel text-[var(--bad)]">Could not load faction data: {error}</p>;
  if (!index) return <p className="panel muted">Loading factions…</p>;

  const issues = validateTeam(team, pack.pointsLimit, (id) => faction(id)?.name ?? id);
  const ready = teamReady(state.teams.A) && teamReady(state.teams.B);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="tablist">
        {(['A', 'B'] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={side === s}
            className={side === s ? 'btn-primary' : 'btn'}
            onClick={() => setSide(s)}
          >
            {s === 'A' ? 'Your team' : 'Opponent (NPC)'}
          </button>
        ))}
      </div>
      <div>
        <label className="label" htmlFor="team-name">
          Team name
        </label>
        <input
          id="team-name"
          className="input mt-1"
          value={team.name}
          onChange={(e) => setTeam({ ...team, name: e.target.value })}
        />
      </div>
      <ul className="space-y-2">
        {team.players.map((p, i) => (
          <PlayerEditor
            key={`${side}-${i}`}
            n={i}
            player={p}
            index={index}
            onChange={(np) =>
              setTeam({ ...team, players: team.players.map((x, j) => (j === i ? np : x)) })
            }
          />
        ))}
      </ul>
      {issues.length > 0 && (
        <div className="panel border-amber-700/60 text-sm">
          <p className="mb-1 font-semibold text-amber-300">Team rule warnings</p>
          <ul className="list-disc pl-5">
            {issues.map((i) => (
              <li key={i.message}>{i.message}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        className="btn-primary w-full"
        disabled={!ready}
        onClick={() => dispatch({ type: 'go', screen: 'round' })}
      >
        {ready ? 'Choose round' : 'Both teams need 5 factions with lists'}
      </button>
    </div>
  );
}
