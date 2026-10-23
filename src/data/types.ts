export interface WeaponData {
  name: string;
  kind: 'melee' | 'ranged';
  range: number;
  attacks: string;
  hit: number;
  wound: number;
  rend: number;
  damage: string;
  ability?: string;
}

export type AbilityKind = 'passive' | 'activated' | 'spell' | 'prayer' | 'command';

export interface AbilityData {
  name: string;
  kind: AbilityKind;
  /** Ability colour category: Offensive, Defensive, Movement, Shooting, Control, Special... */
  category?: string;
  timing?: string;
  /** Casting value for spells, chanting value for prayers. */
  castingValue?: number;
  declare?: string;
  effect: string;
}

/** A named option from a battletome: a formation, lore, heroic trait or artefact. */
export interface RuleOption {
  name: string;
  /** Points cost from the catalogue, when the option has one (e.g. manifestation lores). */
  points?: number;
  abilities: AbilityData[];
}

export interface FactionRules {
  battleTraits: AbilityData[];
  formations: RuleOption[];
  heroicTraits: RuleOption[];
  artefacts: RuleOption[];
  spellLores: RuleOption[];
  prayerLores: RuleOption[];
  manifestationLores: RuleOption[];
}

export interface UnitData {
  name: string;
  points: number;
  move: number;
  health: number;
  save: number;
  control: number;
  models: number;
  ward: number;
  wizard: number;
  priest: number;
  keywords: string[];
  weapons: WeaponData[];
  abilities: AbilityData[];
}

export interface FactionData {
  id: string;
  name: string;
  grandAlliance: string;
  units: UnitData[];
  rules: FactionRules;
}

export interface FactionIndexEntry {
  id: string;
  name: string;
  grandAlliance: string;
  unitCount: number;
}

export interface FactionIndex {
  source: { repo: string; commit: string };
  factions: FactionIndexEntry[];
}
