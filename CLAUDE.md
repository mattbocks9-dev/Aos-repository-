# AoS Pairing Trainer

A static web app (Vite + React + TS) for practising Age of Sigmar team pairings against an NPC captain.

## Hook-driven workflow

Hooks in `.claude/settings.json` run automatically:

- **SessionStart** (`.claude/hooks/session-start.sh`) installs dependencies when the lockfile changes.
- **PostToolUse** on Edit/Write (`post-edit.sh`) runs prettier + eslint on the edited TS file and a project typecheck. Exit 2 means you must fix the reported errors now.
- **Stop** (`stop-gate.sh`) runs `vitest`. You cannot finish a turn with red tests.

Work in small slices: write or extend a failing test, implement, let the hooks verify, commit.

## Commands

- `npm run dev`: dev server. `npm run build`: production build (set `PAGES_BASE=/repo-name/` for Pages).
- `npm test`: unit tests. `npm run e2e`: Playwright. In the cloud sandbox, prefix with
  `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` and never run `playwright install`.
- `npm run data`: regenerates `public/data` from the BSData commit pinned in `data/bsdata.lock.json`.
  `npm run data -- --latest` moves the pin to BSData's current `main` first.

## Architecture

- `src/packs/`: tournament packs as data (`TournamentPack`), battleplans as map geometry, and
  `traits.ts`, which derives the NPC's map traits from that geometry. New pack = new folder + entry in `registry.ts`.
- `src/pairing/`: pairing protocols (`PairingProtocol`, a simultaneous-move step machine).
  `guardianInvader.ts` implements OTTD 2026. UI and solver depend only on the interface.
- `src/data/`: BSData-derived catalogue types, list parser (resolves formation and lores against the
  battletome), list feature analysis, `abilityAnalysis.ts` (reads mortal damage, deep strike, healing and
  conditional wards from ability text), team rule checks, and sample teams.
- Faction JSON holds units (stats, weapons, keywords, points, abilities/spells) and battletome `rules`
  (battle traits, formations, heroic traits, artefacts, spell/prayer/manifestation lores) from BSData
  `BSData/age-of-sigmar-4th`. Generic/realm tables, hidden legacy groups, `[LEGENDS]` catalogues and
  units in BSData's `Legends` category are deliberately excluded.
- `src/npc/`: matchup model (`matchup.ts`), zero-sum matrix solver, full-tree solver, captain
  (difficulty + reasoning), and the Web Worker client.
- `src/ui/`: screens and components. `src/app/`: store (localStorage-persisted) and helpers.

## Data and copyright

- **Single source of truth:** factions, grand alliances, units, stats, weapons, points, abilities, spells,
  battle traits, formations, enhancements and lores all come from `BSData/age-of-sigmar-4th` via
  `npm run data`. Never hand-edit `public/data` or add hand-written unit/points data; CI regenerates the data and
  fails on any diff. Pasted list points are only compared against the catalogue, never used.

- BSData catalogues are pinned and transformed at build time; only derived JSON is committed.
- GW battletome art and the General's Handbook are copyrighted: never commit them. Users add art in-app
  (stored in IndexedDB). GHB-derived battleplan data must be summaries and geometry only; keep source PDFs in
  the git-ignored `rules-source/`.
- Battleplans in `src/packs/ottd2026/battleplans.ts` are placeholders (`verified: false`) until filled from the GHB.
