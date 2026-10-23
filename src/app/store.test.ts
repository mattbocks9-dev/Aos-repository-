import { initialState, reducer } from './store';
import type { Player } from '../data/team';

const player = (listText: string, units = 0): Player => ({
  name: 'P',
  factionId: 'f',
  listText,
  list: {
    units: Array.from({ length: units }, () => ({ name: 'U', points: 10, reinforced: false })),
    unmatched: [],
  },
});

describe('re-parsing saved teams', () => {
  it('replaces stale parsed lists but keeps edits made in the meantime', () => {
    const state = {
      ...initialState,
      teams: {
        A: { name: 'A', players: [player('old text'), player('edited while parsing')] },
        B: { name: 'B', players: [player('b')] },
      },
    };
    const next = reducer(state, {
      type: 'reparsed',
      teams: {
        A: { name: 'A', players: [player('old text', 3), player('text before edit', 5)] },
        B: { name: 'B', players: [player('b', 2)] },
      },
    });
    expect(next.teams.A.players[0]!.list.units).toHaveLength(3);
    expect(next.teams.A.players[1]!.listText).toBe('edited while parsing');
    expect(next.teams.A.players[1]!.list.units).toHaveLength(0);
    expect(next.teams.B.players[0]!.list.units).toHaveLength(2);
  });
});
