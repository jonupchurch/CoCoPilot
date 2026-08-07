import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Service } from '@cocoapilot/board';
import { MAX_TEXT } from '@cocoapilot/contract';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { note, report } from '../../src/client.js';
import { BOARD_ABSENT } from '../../src/messages.js';
import { closedPort, startBlackHole, startBoard, startStub, type Stub } from '../helpers/harness.js';

let repo: string;
const open: Array<{ close(): Promise<void> }> = [];

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'cocoapilot-softfail-'));
  mkdirSync(join(repo, '.git'), { recursive: true });
  writeFileSync(join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

afterEach(async () => {
  await Promise.all(open.splice(0).map((item) => item.close()));
  vi.restoreAllMocks();
});

/**
 * A monitoring tool that costs an agent turns, or sends it investigating a
 * failure that is not its problem, is worse than no monitoring tool. This is
 * what makes the product safe to leave installed.
 */
describe('when the board is not running', () => {
  it('returns the board-absent constant verbatim', async () => {
    const ports = [await closedPort(), await closedPort()];

    const result = await report({ task: 'T012' }, { ports, cwd: repo, sessionId: 'a1' });

    expect(result).toEqual({ kind: 'no-board', message: BOARD_ABSENT });
  });

  it('says the three things it has to say', () => {
    expect(BOARD_ABSENT).toMatch(/not running/i);
    expect(BOARD_ABSENT).toMatch(/continue working/i);
    expect(BOARD_ABSENT).toMatch(/no need to retry/i);
  });

  it('tries each port exactly once — nothing is retried', async () => {
    const first = await startStub(() => ({ status: 200, body: '{}' }));
    const second = await startStub(() => ({ status: 200, body: '{}' }));
    open.push(first, second);

    await report({ task: 'T012' }, { ports: [first.port, second.port], cwd: repo, sessionId: 'a1' });

    expect(first.hits).toHaveLength(1);
    expect(second.hits).toHaveLength(1);
  });

  it('queues nothing — a later call with a board sends only the later report', async () => {
    const ports = [await closedPort()];
    await report({ task: 'undelivered' }, { ports, cwd: repo, sessionId: 'a1' });

    const board = await startBoard();
    open.push(board);
    await report({ task: 'delivered' }, { ports: [board.port], cwd: repo, sessionId: 'a1' });

    expect(board.store.getSession(repo, 'a1')?.report?.focus?.task).toBe('delivered');
    expect(board.store.size).toBe(1);
  });

  it('stays inside the two-second bound even when every port black-holes', async () => {
    // A port that accepts the connection and then says nothing is the only case
    // where the timeouts actually matter -- a closed port refuses instantly.
    const holes = await Promise.all([startBlackHole(), startBlackHole(), startBlackHole()]);
    open.push(...holes);

    const started = Date.now();
    const result = await report(
      { task: 'T012' },
      { ports: holes.map((hole) => hole.port), cwd: repo, sessionId: 'a1' },
    );
    const elapsed = Date.now() - started;

    expect(result.kind).toBe('no-board');
    expect(elapsed).toBeLessThan(2_000);
  });

  it('survives the board vanishing between discovery and delivery', async () => {
    const board = await startBoard();
    const port = board.port;
    await board.close();

    // Something answers health and then is gone. Still soft, still no retry.
    const impostor = await startStub((url) =>
      url === '/v1/health'
        ? { status: 200, body: JSON.stringify({ app: 'cocoapilot', version: '0.1.0', contract: 'v1' }) }
        : { status: 500, body: 'gone' },
    );
    open.push(impostor);

    const result = await report({ task: 'T012' }, { ports: [impostor.port], cwd: repo, sessionId: 'a1' });

    expect(result.kind).toBe('rejected');
    expect(port).toBeGreaterThan(0);
  });
});

describe('when something that is not the board answers', () => {
  it('receives a health probe and nothing else', async () => {
    // The one test that fails if discovery is ever simplified to "did it
    // answer". Everything else passes either way.
    //
    // The impostor answers with a well-formed health body carrying the *right*
    // contract version, so only the `app` check can save us. A bare `200 {}`
    // would be turned away by the version check instead, and this test would
    // pass while proving nothing about identity.
    const impostor: Stub = await startStub(() => ({
      status: 200,
      body: JSON.stringify({ app: 'some-other-tool', version: '2.0.0', contract: 'v1' }),
    }));
    open.push(impostor);

    await report(
      { task: 'T012', note: 'text that must never reach an unrelated program' },
      { ports: [impostor.port], cwd: repo, sessionId: 'a1' },
    );

    expect(impostor.hits).toEqual([{ method: 'GET', url: '/v1/health' }]);
    expect(impostor.hits.some((hit) => hit.method === 'POST')).toBe(false);
  });
});

describe('when the board rejects the report', () => {
  it('passes the reason back intact, naming the field', async () => {
    const board = await startBoard();
    open.push(board);

    const result = await note(
      { text: 'x'.repeat(MAX_TEXT + 1) },
      { ports: [board.port], cwd: repo, sessionId: 'a1' },
    );

    expect(result.kind).toBe('rejected');
    expect(result.message).toContain('text');
    expect(result.message).toMatch(new RegExp(String(MAX_TEXT)));
    // Not flattened into "request failed" -- a developer has to be able to fix
    // it from this message alone.
    expect(result.message).not.toMatch(/request failed/i);
  });
});
