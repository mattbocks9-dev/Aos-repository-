// Turns a battleplan's map into the handful of numbers the NPC reasons with.
// All traits are in 0..1, except attackerEdge which is -1..1 (positive = attacker-favoured).
import type { Battleplan, Point, TraitName } from './types';

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

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function battleplanTraits(bp: Battleplan): BattleplanTraits {
  const { width, height } = bp.board;
  const diagonal = Math.hypot(width, height);
  const centre = { x: width / 2, y: height / 2 };
  const objs = bp.objectives.filter((o) => !o.special);

  const fromAttacker = objs.map((o) => distanceToPolygon(o, bp.deployment.attacker));
  const fromDefender = objs.map((o) => distanceToPolygon(o, bp.deployment.defender));

  // Gap between zones: closest approach of any defender vertex to the attacker zone.
  const gap = Math.min(
    ...bp.deployment.defender.map((p) => distanceToPolygon(p, bp.deployment.attacker)),
    ...bp.deployment.attacker.map((p) => distanceToPolygon(p, bp.deployment.defender)),
  );

  const pairwise: number[] = [];
  objs.forEach((a, i) => objs.slice(i + 1).forEach((b) => pairwise.push(dist(a, b))));

  const traits: BattleplanTraits = {
    // How far armies must travel to reach objectives (furthest-half average).
    mobility: clamp(mean([...fromAttacker, ...fromDefender]) / 20),
    objectiveSpread: clamp(mean(pairwise) / (diagonal * 0.6)),
    controlPressure: clamp((objs.length - 1) / 5),
    shootingLanes: clamp(gap / 30),
    centreFocus: objs.length ? objs.filter((o) => dist(o, centre) <= 10).length / objs.length : 0,
    attackerEdge: clamp((mean(fromDefender) - mean(fromAttacker)) / 15, -1, 1),
  };

  for (const [k, v] of Object.entries(bp.traitOverrides ?? {})) {
    const name = k as TraitName;
    traits[name] = clamp(traits[name] + v, name === 'attackerEdge' ? -1 : 0, 1);
  }
  return traits;
}
