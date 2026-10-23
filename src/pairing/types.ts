export type Side = 'A' | 'B';
/** Indices into a side's roster (or, for "choose" steps, into the opponent's roster). */
export type Move = number[];

export interface Pairing {
  a: number;
  b: number;
  /** Battleplan slot of the round (A/B/C in the OTTD pack). */
  slot: string;
  /** Which side's guardian this game was, or null for the leftover game. */
  guardian: Side | null;
}

export type StepKind = 'guardian' | 'invaders' | 'choose' | 'done';

export interface StepSpec {
  kind: StepKind;
  slot: string;
  simultaneous: boolean;
  /** Number of cards each side selects in this step. */
  count: number;
}

export interface PairingProtocol<S> {
  id: string;
  initial(teamSize: number): S;
  currentStep(s: S): StepSpec;
  legalMoves(s: S, side: Side): Move[];
  apply(s: S, moves: Record<Side, Move>): S;
  isTerminal(s: S): boolean;
  pairings(s: S): Pairing[];
  /** Canonical key of everything that affects the rest of the game (not locked pairings). */
  key(s: S): string;
}

export const other = (side: Side): Side => (side === 'A' ? 'B' : 'A');
