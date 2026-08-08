import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { FsCall } from '../helpers/fs-calls.js';

/**
 * The two guarantees the whole product rests on, asserted as absences.
 *
 * CoCoapilot never writes anything anywhere (SC-004) and never reads inside the
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

const recorder = vi.hoisted(() => ({ calls: [] as FsCall[] }));

vi.mock('node:fs', async (importOriginal) => {
  const { recordInto } = await import('../helpers/fs-calls.js');
  return recordInto(recorder.calls, 'node:fs', await importOriginal<Record<string, unknown>>());
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const { recordInto } = await import('../helpers/fs-calls.js');
  return recordInto(
    recorder.calls,
    'node:fs/promises',
    await importOriginal<Record<string, unknown>>(),
  );
});

const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');

const { normalise, pathish, WRITE_APIS } = await import('../helpers/fs-calls.js');
const { startTestService } = await import('../helpers/service.js');

let repo: string;

beforeAll(() => {
  // A stand-in for the user's repository, with the files a "helpful" future
  // change would be most tempted to read.
  repo = mkdtempSync(join(tmpdir(), 'cocoapilot-repo-'));
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
      await service.post('/v1/push', envelope({ repo: join(tmpdir(), 'cocoapilot-absent-repo') }));
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
