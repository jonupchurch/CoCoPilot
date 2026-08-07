import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Service } from '@cocoapilot/board';
import { UNATTRIBUTED } from '@cocoapilot/board';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { note, report } from '../../src/client.js';
import { DELIVERED, NOT_A_REPOSITORY } from '../../src/messages.js';
import { startBoard } from '../helpers/harness.js';

let board: Service;
let repo: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'cocoapilot-repo-'));
  mkdirSync(join(repo, '.git'), { recursive: true });
  writeFileSync(join(repo, '.git', 'HEAD'), 'ref: refs/heads/feat/session-hook\n');
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

beforeEach(async () => {
  board = await startBoard();
});

afterEach(async () => {
  await board.close();
});

const options = (sessionId: string | null) => ({
  ports: [board.port],
  cwd: repo,
  sessionId,
});

describe('an agent reporting with content only', () => {
  it('reaches the board with a repository and branch it never supplied', async () => {
    const result = await report(
      { task: 'T012', note: 'the harness never sets the cookie', chip: 'needs-you' },
      options('agent-1'),
    );

    expect(result).toEqual({ kind: 'delivered', message: DELIVERED });

    const session = board.store.getSession(repo, 'agent-1');
    expect(session?.branch).toBe('feat/session-hook');
    expect(session?.repoPath).toBe(repo);
    expect(session?.attributed).toBe(true);
    expect(session?.report?.focus).toMatchObject({
      task: 'T012',
      note: 'the harness never sets the cookie',
      chip: 'needs-you',
    });
  });

  it('updates one session rather than creating another', async () => {
    await report({ task: 'T012' }, options('agent-1'));
    await report({ task: 'T013' }, options('agent-1'));

    expect(board.store.size).toBe(1);
    expect(board.store.getSession(repo, 'agent-1')?.report?.focus?.task).toBe('T013');
  });

  it('keeps two agent sessions in one repository distinct', async () => {
    await report({ task: 'T012' }, options('agent-1'));
    await report({ task: 'T099' }, options('agent-2'));

    expect(board.store.size).toBe(2);
    expect(board.store.getSession(repo, 'agent-1')?.report?.focus?.task).toBe('T012');
    expect(board.store.getSession(repo, 'agent-2')?.report?.focus?.task).toBe('T099');
  });

  it('forwards the whole picture when the agent has it', async () => {
    await report(
      {
        feature: { id: '002', title: 'MCP server and CLI' },
        tasks: [
          { id: 'T012', title: 'No network at init', status: 'done' },
          { id: 'T026', title: 'A 200 is not identification', status: 'waiting on CI' },
        ],
        plan: [{ text: 'Prove the offline start first', status: 'done' }],
        changedFiles: [{ path: 'src/mcp/server.ts', change: 'added', added: 30, removed: 0 }],
        task: 'T026',
        chip: 'watching',
      },
      options('agent-1'),
    );

    const held = board.store.getSession(repo, 'agent-1')?.report;
    expect(held?.feature?.title).toBe('MCP server and CLI');
    expect(held?.tasks).toHaveLength(2);
    // Free-string status survives the trip unchanged; the clients impose no
    // vocabulary of their own.
    expect(held?.tasks[1]?.status).toBe('waiting on CI');
    expect(held?.changedFiles[0]?.path).toBe('src/mcp/server.ts');
  });

  it('appends a note without disturbing the report', async () => {
    await report({ task: 'T012' }, options('agent-1'));
    const result = await note({ text: 'worth remembering', source: 'you asked' }, options('agent-1'));

    expect(result.kind).toBe('delivered');
    const session = board.store.getSession(repo, 'agent-1');
    expect(session?.notes).toEqual([
      expect.objectContaining({ text: 'worth remembering', source: 'you asked' }),
    ]);
    expect(session?.report?.focus?.task).toBe('T012');
  });

  it('sends nothing at all when there is no repository to report against', async () => {
    const orphan = mkdtempSync(join(tmpdir(), 'cocoapilot-orphan-'));
    try {
      const result = await report({ task: 'T012' }, { ...options('agent-1'), cwd: orphan });

      expect(result).toEqual({ kind: 'not-a-repo', message: NOT_A_REPOSITORY });
      expect(board.store.size).toBe(0);
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });

  it('groups hook invocations into the one unattributed session', async () => {
    // A hook supplies no session identity, and the service assigns one shared
    // per repository. Eleven firings must not become eleven switcher entries.
    for (let index = 0; index < 11; index += 1) {
      await note({ text: `hook fired ${index}` }, { ...options('ignored'), sessionId: null });
    }

    expect(board.store.size).toBe(1);
    const session = board.store.getSession(repo, UNATTRIBUTED);
    expect(session?.attributed).toBe(false);
    expect(session?.notes).toHaveLength(11);
  });
});
