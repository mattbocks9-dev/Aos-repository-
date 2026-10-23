// Runs the NPC captain in a Web Worker so solving never blocks the UI.
// Falls back to the main thread where workers are unavailable (tests).
import { getProtocol } from '../pairing/registry';
import { NpcCaptain, type CaptainDecision, type CaptainSetup, type MatchupTable } from './captain';

export interface NpcClient {
  init(): Promise<MatchupTable>;
  decide(state: unknown): Promise<CaptainDecision>;
  expectedEdge(state: unknown): Promise<number>;
  dispose(): void;
}

export function createNpcClient(protocolId: string, setup: CaptainSetup): NpcClient {
  if (typeof Worker === 'undefined') {
    let captain: NpcCaptain<unknown> | undefined;
    const get = () => (captain ??= new NpcCaptain(getProtocol(protocolId), setup));
    return {
      init: async () => get().table,
      decide: async (s) => get().decide(s),
      expectedEdge: async (s) => get().expectedEdge(s),
      dispose: () => undefined,
    };
  }
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  let next = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error) p.reject(new Error(e.data.error));
    else p.resolve(e.data.result);
  };
  const call = <T>(msg: Record<string, unknown>) =>
    new Promise<T>((resolve, reject) => {
      const id = next++;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ ...msg, id });
    });
  return {
    init: async () =>
      (await call<{ table: MatchupTable }>({ type: 'init', protocolId, setup })).table,
    decide: (state) => call<CaptainDecision>({ type: 'decide', state }),
    expectedEdge: (state) => call<number>({ type: 'expected', state }),
    dispose: () => worker.terminate(),
  };
}
