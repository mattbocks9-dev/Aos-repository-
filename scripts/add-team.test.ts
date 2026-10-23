import { addToLibrary } from './add-team';
import type { LibraryTeam } from '../src/data/teamLibrary';

const team = (id: string, submittedBy?: string): LibraryTeam => ({
  id,
  name: id,
  submittedBy,
  players: [],
});

describe('adding approved teams to the library', () => {
  it('appends a new team', () => {
    expect(addToLibrary([team('a')], team('b', 'x')).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('replaces a team its submitter resubmits', () => {
    const lib = addToLibrary([team('a', 'x')], { ...team('a', 'x'), notes: 'v2' });
    expect(lib).toHaveLength(1);
    expect(lib[0]!.notes).toBe('v2');
  });

  it('gives a clashing name from someone else a unique id instead of overwriting', () => {
    const lib = addToLibrary([team('a', 'x'), team('a-2', 'y')], team('a', 'z'));
    expect(lib.map((t) => t.id)).toEqual(['a', 'a-2', 'a-3']);
  });
});
