import { battleplanByName, GHB_BATTLE_TACTICS, GHB_BATTLEPLANS } from '.';

const OBJECTIVE_KINDS = ['Sun Seekers', 'Golden Lions', 'Heldenhain', 'Scions of the Comet'];

describe("General's Handbook 2026-27 data", () => {
  const plans = Object.values(GHB_BATTLEPLANS);

  it('has all 12 battleplans numbered 1-12, filed by name', () => {
    expect(plans.map((p) => p.number).sort((a, b) => a! - b!)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(battleplanByName("What's Yours is Ours")?.number).toBe(5);
    expect(battleplanByName('Escape From the Coast')?.id).toBe('escape-from-the-coast');
    expect(battleplanByName('Hidden Under Ash-clouds')?.number).toBe(6);
  });

  for (const p of Object.values(GHB_BATTLEPLANS)) {
    it(`${p.name}: map geometry and rules are complete`, () => {
      expect(p.board).toEqual({ width: 60, height: 44 });
      expect(p.deployment.attacker.length).toBeGreaterThan(0);
      expect(p.deployment.defender.length).toBeGreaterThan(0);
      expect(p.objectives.length).toBeGreaterThanOrEqual(4);
      for (const o of p.objectives) {
        expect(OBJECTIVE_KINDS).toContain(o.kind);
        expect(o.x).toBeGreaterThan(0);
        expect(o.x).toBeLessThan(60);
        expect(o.y).toBeGreaterThan(0);
        expect(o.y).toBeLessThan(44);
      }
      expect(p.terrain).toHaveLength(8); // GHB: 4 small + 4 medium terrain features
      expect(p.twist.length).toBeGreaterThan(20);
      expect(p.abilities.length).toBeGreaterThan(0);
      expect(p.scoring.length).toBeGreaterThanOrEqual(3);
      for (const line of p.scoring) expect(line).toMatch(/victory points/);
      expect(p.imageUrl).toMatch(/^https:\/\/wahapedia\.ru\/aos4\/img\/battleplans\/.+\.png$/);
    });
  }

  it('has the six battle tactics cards, each with Affray, Strike and Domination', () => {
    expect(GHB_BATTLE_TACTICS.map((c) => c.name)).toEqual([
      'Blazing Onslaught',
      'Siege of Ashes',
      'Flanking Firestorm',
      'Smokescreen',
      'Burning for Vengeance',
      'Legend of The Parch',
    ]);
    for (const card of GHB_BATTLE_TACTICS) {
      expect(card.tactics.map((t) => t.type)).toEqual(['Affray', 'Strike', 'Domination']);
      for (const t of card.tactics) {
        expect(t.condition).toMatch(/^You complete this battle tactic/);
        expect(t.victoryPoints).toBe(5);
      }
    }
  });
});
