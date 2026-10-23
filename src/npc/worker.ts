/// <reference lib="webworker" />
import { getProtocol } from '../pairing/registry';
import { NpcCaptain, type CaptainSetup } from './captain';

export type WorkerRequest =
  | { id: number; type: 'init'; protocolId: string; setup: CaptainSetup }
  | { id: number; type: 'decide'; state: unknown }
  | { id: number; type: 'expected'; state: unknown };

let captain: NpcCaptain<unknown> | undefined;

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      captain = new NpcCaptain(getProtocol(msg.protocolId), msg.setup);
      self.postMessage({ id: msg.id, result: { table: captain.table } });
    } else if (!captain) {
      throw new Error('captain not initialised');
    } else if (msg.type === 'decide') {
      self.postMessage({ id: msg.id, result: captain.decide(msg.state) });
    } else {
      self.postMessage({ id: msg.id, result: captain.expectedEdge(msg.state) });
    }
  } catch (err) {
    self.postMessage({ id: msg.id, error: String(err) });
  }
};
