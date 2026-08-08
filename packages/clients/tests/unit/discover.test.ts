import type { Service } from '@cocoapilot/board';
import { CONTRACT_VERSION } from 'cocoapilot-contract';
import { afterEach, describe, expect, it } from 'vitest';

import { CALL_BUDGET_MS, Deadline } from '../../src/deadline.js';
import { discover } from '../../src/discover.js';
import { closedPort, startBoard, startStub, type Stub } from '../helpers/harness.js';

const open: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(open.splice(0).map((item) => item.close()));
});

async function board(): Promise<Service> {
  const service = await startBoard();
  open.push(service);
  return service;
}

async function stub(...args: Parameters<typeof startStub>): Promise<Stub> {
  const created = await startStub(...args);
  open.push(created);
  return created;
}

const deadline = (): Deadline => new Deadline(CALL_BUDGET_MS);

describe('discovery', () => {
  it('finds a board on the first port', async () => {
    const service = await board();

    const found = await discover({ ports: [service.port], deadline: deadline() });

    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.port).toBe(service.port);
    expect(found.health.app).toBe('cocoapilot');
  });

  it('finds a board on the last port, having walked past the others', async () => {
    const service = await board();
    const ports = [await closedPort(), await closedPort(), service.port];

    const found = await discover({ ports, deadline: deadline() });

    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.port).toBe(service.port);
  });

  it('concludes absence when nothing answers', async () => {
    const ports = [await closedPort(), await closedPort(), await closedPort()];

    const found = await discover({ ports, deadline: deadline() });

    expect(found).toEqual({ ok: false, reason: 'absent' });
  });

  it('walks past a program that answers 200 without naming itself', async () => {
    // The check that stops an agent's prompt text being posted into unrelated
    // local software that merely happened to be listening.
    const impostor = await stub();
    const service = await board();

    const found = await discover({ ports: [impostor.port, service.port], deadline: deadline() });

    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.port).toBe(service.port);
    expect(impostor.hits.map((hit) => hit.method)).toEqual(['GET']);
  });

  it('walks past a program that names itself as something else', async () => {
    const impostor = await stub(() => ({
      status: 200,
      body: JSON.stringify({ app: 'grafana', version: '11.0.0', contract: 'v1' }),
    }));

    const found = await discover({ ports: [impostor.port], deadline: deadline() });

    expect(found).toEqual({ ok: false, reason: 'absent' });
  });

  it('walks past a 500 and a body that is not JSON', async () => {
    const broken = await stub(() => ({ status: 500, body: 'nope' }));
    const garbage = await stub(() => ({ status: 200, body: 'definitely not json' }));
    const service = await board();

    const found = await discover({
      ports: [broken.port, garbage.port, service.port],
      deadline: deadline(),
    });

    expect(found.ok).toBe(true);
  });

  it('reports a contract-version mismatch rather than calling the board absent', async () => {
    // Decision 27 accepts that a published client can drift from the installed
    // app. Accepting that is only reasonable while the drift is detectable.
    const future = await stub(() => ({
      status: 200,
      body: JSON.stringify({ app: 'cocoapilot', version: '9.0.0', contract: 'v9' }),
    }));

    const found = await discover({ ports: [future.port], deadline: deadline() });

    expect(found).toEqual({
      ok: false,
      reason: 'version-mismatch',
      port: future.port,
      boardContract: 'v9',
    });
    expect(CONTRACT_VERSION).not.toBe('v9');
  });

  it('stops when the budget is spent rather than probing on', async () => {
    const spent = new Deadline(0);
    const service = await board();

    const found = await discover({ ports: [service.port], deadline: spent });

    expect(found).toEqual({ ok: false, reason: 'absent' });
  });
});
