import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { UNATTRIBUTED, type Service } from '@cocoapilot/board';
import { MAX_TEXT } from '@cocoapilot/contract';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EXIT_OK, EXIT_REJECTED, EXIT_USAGE, run } from '../../src/cli/run.js';
import { BOARD_ABSENT } from '../../src/messages.js';
import { closedPort, startBoard } from '../helpers/harness.js';

let board: Service;
let repo: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'cocoapilot-cli-'));
  mkdirSync(join(repo, '.git'), { recursive: true });
  writeFileSync(join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
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

interface Run {
  code: number;
  out: string;
  err: string;
}

async function cli(argv: string[], ports = [board.port], cwd = repo): Promise<Run> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(argv, {
    ports,
    cwd,
    io: { out: (line) => out.push(line), err: (line) => err.push(line) },
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('the CLI against a running board', () => {
  it('reports with repository and branch from the working directory', async () => {
    const result = await cli(['report', '--task', 'T033', '--note', 'from a hook', '--chip', 'watching']);

    expect(result.code).toBe(EXIT_OK);
    const session = board.store.getSession(repo, UNATTRIBUTED);
    expect(session?.branch).toBe('main');
    expect(session?.report?.focus).toMatchObject({
      task: 'T033',
      note: 'from a hook',
      chip: 'watching',
    });
  });

  it('adds a note, joining the words after the subcommand', async () => {
    const result = await cli(['note', 'the', 'harness', 'never', 'sets', 'the', 'cookie']);

    expect(result.code).toBe(EXIT_OK);
    expect(board.store.getSession(repo, UNATTRIBUTED)?.notes[0]?.text).toBe(
      'the harness never sets the cookie',
    );
  });

  it('records why a note exists when told', async () => {
    await cli(['note', 'worth keeping', '--source', 'you asked']);
    expect(board.store.getSession(repo, UNATTRIBUTED)?.notes[0]?.source).toBe('you asked');
  });

  it('is a script, not an agent', async () => {
    await cli(['report']);
    expect(board.store.getSession(repo, UNATTRIBUTED)?.attributed).toBe(false);
  });

  it('produces one session from eleven invocations, not eleven', async () => {
    // A hook firing per tool call must not fill the session switcher with
    // one-shot entries.
    for (let index = 0; index < 11; index += 1) {
      await cli(['note', `invocation ${index}`]);
    }

    expect(board.store.size).toBe(1);
    expect(board.store.getSession(repo, UNATTRIBUTED)?.notes).toHaveLength(11);
  });
});

describe('the CLI exit codes', () => {
  it('exits 0 and prints to stdout when no board is running', async () => {
    const result = await cli(['note', 'nowhere to go'], [await closedPort()]);

    expect(result.code).toBe(EXIT_OK);
    expect(result.out).toBe(BOARD_ABSENT);
    // Nothing on stderr: a hook that logged an error because a dashboard was
    // closed would be noise at best and a failed build at worst.
    expect(result.err).toBe('');
  });

  it('exits 1 outside a repository', async () => {
    const orphan = mkdtempSync(join(tmpdir(), 'cocoapilot-orphan-'));
    try {
      const result = await cli(['report'], [board.port], orphan);

      expect(result.code).toBe(EXIT_USAGE);
      expect(result.err).toMatch(/not inside a git repository/i);
      expect(board.store.size).toBe(0);
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });

  it('exits 2 with the reason on stderr when the board rejects it', async () => {
    const result = await cli(['note', 'x'.repeat(MAX_TEXT + 1)]);

    expect(result.code).toBe(EXIT_REJECTED);
    expect(result.err).toContain('text');
    expect(result.err).toMatch(new RegExp(String(MAX_TEXT)));
  });
});

describe('the CLI argument handling', () => {
  it('rejects an unknown command', async () => {
    const result = await cli(['explode']);
    expect(result.code).toBe(EXIT_USAGE);
    expect(result.err).toMatch(/unknown command: explode/);
  });

  it('rejects an unknown flag rather than ignoring it', async () => {
    const result = await cli(['report', '--taks', 'T001']);
    expect(result.code).toBe(EXIT_USAGE);
  });

  it('rejects a chip outside the closed set', async () => {
    const result = await cli(['report', '--chip', 'panicking']);
    expect(result.code).toBe(EXIT_USAGE);
    expect(result.err).toMatch(/unknown chip: panicking/);
    expect(board.store.size).toBe(0);
  });

  it('rejects a note with no text', async () => {
    const result = await cli(['note']);
    expect(result.code).toBe(EXIT_USAGE);
    expect(result.err).toMatch(/requires text/);
  });

  it('rejects a stray argument to report', async () => {
    const result = await cli(['report', 'oops']);
    expect(result.code).toBe(EXIT_USAGE);
  });

  it('says nothing about a command with no arguments beyond the usage', async () => {
    const result = await cli([]);
    expect(result.code).toBe(EXIT_USAGE);
    expect(result.err).toMatch(/no command given/);
  });

  it('prints usage on --help and exits 0', async () => {
    const result = await cli(['--help']);
    expect(result.code).toBe(EXIT_OK);
    expect(result.out).toMatch(/cocoapilot report/);
    expect(result.out).toMatch(/Exit codes/);
  });
});
