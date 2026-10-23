import { getPack, PACKS } from './registry';

describe('tournament packs', () => {
  it('ships OTTD Teams 2026 with its five-round mission table', () => {
    const pack = getPack('ottd-2026');
    expect(pack.teamSize).toBe(5);
    expect(pack.protocol).toBe('guardian-invader-v1');
    expect(pack.rounds).toHaveLength(5);
    expect(pack.rounds[0]!.battleplans).toEqual({
      A: 'into-the-fire',
      B: 'bloodstained-coasts',
      C: 'avalanche-of-ash',
    });
    expect(pack.rounds[4]!.battleplans.C).toBe('treacherous-ground');
  });

  it('references only battleplans that exist', () => {
    for (const pack of PACKS) {
      for (const r of pack.rounds) {
        for (const id of Object.values(r.battleplans)) {
          expect(pack.battleplans[id], `${pack.id} round ${r.round} ${id}`).toBeDefined();
        }
      }
    }
  });
});
