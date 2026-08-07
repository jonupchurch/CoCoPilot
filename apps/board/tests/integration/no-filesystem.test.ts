import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * The two guarantees the whole product rests on, asserted as absences.
 *
 * CoCoPilot never writes anything anywhere (SC-004) and never reads inside the
 * repository it is told about (SC-005). Both are stated in prose all over the
 * design documents, and prose is exactly what erodes: a cache file added for a
 * good reason, or a convenience read of `tasks.md`, would pass review unnoticed
 * and quietly turn a display panel into something that owns state.
 *
 * So `node:fs` and `node:fs/promises` are wrapped at module level and every call
 * the service makes during a full exercise of the contract is recorded. The
 * service is allowed exactly one: `statSync` on the reported repository path
 * itself, which is how it checks the path exists without opening it.
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

const { startTestService } = await import('../helpers/service.js');

/**
 * Anything that changes the filesystem. Listed by name rather than by pattern so
 * that adding a call the list does not know about fails loudly.
 */
const WRITE_APIS = new Set([
  'appendFile',
  'appendFileSync',
  'chmod',
  'chmodSync',
  'chown',
  'chownSync',
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
  'utimes',
  'utimesSync',
  'write',
  'writeFile',
  'writeFileSync',
  'writeSync',
  'writev',
  'writevSync',
]);

let repo: string;

beforeAll(() => {
  // A stand-in for the user's repository, with the files a "helpful" future
  // change would be most tempted to read.
  repo = mkdtempSync(join(tmpdir(), 'cocopilot-repo-'));
  writeFileSync(join(repo, 'tasks.md'), '- [x] T001 A task\n- [ ] T002 Another\n');
  mkdirSync(join(repo, 'specs'));
  writeFileSync(join(repo, 'specs', 'spec.md'), '# A spec\n');
  mkdirSync(join(repo, '.git'));
  writeFileSync(join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { repo, branch: 'feat/session-hook', sessionId: 'a1b2c3', ...overrides };
}

/**
 * Both separators are valid on Windows, and case is not significant there
 * either. Comparing raw strings would let a read of the very same file slip
 * past for writing `repo + '/tasks.md'` instead of `join(repo, 'tasks.md')`.
 */
function normalise(value: string): string {
  return value.replaceAll('\\', '/').toLowerCase();
}

/** Every argument that could name a path, flattened out of a recorded call. */
function pathish(call: FsCall): string[] {
  const found: string[] = [];
  const walk = (value: unknown, depth: number): void => {
    if (depth > 3) return;
    if (typeof value === 'string') found.push(value);
    else if (value instanceof URL) found.push(value.pathname);
    else if (Buffer.isBuffer(value)) found.push(value.toString('utf8'));
    else if (Array.isArray(value)) for (const item of value) walk(item, depth + 1);
  };
  for (const arg of call.args) walk(arg, 0);
  return found;
}

describe('the service touches the filesystem exactly once, and never inside the repository', () => {
  it('makes no call other than stat-ing the reported path', async () => {
    const service = await startTestService();

    // Everything before this point -- fixture setup, module loading -- is setup,
    // not the contract. The window starts here.
    recorder.calls.length = 0;

    try {
      await service.get('/v1/health');
      await service.get('/v1/nope');

      await service.post('/v1/push', {
        ...envelope(),
        feature: { id: '001', title: 'Push contract', specPath: 'specs/spec.md' },
        stories: [{ id: 'US-001', title: 'A story', criteria: ['it works'] }],
        tasks: [{ id: 'T001', title: 'Hold a report', status: 'done', files: ['tasks.md'] }],
        plan: [{ text: 'Read the call sites', status: 'done' }],
        focus: { task: 'T001', note: 'reading tasks.md', chip: 'watching' },
        changedFiles: [{ path: 'tasks.md', change: 'modified', added: 2, removed: 0 }],
      });
      await service.post('/v1/push', { ...envelope(), tasks: [] });
      await service.post('/v1/push', envelope({ sessionId: null }));
      await service.post('/v1/push', { branch: 'main' });
      // A path that does not exist, and deliberately *not* under the fixture
      // repo: the service stats whatever path it is told about, so a nested one
      // would look like a read inside the repository when it is nothing of the
      // kind.
      await service.post('/v1/push', envelope({ repo: join(tmpdir(), 'cocopilot-absent-repo') }));
      await service.post('/v1/push', { ...envelope(), tasks: 'not an array' });
      await service.post('/v1/push', 'not json');
      await service.post('/v1/push', envelope(), { headers: { 'content-type': 'text/plain' } });
      await service.get('/v1/push');

      await service.post('/v1/note', { ...envelope(), text: 'a note', source: 'you asked' });
      await service.post('/v1/note', { ...envelope(), text: '' });

      service.store.dismiss(repo, 'a1b2c3');
      service.store.listSessions();
    } finally {
      await service.close();
    }

    const called = [...new Set(recorder.calls.map((call) => `${call.module}.${call.fn}`))];
    expect(called).toEqual(['node:fs.statSync']);
  });

  it('writes nothing anywhere, for any request', () => {
    const writes = recorder.calls.filter((call) => WRITE_APIS.has(call.fn));

    expect(
      writes.map((call) => `${call.module}.${call.fn}(${pathish(call)[0] ?? ''})`),
    ).toEqual([]);
  });

  it('reads nothing inside the reported repository', () => {
    // The reported path itself is stat-ed, and that is the only permitted touch.
    // Anything *beneath* it -- tasks.md, specs/, .git/ -- is the user's, and the
    // agent is what reads it.
    const prefix = normalise(repo) + '/';
    const inside = recorder.calls.flatMap((call) =>
      pathish(call)
        .filter((value) => normalise(value).startsWith(prefix))
        .map((value) => `${call.module}.${call.fn}(${value})`),
    );

    expect(inside).toEqual([]);
  });

  it('stat-ed the repository path itself, which is how the check works at all', () => {
    const stats = recorder.calls.filter(
      (call) => call.fn === 'statSync' && pathish(call).includes(repo),
    );

    expect(stats.length).toBeGreaterThan(0);
  });
});
