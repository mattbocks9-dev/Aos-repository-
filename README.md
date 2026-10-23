# AoS Pairing Trainer

> **Unofficial, free, open-source fan project made for fun.** Not affiliated with or endorsed by Games
> Workshop. See [NOTICE.md](NOTICE.md) for trademarks, data sources and disclaimers.

Practise Age of Sigmar team pairings against an NPC captain who reads both teams' lists and the round's battleplans.

- **Format:** Old Town Throwdown Teams 2026 (5-player Guardian/Invader pairing). Packs are pluggable.
- **Lists:** paste exports from the GW app, New Recruit or BCP; units are matched against the
  [BSData](https://github.com/BSData/age-of-sigmar-4th) catalogues.
- **NPC:** estimates every matchup from list features and battleplan geometry, then plays the
  pairing game with game-theory optimal (Hard), mostly optimal (Normal) or naive (Easy) strategies,
  and explains each pick after the reveal.
- Works on phones and desktops; everything runs in the browser.

```bash
npm install
npm run dev
```

See `CLAUDE.md` for architecture and the hook-driven development workflow.

## Shared team library

Teams in `src/data/team-library.json` appear in every user's **Load a saved team** dropdown. To add one,
use **Team Setup → Submit this team to the shared library** in the app: it validates the team and opens a
pre-filled GitHub issue. A maintainer approves it by commenting `/approve` on the issue (or adding the
`approved-team` label); the **Add approved team** workflow then re-validates it against the BSData
catalogue, adds it to the library and redeploys the site.

## Contributing

Issues and pull requests are welcome. The development workflow (Claude Code hooks, tests, data pipelines)
is described in `CLAUDE.md`.

## License

The original source code is released under the [MIT License](LICENSE). That license does **not** cover Games
Workshop intellectual property or the third-party data used by the app (BSData, Wahapedia); see
[NOTICE.md](NOTICE.md).

Warhammer Age of Sigmar and all associated names, marks and rules are © Games Workshop Limited, used without
permission in this non-commercial fan project. No challenge to their status is intended.
