import { guardianInvader } from './guardianInvader';
import type { PairingProtocol } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PROTOCOLS: Record<string, PairingProtocol<any>> = {
  [guardianInvader.id]: guardianInvader,
};

export function getProtocol(id: string) {
  const p = PROTOCOLS[id];
  if (!p) throw new Error(`unknown pairing protocol ${id}`);
  return p;
}
