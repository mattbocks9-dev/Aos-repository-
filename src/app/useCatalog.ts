import { useEffect, useState } from 'react';
import { loadIndex } from '../data/catalog';
import type { FactionIndex } from '../data/types';

export function useCatalog() {
  const [index, setIndex] = useState<FactionIndex>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    loadIndex().then(setIndex, (e: unknown) => setError(String(e)));
  }, []);
  const faction = (id: string) => index?.factions.find((f) => f.id === id);
  return { index, error, faction };
}
