import type { Server } from 'node:http';

import { PORT_RANGE } from 'cocoapilot-contract';

import { listenOnFirstFree } from './port.js';
import { createServer } from './server.js';
import { Store } from './store.js';

export interface ServiceOptions {
  /** A single port to claim. `0` asks the OS for an ephemeral one. */
  port?: number | undefined;
  /** An explicit ordered range to walk. Defaults to the contract's range. */
  ports?: readonly number[] | undefined;
  /** The clock. Injected only so tests can assert the service uses its own. */
  now?: (() => number) | undefined;
}

export interface Service {
  /** The port actually claimed, which a client discovers by probing. */
  readonly port: number;
  /**
   * The held state, read directly rather than over HTTP.
   *
   * The service and the window are the same application, so state notifies the
   * window in-process and the window reads it in-process (decision 28). There is
   * no HTTP read endpoint, and adding one would mean deciding who may read an
   * agent's prompt text over a socket — a question nothing currently asks.
   */
  readonly store: Store;
  close(): Promise<void>;
}

/**
 * Start the local service.
 *
 * This is the whole seam. Feature 003 calls it from the Electron main process
 * and bridges `store` to the renderer through a preload `contextBridge`; the
 * test suite calls it on an ephemeral port. Nothing here depends on Electron,
 * which is why the suite runs without one.
 */
export async function createService(options: ServiceOptions = {}): Promise<Service> {
  const store = new Store();
  const now = options.now ?? ((): number => Date.now());
  const server = createServer({ store, now });

  const candidates = options.ports ?? (options.port === undefined ? PORT_RANGE : [options.port]);
  const port = await listenOnFirstFree(server, candidates);

  return {
    port,
    store,
    close: () => closeServer(server),
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
    // Keep-alive sockets would otherwise hold `close` open until they idle out.
    server.closeAllConnections();
  });
}

export { PortRangeExhaustedError, listenOnFirstFree } from './port.js';
export { Store, UNATTRIBUTED, sessionKey } from './store.js';
export type { Note, Report, Session, StoreChange, StoreResult } from './store.js';
export type { HttpResult, ServiceDeps } from './server.js';
