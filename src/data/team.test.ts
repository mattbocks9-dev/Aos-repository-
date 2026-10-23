import type { ArmyList } from './listParser';
import { validateTeam, type Player } from './team';

const list = (units: [string, number][], lore?: string): ArmyList => ({
  unmatched: [],
  manifestationLore: lore,
  units: units.map(([name, points]) => ({ name, points, reinforced: false })),
});
const player = (name: string, factionId: string, l: ArmyList): Player => ({
  name,
  factionId,
  listText: '',
  list: l,
});

describe('team validation', () => {
  it('flags duplicate factions, shared warscrolls, lores and points', () => {
    const issues = validateTeam(
      {
        name: 'T',
        players: [
          player(
            'Ann',
            'seraphon',
            list(
              [
                ['Saurus Warriors', 1500],
                ['Endless Spell', 600],
              ],
              'Morbid Conjuration',
            ),
          ),
          player('Bob', 'seraphon', list([['Saurus Warriors', 200]], 'morbid conjuration')),
        ],
      },
      2000,
      (id) => id,
    );
    expect(issues.map((i) => i.rule)).toEqual([
      'unique-faction',
      'no-shared-warscrolls',
      'unique-manifestation-lore',
      'points',
    ]);
  });

  it('passes a legal team', () => {
    expect(
      validateTeam(
        {
          name: 'T',
          players: [player('Ann', 'a', list([['X', 100]])), player('Bob', 'b', list([['Y', 100]]))],
        },
        2000,
        (id) => id,
      ),
    ).toEqual([]);
  });
});
