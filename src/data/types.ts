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
}

export interface FactionData {
  id: string;
  name: string;
  grandAlliance: string;
  units: UnitData[];
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
