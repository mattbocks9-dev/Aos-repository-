export interface Point {
  x: number;
  y: number;
}

export interface Objective extends Point {
  id: string;
  /** Free-text label shown on the map, e.g. "Ember", "Gnaw-hole". */
  label?: string;
  /** Objectives that only exist / score under special rules. */
  special?: boolean;
}

/** A battleplan as data, with coordinates in inches; the origin is the top-left of the board. */
export interface Battleplan {
  id: string;
  name: string;
  /** False until checked against the General's Handbook. */
  verified: boolean;
  board: { width: number; height: number };
  deployment: { attacker: Point[]; defender: Point[] };
  objectives: Objective[];
  /** Short summaries of how VP are scored. */
  scoring: string[];
  /** Summary of the battleplan's special rule. */
  specialRule?: string;
  /** Hand-tuned nudges to the derived traits, in the range -1..1. */
  traitOverrides?: Partial<Record<TraitName, number>>;
}

export type TraitName =
  | 'mobility'
  | 'objectiveSpread'
  | 'controlPressure'
  | 'shootingLanes'
  | 'centreFocus'
  | 'attackerEdge';

export interface RoundSpec {
  round: number;
  battleplans: Record<string, string>;
}

export interface TeamRule {
  id: string;
  description: string;
}

export interface TournamentPack {
  id: string;
  name: string;
  teamSize: number;
  pointsLimit: number;
  protocol: string;
  /** Labels of the protocol's battleplan slots, in play order. */
  slots: string[];
  rounds: RoundSpec[];
  battleplans: Record<string, Battleplan>;
  teamRules: TeamRule[];
  /** Pairing rules text shown in the app. */
  pairingSummary: string[];
}
