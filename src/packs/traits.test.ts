import { battleplanTraits, distanceToPolygon } from './traits';
import type { Battleplan } from './types';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

const base: Battleplan = {
  id: 't',
  name: 'Test',
  verified: true,
  board: { width: 60, height: 44 },
  terrain: [],
  twist: '',
  abilities: [],
  notes: [],
  deployment: {
    attacker: [
      [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
        { x: 60, y: 10 },
        { x: 0, y: 10 },
      ],
    ],
    defender: [
      [
        { x: 0, y: 34 },
        { x: 60, y: 34 },
        { x: 60, y: 44 },
        { x: 0, y: 44 },
      ],
    ],
  },
  objectives: [{ id: 'c', kind: 'Heldenhain', x: 30, y: 22 }],
  scoring: [],
};

describe('battleplan traits', () => {
  it('measures distance to polygons', () => {
    expect(distanceToPolygon({ x: 5, y: 5 }, square)).toBe(0);
    expect(distanceToPolygon({ x: 13, y: 14 }, square)).toBe(5);
    expect(distanceToPolygon({ x: 5, y: -2 }, square)).toBe(2);
  });

  it('rewards centre focus and penalises spread for a single central objective', () => {
    const t = battleplanTraits(base);
    expect(t.centreFocus).toBe(1);
    expect(t.objectiveSpread).toBe(0);
    expect(t.attackerEdge).toBeCloseTo(0);
  });

  it('is all within range and responds to geometry', () => {
    const spread = battleplanTraits({
      ...base,
      objectives: [
        { id: 'a', kind: 'Sun Seekers', x: 2, y: 22 },
        { id: 'b', kind: 'Sun Seekers', x: 58, y: 22 },
        { id: 'c', kind: 'Sun Seekers', x: 30, y: 12 },
        { id: 'd', kind: 'Sun Seekers', x: 30, y: 32 },
        { id: 'e', kind: 'Sun Seekers', x: 10, y: 5 },
        { id: 'f', kind: 'Sun Seekers', x: 50, y: 40 },
      ],
    });
    const central = battleplanTraits(base);
    expect(spread.objectiveSpread).toBeGreaterThan(central.objectiveSpread);
    expect(spread.controlPressure).toBeGreaterThan(central.controlPressure);
    for (const v of Object.values(spread)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('detects territory imbalance, which favours the attacker who picks a side', () => {
    const t = battleplanTraits({
      ...base,
      objectives: [{ id: 'a', kind: 'Sun Seekers', x: 30, y: 12 }],
    });
    expect(t.attackerEdge).toBeGreaterThan(0);
    expect(
      battleplanTraits({ ...base, objectives: [{ id: 'a', kind: 'Sun Seekers', x: 30, y: 32 }] })
        .attackerEdge,
    ).toBeCloseTo(t.attackerEdge);
  });

  it('counts obscuring terrain between territories against shooting lanes', () => {
    const open = battleplanTraits(base).shootingLanes;
    const blocked = battleplanTraits({
      ...base,
      terrain: [
        { kind: 'obscuring', size: 'medium', x: 20, y: 22 },
        { kind: 'obscuring', size: 'medium', x: 40, y: 22 },
      ],
    }).shootingLanes;
    expect(blocked).toBeLessThan(open);
  });

  it('applies hand-tuned overrides with clamping', () => {
    const t = battleplanTraits({ ...base, traitOverrides: { mobility: 5 } });
    expect(t.mobility).toBe(1);
  });
});
