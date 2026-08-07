import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Service } from '@cocopilot/board';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { note, report } from '../../src/client.js';
import { transcriptId } from '../../src/identity.js';
import { startBoard } from '../helpers/harness.js';

/**
 * The one field the board cannot derive and the model must not compose.
 *
 * `sessionId` identifies a *board* session and is ours. `transcriptId` is the AI
 * tool's own session id, which names its transcript file, and the two are
 * unrelated — without it the board cannot tell which transcript belongs to the
 * session it is showing (005 FR-016).
 *
 * Absence is a supported case, not a failure: a different agent, a bare shell,
 * or a release that stops exporting the variable all report successfully and the
 * board falls back.
 */

let board: Service;
let repo: string;
const ENV = 'CLAUDE_CODE_SESSION_ID';
let original: string | undefined;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'cocopilot-transcript-'));
  mkdirSync(join(repo, '.git'), { recursive: true });
  writeFileSync(join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  original = process.env[ENV];
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
  if (original === undefined) delete process.env[ENV];
  else process.env[ENV] = original;
});

beforeEach(async () => {
  board = await startBoard();
});

afterEach(async () => {
  await board.close();
});

// Built per call, never once at module scope: `repo` and `board` are both
// assigned in hooks, so a captured object would silently carry `undefined` and
// the client would fall back to the real working directory.
const call = (): { ports: number[]; cwd: string; sessionId: string } => ({
  ports: [board.port],
  cwd: repo,
  sessionId: 'agent-1',
});

const held = (): string | null | undefined =>
  board.store.getSession(repo, 'agent-1')?.transcriptId;

describe('transcriptId is read from the environment', () => {
  it('reports the value the AI tool exported', () => {
    process.env[ENV] = '8e8c2496-af0a-4ab6-8eec-706b3787430e';
    expect(transcriptId()).toBe('8e8c2496-af0a-4ab6-8eec-706b3787430e');
  });

  it('reports null when the variable is absent or blank', () => {
    delete process.env[ENV];
    expect(transcriptId()).toBeNull();

    process.env[ENV] = '   ';
    expect(transcriptId()).toBeNull();
  });

  it('is not memoised, unlike the session id we mint ourselves', () => {
    // `processSessionId` must be stable because it *is* the identity. This one
    // only reports what the environment currently says.
    process.env[ENV] = 'first';
    expect(transcriptId()).toBe('first');
    process.env[ENV] = 'second';
    expect(transcriptId()).toBe('second');
  });
});

describe('transcriptId reaches the board', () => {
  it('arrives on a report and is held against the session', async () => {
    process.env[ENV] = 'transcript-abc';

    const result = await report({ task: 'T001' }, call());

    expect(result.kind).toBe('delivered');
    expect(held()).toBe('transcript-abc');
  });

  it('arrives on a note as well, since a note may be first contact', async () => {
    process.env[ENV] = 'transcript-xyz';

    await note({ text: 'noticed while editing' }, call());

    expect(held()).toBe('transcript-xyz');
  });

  it('is not something a model can supply', async () => {
    process.env[ENV] = 'from-the-environment';

    // The content surface has no such parameter, so a model cannot reach it —
    // the same reasoning that keeps `repo`, `branch` and `sessionId` out.
    await report(
      { task: 'T001', transcriptId: 'from-the-model' } as unknown as { task: string },
      call(),
    );

    expect(held()).toBe('from-the-environment');
  });
});

describe('an agent that is not Claude Code', () => {
  it('still reports successfully, with no transcript id', async () => {
    delete process.env[ENV];

    const result = await report({ task: 'T001', chip: 'watching' }, call());

    expect(result.kind).toBe('delivered');
    expect(held()).toBeNull();
  });

  it('leaves the rest of the session untouched by the absence', async () => {
    delete process.env[ENV];

    await report({ task: 'T001' }, call());
    const session = board.store.getSession(repo, 'agent-1');

    expect(session?.branch).toBe('main');
    expect(session?.report?.focus?.task).toBe('T001');
  });
});
