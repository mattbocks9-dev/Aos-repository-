import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { Team } from '../data/team';
import type { Difficulty } from '../npc/captain';

export type Screen = 'home' | 'teams' | 'round' | 'pairing' | 'results';

export interface GameResult {
  pairings: { a: number; b: number; slot: string; guardian: 'A' | 'B' | null; npcEdge: number }[];
  startExpectation: number;
  log: LogEntry[];
}

export interface LogEntry {
  step: string;
  you: string;
  npc: string;
  reasoning: string;
}

export interface AppState {
  packId: string;
  round: number;
  difficulty: Difficulty;
  screen: Screen;
  teams: { A: Team; B: Team };
  result?: GameResult;
}

const emptyTeam = (name: string): Team => ({
  name,
  players: Array.from({ length: 5 }, (_, i) => ({
    name: `Player ${i + 1}`,
    factionId: '',
    listText: '',
    list: { units: [], unmatched: [] },
  })),
});

export const initialState: AppState = {
  packId: 'ottd-2026',
  round: 1,
  difficulty: 'normal',
  screen: 'home',
  teams: { A: emptyTeam('Your team'), B: emptyTeam('Opponents') },
};

export type Action =
  | { type: 'go'; screen: Screen }
  | { type: 'setRound'; round: number }
  | { type: 'setDifficulty'; difficulty: Difficulty }
  | { type: 'setTeam'; side: 'A' | 'B'; team: Team }
  | { type: 'finish'; result: GameResult };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'go':
      return { ...state, screen: action.screen };
    case 'setRound':
      return { ...state, round: action.round };
    case 'setDifficulty':
      return { ...state, difficulty: action.difficulty };
    case 'setTeam':
      return { ...state, teams: { ...state.teams, [action.side]: action.team } };
    case 'finish':
      return { ...state, result: action.result, screen: 'results' };
  }
}

const KEY = 'aos-pairing:v1';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<AppState>;
      // Never resume mid-pairing: the NPC worker state isn't persisted.
      const screen = saved.screen === 'pairing' ? 'round' : (saved.screen ?? 'home');
      return { ...initialState, ...saved, screen };
    }
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return initialState;
}

const Ctx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked; the app still works for this session.
    }
  }, [state]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
}
