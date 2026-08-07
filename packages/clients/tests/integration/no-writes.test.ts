import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * The clients' half of the guarantee feature 001 asserts for the service.
 *
 * They write nothing, anywhere (FR-018, SC-009), and read nothing in the user's
 * repository except the `.git` metadata that answers "which repository, which
 * branch". Deriving identity is the *only* reason they touch a disk at all, and
 * this is what stops that from quietly growing into reading `tasks.md`.
 */

interface FsCall {
  module: string;
  fn: string;
  args: unknown[];
}

const recorder = vi.hoisted(() => {
  const calls: FsCall[] = [];
  const wrap = (moduleName: string, actual: Record<string, unknown>): Record<string, unknown> => {
    const wrapped: Record<string, unknown> = {};
    for (const key of Object.keys(actual)) {
      const value = actual[key];
      wrapped[key] =
        typeof value === 'function'
          ? (...args: unknown[]): unknown => {
              calls.push({ module: moduleName, fn: key, args });
              return (value as (...a: unknown[]) => unknown)(...args);
            }
          : value;
    }
    wrapped['default'] = wrapped;
    return wrapped;
  };
  return { calls, wrap };
});

vi.mock('node:fs', async (importOriginal) =>
  recorder.wrap('node:fs', await importOriginal<Record<string, unknown>>()),
);

vi.mock('node:fs/promises', async (importOriginal) =>
  recorder.wrap('node:fs/promises', await importOriginal<Record<string, unknown>>()),
);

const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');

const { note, report } = await import('../../src/client.js');
const { run } = await import('../../src/cli/run.js');
const { startBoard, closedPort } = await import('../helpers/harness.js');

const WRITE_APIS = new Set([
  'appendFile',
  'appendFileSync',
  'copyFile',
  'copyFileSync',
  'cp',
  'cpSync',
  'createWriteStream',
  'link',
  'linkSync',
  'mkdir',
  'mkdirSync',
  'mkdtemp',
  'mkdtempSync',
  'rename',
  'renameSync',
  'rm',
  'rmSync',
  'rmdir',
  'rmdirSync',
  'symlink',
  'symlinkSync',
  'truncate',
  'truncateSync',
  'unlink',
  'unlinkSync',
  'write',
  'writeFile',
  'writeFileSync',
  'writeSync',
  'writev',
  'writevSync',
]);

let repo: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'cocopilot-clientfs-'));
  mkdirSync(join(repo, '.git'), { recursive: true });
  writeFileSync(join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  // The files a "helpful" change would be tempted to read.
  writeFileSync(join(repo, 'tasks.md'), '- [x] T001 A task\n');
  mkdirSync(join(repo, 'specs'), { recursive: true });
  writeFileSync(join(repo, 'specs', 'spec.md'), '# A spec\n');
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

function normalise(value: string): string {
  return value.replaceAll('\\', '/').toLowerCase();
}

function pathish(call: FsCall): string[] {
  const found: string[] = [];
  for (const arg of call.args) {
    if (typeof arg === 'string') found.push(arg);
    else if (arg instanceof URL) found.push(arg.pathname);
    else if (Buffer.isBuffer(arg)) found.push(arg.toString('utf8'));
  }
  return found;
}

describe('the clients touch a disk only to answer which repository and branch', () => {
  it('exercises both clients, delivered and undelivered', async () => {
    const board = await startBoard();
    const absent = [await closedPort()];
    const io = { out: () => {}, err: () => {} };

    recorder.calls.length = 0;

    try {
      await report({ task: 'T012', note: 'prose', chip: 'watching' }, { ports: [board.port], cwd: repo, sessionId: 'a1' });
      await note({ text: 'a note', source: 'you asked' }, { ports: [board.port], cwd: repo, sessionId: 'a1' });
      await report({ task: 'T013' }, { ports: absent, cwd: repo, sessionId: 'a1' });
      await note({ text: 'undeliverable' }, { ports: absent, cwd: repo, sessionId: 'a1' });

      await run(['report', '--task', 'T033'], { ports: [board.port], cwd: repo, io });
      await run(['note', 'from a hook'], { ports: absent, cwd: repo, io });
      await run(['report'], { ports: [board.port], cwd: tmpdir(), io });
    } finally {
      await board.close();
    }

    expect(recorder.calls.length).toBeGreaterThan(0);
  });

  it('writes nothing anywhere', () => {
    const writes = recorder.calls
      .filter((call) => WRITE_APIS.has(call.fn))
      .map((call) => `${call.module}.${call.fn}(${pathish(call)[0] ?? ''})`);

    expect(writes).toEqual([]);
  });

  it('reads nothing in the repository except .git metadata', () => {
    const prefix = normalise(repo) + '/';
    const dotGit = normalise(join(repo, '.git'));
    // `.git` itself is stat-ed to find out whether it is a directory or a
    // worktree pointer, so the permitted set is that path and everything under it.
    const permitted = (value: string): boolean => value === dotGit || value.startsWith(dotGit + '/');

    const trespass = recorder.calls.flatMap((call) =>
      pathish(call)
        .map(normalise)
        .filter((value) => value.startsWith(prefix) && !permitted(value))
        .map((value) => `${call.module}.${call.fn}(${value})`),
    );

    expect(trespass).toEqual([]);
  });

  it('did read .git, which is how it knows the branch at all', () => {
    const gitReads = recorder.calls.filter((call) =>
      pathish(call).some((value) => normalise(value).includes('/.git')),
    );

    expect(gitReads.length).toBeGreaterThan(0);
  });
});
