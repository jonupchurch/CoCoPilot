import { createServer, type Server } from 'node:http';

import { createService, type Service } from '@cocopilot/board';

/**
 * A real board, and things that are not a board.
 *
 * Discovery takes its port list as a parameter precisely so tests can build one
 * of these instead of fighting whatever is on 41847 on the developer's machine.
 */

export interface Stub {
  port: number;
  /** Every request this stub received. Expected to stay empty in most tests. */
  readonly hits: Array<{ method: string; url: string }>;
  close(): Promise<void>;
}

/** A board on an ephemeral port. */
export async function startBoard(): Promise<Service> {
  return createService({ port: 0 });
}

/** Unrelated local software that answers 200 to everything. */
export async function startStub(
  respond: (url: string) => { status: number; body: string } = () => ({
    status: 200,
    body: '{}',
  }),
): Promise<Stub> {
  const hits: Array<{ method: string; url: string }> = [];

  const server = createServer((req, res) => {
    hits.push({ method: req.method ?? 'GET', url: req.url ?? '/' });
    const reply = respond(req.url ?? '/');
    res.writeHead(reply.status, { 'content-type': 'application/json' });
    res.end(reply.body);
  });

  const port = await listen(server);
  return { port, hits, close: () => close(server) };
}

/** Accepts connections and then says nothing, so a probe has to time out. */
export async function startBlackHole(): Promise<{ port: number; close(): Promise<void> }> {
  const server = createServer(() => {
    // Deliberately no response.
  });
  const port = await listen(server);
  return { port, close: () => close(server) };
}

/** A port nothing is listening on. */
export async function closedPort(): Promise<number> {
  const server = createServer(() => {});
  const port = await listen(server);
  await close(server);
  return port;
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = server.address();
      resolve(typeof address === 'object' && address !== null ? address.port : 0);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
    server.closeAllConnections();
  });
}
