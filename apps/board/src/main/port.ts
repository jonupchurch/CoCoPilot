import type { Server } from 'node:http';

import { HOST } from 'cocoapilot-contract';

/** Every port in the range was taken. The board cannot start. */
export class PortRangeExhaustedError extends Error {
  readonly ports: readonly number[];

  constructor(ports: readonly number[]) {
    super(`no free port in ${ports.join(', ')}`);
    this.name = 'PortRangeExhaustedError';
    this.ports = ports;
  }
}

/**
 * Claim the first free port in the list, in order.
 *
 * A client probes the same list in the same order and takes the first responder
 * that identifies itself as CoCoapilot, so this ordering is the whole discovery
 * mechanism — nothing is written to disk to record the choice (decision 21).
 *
 * A port of `0` asks the OS for an ephemeral one, which is how the test suite
 * avoids colliding with a board running on the same machine.
 */
export function listenOnFirstFree(server: Server, ports: readonly number[]): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let index = 0;

    const attempt = (): void => {
      const port = ports[index];
      if (port === undefined) {
        reject(new PortRangeExhaustedError(ports));
        return;
      }

      const onError = (error: NodeJS.ErrnoException): void => {
        if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
          index += 1;
          attempt();
          return;
        }
        reject(error);
      };

      server.once('error', onError);
      server.listen({ host: HOST, port }, () => {
        server.removeListener('error', onError);
        const address = server.address();
        resolve(typeof address === 'object' && address !== null ? address.port : port);
      });
    };

    attempt();
  });
}
