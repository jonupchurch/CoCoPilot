import { createServer, type Server } from 'node:http';

import { HOST } from 'cocoapilot-contract';
import { afterEach, describe, expect, it } from 'vitest';

import { listenOnFirstFree, PortRangeExhaustedError } from '../../src/main/port.js';

const open: Server[] = [];

function server(): Server {
  const instance = createServer(() => {});
  open.push(instance);
  return instance;
}

function close(instance: Server): Promise<void> {
  return new Promise((resolve) => {
    instance.close(() => {
      resolve();
    });
    instance.closeAllConnections();
  });
}

afterEach(async () => {
  await Promise.all(open.splice(0).map(close));
});

describe('claiming a port', () => {
  it('takes the first port in the list when it is free', async () => {
    const first = await listenOnFirstFree(server(), [0]);
    expect(first).toBeGreaterThan(0);
  });

  it('walks up the range when the base is taken', async () => {
    const blocker = server();
    const taken = await listenOnFirstFree(blocker, [0]);

    const claimed = await listenOnFirstFree(server(), [taken, 0]);

    expect(claimed).not.toBe(taken);
  });

  it('reports exhaustion rather than hanging when every port is taken', async () => {
    const blocker = server();
    const taken = await listenOnFirstFree(blocker, [0]);

    // The same occupied port five times over stands in for a full range.
    const range = [taken, taken, taken, taken, taken];
    await expect(listenOnFirstFree(server(), range)).rejects.toBeInstanceOf(
      PortRangeExhaustedError,
    );
  });

  it('names the range it tried, so the failure is actionable', async () => {
    const blocker = server();
    const taken = await listenOnFirstFree(blocker, [0]);

    const error = await listenOnFirstFree(server(), [taken]).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PortRangeExhaustedError);
    expect((error as PortRangeExhaustedError).message).toContain(String(taken));
  });

  it('rejects immediately on an empty range', async () => {
    await expect(listenOnFirstFree(server(), [])).rejects.toBeInstanceOf(PortRangeExhaustedError);
  });

  it('binds the loopback address and nothing else', async () => {
    const instance = server();
    await listenOnFirstFree(instance, [0]);

    const address = instance.address();
    expect(typeof address === 'object' && address !== null ? address.address : null).toBe(HOST);
  });
});
