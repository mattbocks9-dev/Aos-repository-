import type { FactionData, FactionIndex } from './types';

const base = import.meta.env.BASE_URL;
let indexPromise: Promise<FactionIndex> | undefined;
const factionCache = new Map<string, Promise<FactionData>>();

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`failed to load ${path}: ${res.status}`);
  return (await res.json()) as T;
}

export function loadIndex(): Promise<FactionIndex> {
  indexPromise ??= fetchJson<FactionIndex>('data/index.json');
  return indexPromise;
}

export function loadFaction(id: string): Promise<FactionData> {
  let p = factionCache.get(id);
  if (!p) {
    p = fetchJson<FactionData>(`data/factions/${id}.json`);
    factionCache.set(id, p);
  }
  return p;
}
