// Turns a battleplan's map into the handful of numbers the NPC reasons with.
// All traits are in 0..1.
import type { Battleplan, Point, Territory, TraitName } from './types';

export type BattleplanTraits = Record<TraitName, number>;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function insidePolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2);
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function distanceToPolygon(p: Point, poly: Point[]): number {
  if (insidePolygon(p, poly)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    best = Math.min(best, distanceToSegment(p, poly[i]!, poly[(i + 1) % poly.length]!));
  }
  return best;
}

/** Distance to the nearest of a territory's polygons (0 inside). */
export function distanceToTerritory(p: Point, t: Territory): number {
  return Math.min(...t.map((poly) => distanceToPolygon(p, poly)));
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function battleplanTraits(bp: Battleplan): BattleplanTraits {
  const { width, height } = bp.board;
  const diagonal = Math.hypot(width, height);
  const centre = { x: width / 2, y: height / 2 };
  const objs = bp.objectives;

  const fromAttacker = objs.map((o) => distanceToTerritory(o, bp.deployment.attacker));
  const fromDefender = objs.map((o) => distanceToTerritory(o, bp.deployment.defender));

  // Gap between territories: closest approach of any corner of one to the other.
  const corners = (t: Territory) => t.flat();
  const gap = Math.min(
    ...corners(bp.deployment.defender).map((p) => distanceToTerritory(p, bp.deployment.attacker)),
    ...corners(bp.deployment.attacker).map((p) => distanceToTerritory(p, bp.deployment.defender)),
  );
  // Obscuring terrain outside both territories blocks firing lanes across the middle.
  const blockers = (bp.terrain ?? []).filter(
    (t) =>
      t.kind === 'obscuring' &&
      distanceToTerritory(t, bp.deployment.attacker) > 0 &&
      distanceToTerritory(t, bp.deployment.defender) > 0,
  ).length;

  const pairwise: number[] = [];
  objs.forEach((a, i) => objs.slice(i + 1).forEach((b) => pairwise.push(dist(a, b))));

  const traits: BattleplanTraits = {
    // How far armies must travel to reach objectives (furthest-half average).
    mobility: clamp(mean([...fromAttacker, ...fromDefender]) / 20),
    objectiveSpread: clamp(mean(pairwise) / (diagonal * 0.6)),
    controlPressure: clamp((objs.length - 1) / 5),
    // Territories often touch, so lanes come mostly from distance to objectives and open ground.
    shootingLanes: clamp(
      (gap / 30 + mean([...fromAttacker, ...fromDefender]) / 30) * (1 - 0.15 * blockers),
    ),
    centreFocus: objs.length ? objs.filter((o) => dist(o, centre) <= 10).length / objs.length : 0,
    // The attacker picks which territory is theirs, so any imbalance between them favours the attacker.
    attackerEdge: clamp(Math.abs(mean(fromDefender) - mean(fromAttacker)) / 15),
  };

  for (const [k, v] of Object.entries(bp.traitOverrides ?? {})) {
    const name = k as TraitName;
    traits[name] = clamp(traits[name] + v);
  }
  return traits;
}
