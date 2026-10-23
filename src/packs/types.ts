import type { AbilityData } from '../data/types';

export interface Point {
  x: number;
  y: number;
}

export type ObjectiveKind = 'Sun Seekers' | 'Golden Lions' | 'Heldenhain' | 'Scions of the Comet';

export interface Objective extends Point {
  id: string;
  /** Aqshian objective type (GHB 2026-27). Objectives control 3" around their centre. */
  kind: ObjectiveKind;
}

export interface TerrainLocation extends Point {
  kind: 'area' | 'obscuring' | 'placeOfPower';
  size: 'medium' | 'small';
}

/** A territory may be made of several rectangles; each polygon is a list of corner points. */
export type Territory = Point[][];

/** A battleplan as data, with coordinates in inches; the origin is the top-left of the board. */
export interface Battleplan {
  id: string;
  name: string;
  /** Battleplan number in its battlepack (e.g. 1-12 in the GHB 2026-27). */
  number?: number;
  /** False for placeholder layouts not taken from a source. */
  verified: boolean;
  board: { width: number; height: number };
  /** Red (attacker) and blue (defender) territory. The attacker picks which is theirs after setup. */
  deployment: { attacker: Territory; defender: Territory };
  objectives: Objective[];
  terrain: TerrainLocation[];
  twist: string;
  abilities: AbilityData[];
  /** How victory points are scored. */
  scoring: string[];
  /** FAQ and errata. */
  notes: string[];
  /** The original battleplan map picture and rules page. */
  imageUrl?: string;
  sourceUrl?: string;
  /** Hand-tuned nudges to the derived traits, in the range -1..1. */
  traitOverrides?: Partial<Record<TraitName, number>>;
}

export interface BattleTactic {
  type: 'Affray' | 'Strike' | 'Domination';
  name: string;
  flavour: string;
  condition: string;
  victoryPoints: number;
}

export interface BattleTacticsCard {
  number: number;
  name: string;
  flavour: string;
  setup?: string;
  tactics: BattleTactic[];
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
  battleTactics: BattleTacticsCard[];
  /** Where the battleplans and battle tactics come from. */
  rulesSource?: { name: string; url: string };
  teamRules: TeamRule[];
  /** Pairing rules text shown in the app. */
  pairingSummary: string[];
}
