/**
 * Matching runs here so a catastrophically backtracking pattern (the classic
 * `(a+)+$`) freezes a worker the client can terminate instead of the page.
 * All the real work is in logic.ts; this file is only the message plumbing.
 */
import { type RegexRequest, type RegexResult, runRegex } from './logic';

export interface WorkerRequest extends RegexRequest {
  id: number;
}

export type WorkerResponse =
  /** Sent once on startup so the client's timeout measures matching, not module loading. */
  { ready: true } | { ready?: false; id: number; result: RegexResult };

const post = (message: WorkerResponse): void => {
  (self as unknown as Worker).postMessage(message);
};

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, ...request } = event.data;
  post({ id, result: runRegex(request) });
});

post({ ready: true });
