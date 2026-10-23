# AoS Pairing Trainer

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
