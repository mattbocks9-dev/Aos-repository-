// User-supplied faction art (battletome covers etc.), kept in the browser only.
// Stored in IndexedDB so uploaded images don't hit localStorage limits.
import { useEffect, useState } from 'react';

const DB = 'aos-pairing';
const STORE = 'art';
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
let loaded: Promise<void> | undefined;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function loadAll(): Promise<void> {
  loaded ??= (async () => {
    try {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return resolve();
          memory.set(String(cursor.key), String(cursor.value));
          cursor.continue();
        };
        req.onerror = () => reject(req.error);
      });
      listeners.forEach((l) => l());
    } catch {
      // No IndexedDB (private mode, tests): art lives in memory for this session.
    }
  })();
  return loaded;
}

export async function setFactionArt(factionId: string, src: string | null): Promise<void> {
  if (src) memory.set(factionId, src);
  else memory.delete(factionId);
  listeners.forEach((l) => l());
  try {
    const db = await open();
    const tx = db.transaction(STORE, 'readwrite');
    if (src) tx.objectStore(STORE).put(src, factionId);
    else tx.objectStore(STORE).delete(factionId);
  } catch {
    // Keep the in-memory copy.
  }
}

export function useFactionArt(factionId: string): string | undefined {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((t) => t + 1);
    listeners.add(l);
    void loadAll();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return memory.get(factionId);
}

/** Downscale an uploaded image to keep storage small. */
export function fileToDataUrl(file: File, maxSize = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}
